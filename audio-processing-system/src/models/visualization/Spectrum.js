/**
 * Advanced Spectrum Analysis Class
 *
 * This class encapsulates frequency and magnitude data obtained from a signal's
 * spectral decomposition, along with relevant metadata like the sample rate.
 * It provides methods for manipulating and analyzing the spectrum data.
 */
class Spectrum {
    /**
     * Constructs a Spectrum instance.
     *
     * @param {object} options - Configuration options.
     * @param {number[]} options.frequencies - An array of frequency values (in Hz).
     * @param {number[]} options.magnitudes - An array of magnitude values (e.g., amplitude, power).
     * @param {number} options.sampleRate - The sample rate of the original signal (in Hz).
     * @param {string} [options.units='magnitude'] - The units of the magnitude values.
     * @param {string} [options.type='amplitude'] - The type of magnitude (amplitude, power, etc.).
     * @param {number} [options.windowSize] - The size of the analysis window used to create the spectrum.
     * @param {number} [options.hopSize] - The hop size (overlap) of the analysis windows.
     */
    constructor({
      frequencies,
      magnitudes,
      sampleRate,
      units = 'magnitude',
      type = 'amplitude',
      windowSize,
      hopSize,
    }) {
      if (!frequencies || !magnitudes || !sampleRate) {
        throw new Error('Frequencies, magnitudes, and sampleRate are required.');
      }
  
      if (frequencies.length !== magnitudes.length) {
        throw new Error('Frequencies and magnitudes arrays must have the same length.');
      }
  
      this.frequencies = frequencies;
      this.magnitudes = magnitudes;
      this.sampleRate = sampleRate;
      this.units = units;
      this.type = type;
      this.windowSize = windowSize;
      this.hopSize = hopSize;
    }
  
    /**
     * Gets the magnitude at a specific frequency.
     *
     * @param {number} frequency - The frequency to look up (in Hz).
     * @returns {number|null} The magnitude at the specified frequency, or null if not found.
     */
    getMagnitudeAtFrequency(frequency) {
      const index = this.frequencies.findIndex((freq) => Math.abs(freq - frequency) < 1e-9); // Handle floating-point precision
      return index !== -1 ? this.magnitudes[index] : null;
    }
  
    /**
     * Normalizes the magnitude values to a given range (e.g., [0, 1]).
     *
     * @param {number} [min=0] - The minimum value of the normalized range.
     * @param {number} [max=1] - The maximum value of the normalized range.
     * @returns {number[]} An array of normalized magnitude values.
     */
    normalizeMagnitudes(min = 0, max = 1) {
      const magnitudeMin = Math.min(...this.magnitudes);
      const magnitudeMax = Math.max(...this.magnitudes);
  
      return this.magnitudes.map(
        (magnitude) => ((magnitude - magnitudeMin) / (magnitudeMax - magnitudeMin)) * (max - min) + min
      );
    }
  
    /**
     * Applies a frequency-domain filter to the magnitudes.
     *
     * @param {function} filterFunction - A function that takes a frequency and magnitude
     * and returns a modified magnitude.
     * @returns {Spectrum} A new Spectrum instance with the filtered magnitudes.
     */
    applyFilter(filterFunction) {
      const filteredMagnitudes = this.magnitudes.map((magnitude, index) =>
        filterFunction(this.frequencies[index], magnitude)
      );
      return new Spectrum({
        frequencies: [...this.frequencies],
        magnitudes: filteredMagnitudes,
        sampleRate: this.sampleRate,
        units: this.units,
        type: this.type,
        windowSize: this.windowSize,
        hopSize: this.hopSize,
      });
    }
  
    /**
     * Gets the frequency with the maximum magnitude.
     *
     * @returns {{frequency: number, magnitude: number}|null} An object containing the
     * frequency and magnitude
     * of the maximum peak, or null if empty.
     */
    getMaxMagnitudePeak() {
      if (this.magnitudes.length === 0) {
        return null;
      }
  
      let maxMagnitude = this.magnitudes[0];
      let maxFrequency = this.frequencies[0];
  
      for (let i = 1; i < this.magnitudes.length; i++) {
        if (this.magnitudes[i] > maxMagnitude) {
          maxMagnitude = this.magnitudes[i];
          maxFrequency = this.frequencies[i];
        }
      }
  
      return { frequency: maxFrequency, magnitude: maxMagnitude };
    }
  
    /**
     * Returns a JSON representation of the Spectrum.
     *
     * @returns {object} A JSON object representing the Spectrum.
     */
    toJSON() {
      return {
        frequencies: this.frequencies,
        magnitudes: this.magnitudes,
        sampleRate: this.sampleRate,
        units: this.units,
        type: this.type,
        windowSize: this.windowSize,
        hopSize: this.hopSize,
      };
    }
  
      /**
       * Creates a new Spectrum object from a JSON object.
       * @param {object} jsonObject - A JSON object representing the spectrum.
       * @returns {Spectrum} a new Spectrum object.
       */
      static fromJSON(jsonObject){
          return new Spectrum(jsonObject);
      }
  }
  
  module.exports = Spectrum;