// src/utils/helpers/AudioLogger.js
const chalk = require('chalk');

class AudioLogger {
  constructor() {
    this.timers = new Map();
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const color = this._color(level);
    console.log(`${color(`[${level.toUpperCase()}]`)} ${timestamp} - ${message}`, data);
  }

  info(message, data) {
    this.log('info', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  error(message, data) {
    this.log('error', message, data);
  }

  debug(message, data) {
    if (process.env.DEBUG === 'true') {
      this.log('debug', message, data);
    }
  }

  startTimer(label, data = {}) {
    const id = `${label}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    this.timers.set(id, Date.now());
    this.debug(`⏱️ Timer started: ${label}`, { id, ...data });
    return id;
  }

  stopTimer(id, data = {}) {
    const start = this.timers.get(id);
    if (!start) return;

    const duration = Date.now() - start;
    this.timers.delete(id);
    this.info(`⏱️ Timer finished: ${id}`, { duration, ...data });
    return duration;
  }

  _color(level) {
    switch (level) {
      case 'info': return chalk.blue;
      case 'warn': return chalk.yellow;
      case 'error': return chalk.red;
      case 'debug': return chalk.magenta;
      default: return chalk.white;
    }
  }
}

module.exports = new AudioLogger();
