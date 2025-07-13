const express = require('express');
const path = require('path');
const app = express();

// A simple, hardcoded store for our OAuth tokens.
// In a real app, this would be a database.
const fakeTokenStore = {
  authorizationCode: null,
  accessToken: 'fake-access-token-12345', // A static token
  refreshToken: 'fake-refresh-token-67890'
};

// --- OAuth Endpoints ---

// 1. Authorization Endpoint
// This is where Google redirects the user to "log in".
app.get('/auth', (req, res) => {
  const { client_id, redirect_uri, state } = req.query;

  // In a real app, you'd validate client_id.
  // We'll store the redirect_uri and state to use later.
  fakeTokenStore.redirect_uri = redirect_uri;
  fakeTokenStore.state = state;

  // Show the login page.
  res.sendFile(path.join(__dirname, 'login.html'));
});

// This handles the form submission from the login page.
app.post('/auth', (req, res) => {
  // When the user "logs in", we generate a temporary authorization code.
  const authCode = `auth-code-${Math.random().toString(36).substring(2)}`;
  fakeTokenStore.authorizationCode = authCode;

  // Redirect back to Google with the authorization code.
  const redirectUrl = `${fakeTokenStore.redirect_uri}?code=${authCode}&state=${fakeTokenStore.state}`;
  res.redirect(redirectUrl);
});


// 2. Token Endpoint
// Google exchanges the authorization code for an access token.
app.post('/token', (req, res) => {
  const { grant_type, code, refresh_token } = req.body;

  // In a real app, you'd also validate client_id and client_secret here.

  if (grant_type === 'authorization_code') {
    if (code === fakeTokenStore.authorizationCode) {
      // Code is valid, issue the access token.
      res.json({
        token_type: 'Bearer',
        access_token: fakeTokenStore.accessToken,
        refresh_token: fakeTokenStore.refreshToken,
        expires_in: 3600 // 1 hour
      });
    } else {
      res.status(400).send('Invalid authorization code');
    }
  } else if (grant_type === 'refresh_token') {
    if (refresh_token === fakeTokenStore.refreshToken) {
      // Refresh token is valid, issue a new access token.
      res.json({
        token_type: 'Bearer',
        access_token: fakeTokenStore.accessToken,
        expires_in: 3600
      });
    } else {
      res.status(400).send('Invalid refresh token');
    }
  } else {
    res.status(400).send('Unsupported grant type');
  }
});

module.exports = app;
