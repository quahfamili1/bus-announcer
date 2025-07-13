// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const authRouter = require('./auth'); // Import the auth router

const app = express();
// Middlewares to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use the auth router for /auth and /token endpoints
app.use('/', authRouter);


// --- Smart Home Configuration ---
const LTA_API_KEY = process.env.LTA_API_KEY;
const BUS_STOP_CODE = '68039';
const BUS_SERVICE_NO = '103';
// A unique ID for our virtual device
const DEVICE_ID = 'bus-arrival-sensor-123';

/**
 * The main webhook for all Google Smart Home requests.
 */
app.post('/smarthome', async (req, res) => {
  console.log('Request received:', JSON.stringify(req.body, null, 2));

  // In a real app, you would validate the authorization token here.
  // For this example, we'll skip it.

  const intent = req.body.inputs[0].intent;
  const requestId = req.body.requestId; // Important: must be in the response

  const response = {
    requestId: requestId,
    payload: {},
  };

  switch (intent) {
    case 'action.devices.SYNC':
      console.log('Handling SYNC intent');
      response.payload = handleSync();
      break;

    case 'action.devices.QUERY':
      console.log('Handling QUERY intent');
      const queryPayload = req.body.inputs[0].payload;
      response.payload = await handleQuery(queryPayload);
      break;

    case 'action.devices.EXECUTE':
      console.log('Handling EXECUTE intent');
      // We don't have any commands to execute, so we return success
      response.payload = { commands: [{ ids: [DEVICE_ID], status: 'SUCCESS' }] };
      break;

    default:
      console.error('Unknown intent:', intent);
      res.status(400).send('Unknown intent');
      return;
  }

  console.log('Sending response:', JSON.stringify(response, null, 2));
  res.status(200).json(response);
});


/**
 * Handles the SYNC intent.
 * Responds with all the "devices" this app manages.
 */
function handleSync() {
  return {
    // The agentUserId is a unique identifier for the user.
    // In a real app, this would come from your user database.
    // For now, we'll hardcode it.
    agentUserId: 'user-quahfamili',
    devices: [{
      id: DEVICE_ID,
      type: 'action.devices.types.SENSOR',
      traits: [
        // This trait means the sensor can report a numeric value
        'action.devices.traits.SensorState'
      ],
      name: {
        defaultNames: ['Bus Status'],
        name: 'Bus Status',
        nicknames: ['Next Bus Time']
      },
      willReportState: false, // We only provide state on-demand (via QUERY)
      attributes: {
        // We are reporting the state of a timer in minutes
        sensorStatesSupported: [{
          name: 'TimerRemainingSec',
          numericCapabilities: {
            rawValueUnit: 'MINUTES'
          }
        }]
      },
      deviceInfo: {
        manufacturer: 'Gemini CLI',
        model: 'v1',
        hwVersion: '1.0',
        swVersion: '1.0'
      }
    }]
  };
}

/**
 * Handles the QUERY intent.
 * Responds with the current state of the requested devices.
 */
async function handleQuery(payload) {
    const deviceStates = {};
    for (const device of payload.devices) {
        if (device.id === DEVICE_ID) {
            const minutes = await getNextBusArrivalInMinutes();
            deviceStates[DEVICE_ID] = {
                online: true,
                status: 'SUCCESS',
                // The state must match what we promised in SYNC
                currentSensorStateData: [{
                    name: 'TimerRemainingSec',
                    rawValue: minutes
                }]
            };
        }
    }
    return { devices: deviceStates };
}


/**
 * Fetches bus arrival data and returns the arrival time in minutes.
 * @returns {Promise<number>} The number of minutes until the next bus arrives.
 */
async function getNextBusArrivalInMinutes() {
  if (!LTA_API_KEY || LTA_API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('LTA_API_KEY not configured.');
    return -1; // Return -1 to indicate an error
  }

  const apiUrl = 'https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival';
  const config = {
    headers: { 'AccountKey': LTA_API_KEY },
    params: { 'BusStopCode': BUS_STOP_CODE, 'ServiceNo': BUS_SERVICE_NO }
  };

  try {
    const response = await axios.get(apiUrl, config);
    const services = response.data.Services;

    if (!services || services.length === 0) {
      console.log('No service data returned from LTA.');
      return -1;
    }

    const nextBus = services[0].NextBus;
    if (!nextBus || !nextBus.EstimatedArrival) {
      console.log('No arrival information for the next bus.');
      return -1;
    }

    const arrivalTime = new Date(nextBus.EstimatedArrival);
    const now = new Date();
    const minutesToArrival = Math.round((arrivalTime - now) / (1000 * 60));

    return minutesToArrival <= 0 ? 0 : minutesToArrival;
  } catch (error) {
    console.error('Error fetching bus arrival:', error.message);
    return -1;
  }
}

// We still need to export the app for Vercel, but we also need to handle
// the new OAuth and Login endpoints which we will add next.
module.exports = app;