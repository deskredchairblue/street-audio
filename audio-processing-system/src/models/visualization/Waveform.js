/**
 * Advanced Waveform Analysis Class
 *
 * This class encapsulates waveform data, including the data points, resolution, and duration.
 * It provides methods for manipulating and analyzing the waveform.
 */
class Waveform {
    /**
     * Constructs a Waveform instance.
     *
     * @param {object} options - Configuration options.
     * @param {number[]} options.dataPoints - An array of waveform data points (e.g., amplitude values).
     * @param {number} options.resolution - The time resolution of the waveform (e.g., samples per second).
     * @param {number} options.duration - The total duration of the waveform (in seconds).
     * @param {string} [options.units='amplitude'] - The units of the data points.
     * @param {number} [options.offset=0] - An offset applied to all data points.
     * @param {number} [options.gain=1] - A gain factor applied to all data points.
     */
    constructor({ dataPoints, resolution, duration, units = 'amplitude', offset = 0, gain = 1 }) {
      if (!dataPoints || !resolution || !duration) {
        throw new Error('Data points, resolution, and duration are required.');
      }
  
      this.dataPoints = dataPoints.map(point => point * gain + offset);
      this.resolution = resolution;
      this.duration = duration;
      this.units = units;
      this.offset = offset;
      this.gain = gain;
    }
  
    /**
     * Gets the data point at a specific time.
     *
     * @param {number} time - The time (in seconds) to look up.
     * @returns {number|null} The data point at the specified time, or null if out of range.
     */
    getDataPointAtTime(time) {
      if (time < 0 || time > this.duration) {
        return null;
      }
  
      const index = Math.round(time * this.resolution);
      return this.dataPoints[index];
    }
  
    /**
     * Normalizes the data points to a given range (e.g., [0, 1]).
     *
     * @param {number} [min=0] - The minimum value of the normalized range.
     * @param {number} [max=1] - The maximum value of the normalized range.
     * @returns {number[]} An array of normalized data points.
     */
    normalizeDataPoints(min = 0, max = 1) {
      const dataMin = Math.min(...this.dataPoints);
      const dataMax = Math.max(...this.dataPoints);
  
      return this.dataPoints.map(
        (point) => ((point - dataMin) / (dataMax - dataMin)) * (max - min) + min
      );
    }
  
    /**
     * Applies a time-domain filter to the data points.
     *
     * @param {function} filterFunction - A function that takes a time and data point
     * and returns a modified data point.
     * @returns {Waveform} A new Waveform instance with the filtered data points.
     */
    applyFilter(filterFunction) {
      const filteredDataPoints = this.dataPoints.map((point, index) =>
        filterFunction(index / this.resolution, point)
      );
      return new Waveform({
        dataPoints: filteredDataPoints,
        resolution: this.resolution,
        duration: this.duration,
        units: this.units,
        offset: this.offset,
        gain: this.gain,
      });
    }
  
    /**
     * Gets the maximum and minimum data point values.
     *
     * @returns {{max: number, min: number}} An object containing the maximum and minimum values.
     */
    getExtrema() {
      const max = Math.max(...this.dataPoints);
      const min = Math.min(...this.dataPoints);
      return { max, min };
    }
  
    /**
     * Returns a JSON representation of the Waveform.
     *
     * @returns {object} A JSON object representing the Waveform.
     */
    toJSON() {
      return {
        dataPoints: this.dataPoints,
        resolution: this.resolution,
        duration: this.duration,
        units: this.units,
        offset: this.offset,
        gain: this.gain,
      };
    }
  
    /**
     * Creates a new Waveform object from a JSON object.
     * @param {object} jsonObject - A JSON object representing the Waveform.
     * @returns {Waveform} a new Waveform object.
     */
    static fromJSON(jsonObject){
      return new Waveform(jsonObject);
    }
  }
  
  module.exports = Waveform;