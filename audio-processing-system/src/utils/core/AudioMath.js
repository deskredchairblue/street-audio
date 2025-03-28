/**
 * AudioMath.js
 * @description Math utilities for audio processing calculations
 */

class AudioMath {
    /**
     * Converts decibels to linear gain
     * @param {number} db - Decibels
     * @returns {number} Linear gain
     */
    static dbToGain(db) {
      return Math.pow(10, db / 20);
    }
  
    /**
     * Converts linear gain to decibels
     * @param {number} gain - Linear gain
     * @returns {number} Decibels
     */
    static gainToDb(gain) {
      return 20 * Math.log10(gain);
    }
  
    /**
     * Calculate RMS (Root Mean Square) of an audio buffer
     * @param {Float32Array} buffer
     * @returns {number} RMS value
     */
    static calculateRMS(buffer) {
      const sum = buffer.reduce((acc, val) => acc + val * val, 0);
      return Math.sqrt(sum / buffer.length);
    }
  
    /**
     * Normalize a buffer to a given peak
     * @param {Float32Array} buffer
     * @param {number} targetPeak - Usually between 0.9 and 1.0
     * @returns {Float32Array} Normalized buffer
     */
    static normalize(buffer, targetPeak = 1.0) {
      const peak = Math.max(...buffer.map(Math.abs));
      const factor = peak === 0 ? 0 : targetPeak / peak;
      return buffer.map(sample => sample * factor);
    }
  
    /**
     * Clamp a value between min and max
     * @param {number} val
     * @param {number} min
     * @param {number} max
     */
    static clamp(val, min, max) {
      return Math.min(Math.max(val, min), max);
    }
  }
  
  module.exports = AudioMath;
  