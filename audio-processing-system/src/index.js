require('dotenv').config();
const express = require('express');
const http = require('http');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/app');

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors(config.cors));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// REST API routes
app.use('/api/tracks', require('./api/rest/tracks'));
app.use('/api/processing', require('./api/rest/processing'));
app.use('/api/projects', require('./api/rest/projects'));

// WebSocket Services
const WebRTCIntegrationService = require('./services/infrastructure/WebRTCIntegrationService');
const WebSocketRealtimeAPI = require('./api/websocket/realtime');

new WebRTCIntegrationService(server);         // WebRTC signaling
WebSocketRealtimeAPI(server);                 // Audio processing realtime WS

// Server start
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`🎧 Audio Processing Server running on port ${PORT}`);
});
