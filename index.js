// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Configuration
const BUS_STOP_CODE = '68039'; // Your bus stop code
const BUS_SERVICE_NO = '103';    // The bus service you are interested in
const LTA_API_KEY = process.env.LTA_API_KEY; // Your LTA API Key from .env file

if (!LTA_API_KEY || LTA_API_KEY === 'YOUR_API_KEY_HERE') {
  console.error('Error: LTA_API_KEY is not set. Please check your .env file.');
  process.exit(1);
}

// The main endpoint that Google Assistant will call
app.get('/nextbus', async (req, res) => {
  try {
    const responseText = await getNextBusArrival();
    // Google Assistant expects a specific JSON format for the response
    res.json({
      fulfillment_text: responseText,
    });
  } catch (error) {
    let errorMessage = `Error fetching bus arrival: ${error.message}\n`;
    if (error.response && error.response.data) {
      errorMessage += `Response Data: ${JSON.stringify(error.response.data)}\n`;
    }
    console.error(errorMessage);
    fs.appendFileSync('app.log', errorMessage); // Log to file
    res.status(500).json({
      fulfillment_text: "Sorry, I couldn't fetch the bus timing right now.",
    });
  }
});

/**
 * Fetches bus arrival data from LTA DataMall API
 * @returns {Promise<string>} A formatted string with the next bus arrival time.
 */
async function getNextBusArrival() {
  const apiUrl = 'https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival';

  const config = {
    headers: {
      'AccountKey': LTA_API_KEY
    },
    params: {
      'BusStopCode': BUS_STOP_CODE,
      'ServiceNo': BUS_SERVICE_NO
    }
  };

  const response = await axios.get(apiUrl, config);
  const services = response.data.Services;

  if (!services || services.length === 0) {
    return `Bus ${BUS_SERVICE_NO} does not seem to be operating at this stop right now.`;
  }

  const nextBus = services[0].NextBus;

  if (!nextBus || !nextBus.EstimatedArrival) {
     return `There is no arrival information for the next bus ${BUS_SERVICE_NO}.`;
  }

  const arrivalTime = new Date(nextBus.EstimatedArrival);
  const now = new Date();
  
  // The API gives time in GMT+8, and so does new Date() on most systems.
  // If running in a different timezone, this calculation might need adjustment.
  const minutesToArrival = Math.round((arrivalTime - now) / (1000 * 60));

  if (minutesToArrival <= 0) {
    return `The next bus ${BUS_SERVICE_NO} is arriving now.`;
  } else {
    return `The next bus ${BUS_SERVICE_NO} will arrive in ${minutesToArrival} minutes.`;
  }
}

// Export the app for Vercel
module.exports = app;

