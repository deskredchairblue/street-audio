// src/utils/helpers/LatencyCalculator.js
class LatencyCalculator {
    constructor() {
      this.pings = new Map(); // key = pingId, value = timestamp
    }
  
    /**
     * Record ping timestamp
     * @param {string} pingId 
     */
    markPing(pingId) {
      this.pings.set(pingId, Date.now());
    }
  
    /**
     * Calculate latency when pong returns
     * @param {string} pingId 
     * @returns {number} latency in ms
     */
    calculateLatency(pingId) {
      const start = this.pings.get(pingId);
      if (!start) return null;
      const latency = Date.now() - start;
      this.pings.delete(pingId);
      return latency;
    }
  }
  
  module.exports = LatencyCalculator;
  