// src/controllers/visualization/WaveformController.js

const AnalysisService = require('../../services/analysis/AnalysisService');

class WaveformController {
  constructor() {
    this.analyzer = new AnalysisService();
  }

  /**
   * Generate waveform from a track object or raw buffer
   * @param {Buffer|Object} source - Audio file buffer or preloaded track object
   * @param {number} resolution - Number of samples for waveform
   * @returns {Promise<number[]>}
   */
  async generate(source, resolution = 800) {
    if (!source) throw new Error('No audio source provided');
    return await this.analyzer.generateWaveform(source, resolution);
  }

  /**
   * Return waveform + metadata in a unified format
   * @param {Object} track 
   * @returns {Promise<Object>}
   */
  async getWaveformPayload(track) {
    const waveform = await this.generate(track, 1024);
    return {
      waveform,
      metadata: {
        duration: track.duration,
        sampleRate: track.sampleRate,
        resolution: waveform.length
      }
    };
  }
}

module.exports = new WaveformController();