// src/utils/helpers/AudioEventEmitter.js
const EventEmitter = require('events');

class AudioEventEmitter extends EventEmitter {}

module.exports = new AudioEventEmitter();
