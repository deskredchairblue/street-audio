// src/controllers/visualization/SpectrumController.js

const AnalysisService = require('../../services/analysis/AnalysisService');

class SpectrumController {
  constructor() {
    this.analyzer = new AnalysisService();
  }

  /**
   * Analyze a track or buffer to extract spectrum data
   * @param {Buffer|Object} source - Track buffer or object
   * @param {string} method - FFT, STFT, mel, etc.
   * @returns {Promise<Object>} Frequency data
   */
  async analyze(source, method = 'fft') {
    if (!source) throw new Error('No audio source provided');

    return await this.analyzer.generateSpectrum(source, method);
  }

  /**
   * Return spectrum + breakdown for front-end rendering
   * @param {Object} track 
   * @returns {Promise<Object>}
   */
  async getSpectrumPayload(track) {
    const spectrum = await this.analyze(track);
    return {
      spectrum,
      metadata: {
        duration: track.duration,
        sampleRate: track.sampleRate,
        channels: track.channels
      }
    };
  }
}

module.exports = new SpectrumController();