class DSPModel {
    constructor({ name, algorithm, options = {} }) {
      this.name = name;
      this.algorithm = algorithm;
      this.options = options;
  
      // Basic validation
      if (typeof this.algorithm !== 'function') {
        throw new Error('Invalid DSP algorithm provided. Must be a function.');
      }
    }
  
    /**
     * Processes the input audio buffer using the provided algorithm and options.
     * @param {Float32Array} buffer - The raw audio buffer (mono or stereo)
     * @returns {Float32Array} - The processed buffer
     */
    process(buffer) {
      try {
        if (!buffer || !(buffer instanceof Float32Array)) {
          throw new Error('Invalid buffer: must be a Float32Array');
        }
  
        const processed = this.algorithm(buffer, this.options);
  
        if (!(processed instanceof Float32Array)) {
          throw new Error('DSP algorithm must return a Float32Array');
        }
  
        return processed;
      } catch (err) {
        console.error(`[DSPModel:${this.name}] Processing failed: ${err.message}`);
        return buffer; // Return unprocessed on failure
      }
    }
  }
  
  module.exports = DSPModel;
  