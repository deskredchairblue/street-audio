/**
 * Advanced Audio Track Metadata Class
 *
 * This class encapsulates metadata about an audio track, including its ID, title, duration,
 * format, channel configuration, sample rate, bit depth, and file path.
 */
class AudioTrack {
    /**
     * Constructs an AudioTrack instance.
     *
     * @param {object} options - Configuration options.
     * @param {string} options.id - The unique ID of the audio track.
     * @param {string} options.title - The title of the audio track.
     * @param {number} options.duration - The duration of the audio track (in seconds).
     * @param {string} options.format - The audio file format (e.g., 'wav', 'mp3', 'flac').
     * @param {number} options.channels - The number of audio channels (e.g., 1 for mono, 2 for stereo).
     * @param {number} options.sampleRate - The sample rate of the audio (in Hz).
     * @param {number} options.bitDepth - The bit depth of the audio (e.g., 16, 24, 32).
     * @param {string} options.path - The file path of the audio track.
     * @param {object} [options.metadata={}] - Optional additional metadata about the track.
     * @param {string[]} [options.tags=[]] - Optional tags associated with the audio track.
     * @param {Date} [options.createdAt=new Date()] - The creation date of the audio track.
     * @param {Date} [options.updatedAt=new Date()] - The last update date of the audio track.
     */
    constructor({
      id,
      title,
      duration,
      format,
      channels,
      sampleRate,
      bitDepth,
      path,
      metadata = {},
      tags = [],
      createdAt = new Date(),
      updatedAt = new Date(),
    }) {
      if (!id || !title || !duration || !format || !channels || !sampleRate || !bitDepth || !path) {
        throw new Error('ID, title, duration, format, channels, sampleRate, bitDepth, and path are required.');
      }
  
      this.id = id;
      this.title = title;
      this.duration = duration;
      this.format = format;
      this.channels = channels;
      this.sampleRate = sampleRate;
      this.bitDepth = bitDepth;
      this.path = path;
      this.metadata = metadata;
      this.tags = tags;
      this.createdAt = createdAt;
      this.updatedAt = updatedAt;
    }
  
    /**
     * Returns a JSON representation of the AudioTrack.
     *
     * @returns {object} A JSON object representing the AudioTrack.
     */
    toJSON() {
      return {
        id: this.id,
        title: this.title,
        duration: this.duration,
        format: this.format,
        channels: this.channels,
        sampleRate: this.sampleRate,
        bitDepth: this.bitDepth,
        path: this.path,
        metadata: this.metadata,
        tags: this.tags,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      };
    }
  
    /**
     * Creates a new AudioTrack object from a JSON object.
     * @param {object} jsonObject - A JSON object representing the AudioTrack.
     * @returns {AudioTrack} a new AudioTrack object.
     */
    static fromJSON(jsonObject){
        return new AudioTrack(jsonObject);
    }
  
    /**
     * Updates the track's metadata.
     *
     * @param {object} updatedMetadata - An object containing the updated metadata.
     */
    updateMetadata(updatedMetadata) {
      this.metadata = { ...this.metadata, ...updatedMetadata };
      this.updatedAt = new Date();
    }
  
    /**
     * Adds a tag to the track.
     *
     * @param {string} tag - The tag to add.
     */
    addTag(tag) {
      if (!this.tags.includes(tag)) {
        this.tags.push(tag);
        this.updatedAt = new Date();
      }
    }
  
    /**
     * Removes a tag from the track.
     *
     * @param {string} tag - The tag to remove.
     */
    removeTag(tag) {
      this.tags = this.tags.filter((t) => t !== tag);
      this.updatedAt = new Date();
    }
  }
  
  module.exports = AudioTrack;