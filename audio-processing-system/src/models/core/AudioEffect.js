/**
 * Advanced Audio Effect Configuration Class
 *
 * This class encapsulates the configuration of an audio effect, including its ID, name, type,
 * and adjustable parameters.
 */
class AudioEffect {
    /**
     * Constructs an AudioEffect instance.
     *
     * @param {object} options - Configuration options.
     * @param {string} options.id - The unique ID of the audio effect.
     * @param {string} options.name - The name of the audio effect.
     * @param {string} options.type - The type of audio effect (e.g., 'reverb', 'delay', 'distortion').
     * @param {object} [options.parameters={}] - An object containing the effect's parameters.
     * @param {string} [options.description=''] - An optional description of the audio effect.
     * @param {string[]} [options.tags=[]] - Optional tags associated with the audio effect.
     * @param {Date} [options.createdAt=new Date()] - The creation date of the audio effect.
     * @param {Date} [options.updatedAt=new Date()] - The last update date of the audio effect.
     * @param {boolean} [options.enabled=true] - A boolean to indicate if the effect is enabled.
     */
    constructor({
      id,
      name,
      type,
      parameters = {},
      description = '',
      tags = [],
      createdAt = new Date(),
      updatedAt = new Date(),
      enabled = true,
    }) {
      if (!id || !name || !type) {
        throw new Error('ID, name, and type are required.');
      }
  
      this.id = id;
      this.name = name;
      this.type = type;
      this.parameters = parameters;
      this.description = description;
      this.tags = tags;
      this.createdAt = createdAt;
      this.updatedAt = updatedAt;
      this.enabled = enabled;
    }
  
    /**
     * Updates the parameters of the audio effect.
     *
     * @param {object} updatedParameters - An object containing the updated parameters.
     */
    updateParameters(updatedParameters) {
      this.parameters = { ...this.parameters, ...updatedParameters };
      this.updatedAt = new Date();
    }
  
    /**
     * Sets the value of a specific parameter.
     *
     * @param {string} parameterName - The name of the parameter to set.
     * @param {any} value - The new value of the parameter.
     */
    setParameter(parameterName, value) {
      this.parameters[parameterName] = value;
      this.updatedAt = new Date();
    }
  
    /**
     * Gets the value of a specific parameter.
     *
     * @param {string} parameterName - The name of the parameter to get.
     * @returns {any|undefined} The value of the parameter, or undefined if not found.
     */
    getParameter(parameterName) {
      return this.parameters[parameterName];
    }
  
    /**
     * Enables the audio effect.
     */
    enable() {
      this.enabled = true;
      this.updatedAt = new Date();
    }
  
    /**
     * Disables the audio effect.
     */
    disable() {
      this.enabled = false;
      this.updatedAt = new Date();
    }
  
    /**
     * Returns a JSON representation of the AudioEffect.
     *
     * @returns {object} A JSON object representing the AudioEffect.
     */
    toJSON() {
      return {
        id: this.id,
        name: this.name,
        type: this.type,
        parameters: this.parameters,
        description: this.description,
        tags: this.tags,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        enabled: this.enabled,
      };
    }
  
    /**
     * Creates a new AudioEffect object from a JSON object.
     * @param {object} jsonObject - A JSON object representing the AudioEffect.
     * @returns {AudioEffect} a new AudioEffect object.
     */
    static fromJSON(jsonObject){
      return new AudioEffect(jsonObject);
    }
  }
  
  module.exports = AudioEffect;