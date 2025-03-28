class AdaptiveBitrateService {
    constructor() {
      this.streamConfigs = new Map(); // streamId => config
    }
  
    /**
     * Configure stream bitrate adaptation based on network metrics
     * @param {string} streamId
     * @param {Object} metrics
     * @param {number} metrics.bandwidth - in kbps
     * @param {number} metrics.latency - in ms
     */
    configureStream(streamId, { bandwidth, latency }) {
      const defaultBitrate = 192; // kbps
      const adjusted = this.calculateBitrate(bandwidth, latency);
  
      this.streamConfigs.set(streamId, {
        bandwidth,
        latency,
        bitrate: adjusted
      });
  
      return adjusted;
    }
  
    /**
     * Calculate optimal bitrate based on network conditions
     */
    calculateBitrate(bandwidth, latency) {
      if (!bandwidth) return 128;
      if (latency > 200) return Math.min(96, Math.floor(bandwidth * 0.5));
      if (bandwidth < 128) return 64;
      if (bandwidth < 256) return 128;
      return Math.min(bandwidth, 320);
    }
  
    getStreamConfig(streamId) {
      return this.streamConfigs.get(streamId);
    }
  
    clear(streamId) {
      this.streamConfigs.delete(streamId);
    }
  }
  
  module.exports = AdaptiveBitrateService;
  