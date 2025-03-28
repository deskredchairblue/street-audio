/**
 * Advanced Audio Session Management Class
 *
 * This class represents an audio session, including its ID, user, tracks, start time, and metadata.
 * It provides methods for managing and manipulating the session.
 */
class AudioSession {
    /**
     * Constructs an AudioSession instance.
     *
     * @param {object} options - Configuration options.
     * @param {string} options.sessionId - The unique ID of the audio session.
     * @param {string} options.userId - The ID of the user associated with the session.
     * @param {object[]} [options.tracks=[]] - An array of track objects in the session.
     * @param {number} [options.startTime=Date.now()] - The start time of the session (in milliseconds).
     * @param {object} [options.metadata={}] - Optional metadata about the session.
     * @param {Date} [options.createdAt=new Date()] - The creation date of the audio track.
     * @param {Date} [options.updatedAt=new Date()] - The last update date of the audio track.
     * @param {number} [options.endTime=null] - The end time of the session (in milliseconds).
     */
    constructor({
      sessionId,
      userId,
      tracks = [],
      startTime = Date.now(),
      metadata = {},
      createdAt = new Date(),
      updatedAt = new Date(),
      endTime = null,
    }) {
      if (!sessionId || !userId) {
        throw new Error('Session ID and user ID are required.');
      }
  
      this.sessionId = sessionId;
      this.userId = userId;
      this.tracks = tracks;
      this.startTime = startTime;
      this.metadata = metadata;
      this.createdAt = createdAt;
      this.updatedAt = updatedAt;
      this.endTime = endTime;
    }
  
    /**
     * Adds a track to the session.
     *
     * @param {object} track - The track object to add.
     */
    addTrack(track) {
      this.tracks.push(track);
      this.updatedAt = new Date();
    }
  
    /**
     * Removes a track from the session by its ID.
     *
     * @param {string} trackId - The ID of the track to remove.
     * @returns {boolean} True if the track was removed, false otherwise.
     */
    removeTrack(trackId) {
      const index = this.tracks.findIndex((track) => track.id === trackId);
      if (index !== -1) {
        this.tracks.splice(index, 1);
        this.updatedAt = new Date();
        return true;
      }
      return false;
    }
  
    /**
     * Gets a track from the session by its ID.
     *
     * @param {string} trackId - The ID of the track to retrieve.
     * @returns {object|null} The track object, or null if not found.
     */
    getTrack(trackId) {
      return this.tracks.find((track) => track.id === trackId) || null;
    }
  
    /**
     * Updates the session's metadata.
     *
     * @param {object} updatedMetadata - An object containing the updated metadata.
     */
    updateMetadata(updatedMetadata) {
      this.metadata = { ...this.metadata, ...updatedMetadata };
      this.updatedAt = new Date();
    }
  
    /**
     * Ends the audio session.
     *
     * @param {number} [endTime=Date.now()] - The end time of the session (in milliseconds).
     */
    endSession(endTime = Date.now()) {
      this.endTime = endTime;
      this.updatedAt = new Date();
    }
  
    /**
     * Returns a JSON representation of the AudioSession.
     *
     * @returns {object} A JSON object representing the AudioSession.
     */
    toJSON() {
      return {
        sessionId: this.sessionId,
        userId: this.userId,
        tracks: this.tracks,
        startTime: this.startTime,
        metadata: this.metadata,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        endTime: this.endTime,
      };
    }
  
    /**
     * Creates a new AudioSession object from a JSON object.
     * @param {object} jsonObject - A JSON object representing the AudioSession.
     * @returns {AudioSession} a new AudioSession object.
     */
    static fromJSON(jsonObject){
      return new AudioSession(jsonObject);
    }
  }
  
  module.exports = AudioSession;