// src/utils/helpers/BandwidthOptimizer.js
class BandwidthOptimizer {
    constructor() {
      this.bandwidthHistory = [];
      this.maxHistory = 20;
    }
  
    /**
     * Record a new bandwidth sample in kbps
     * @param {number} kbps 
     */
    recordBandwidth(kbps) {
      this.bandwidthHistory.push(kbps);
      if (this.bandwidthHistory.length > this.maxHistory) {
        this.bandwidthHistory.shift();
      }
    }
  
    /**
     * Calculate smoothed bandwidth average
     * @returns {number}
     */
    getAverageBandwidth() {
      if (this.bandwidthHistory.length === 0) return 0;
      const total = this.bandwidthHistory.reduce((a, b) => a + b, 0);
      return Math.round(total / this.bandwidthHistory.length);
    }
  
    /**
     * Suggest an optimal bitrate (e.g., 80% of available bandwidth)
     * @returns {number}
     */
    suggestBitrate() {
      const avg = this.getAverageBandwidth();
      return Math.floor(avg * 0.8); // 80% of average bandwidth
    }
  }
  
  module.exports = BandwidthOptimizer;
  