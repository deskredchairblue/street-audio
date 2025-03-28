/**
 * Advanced Playlist Management Class
 *
 * This class represents a playlist, including its ID, title, owner, and tracks.
 * It provides methods for managing and manipulating the playlist's tracks.
 */
class Playlist {
    /**
     * Constructs a Playlist instance.
     *
     * @param {object} options - Configuration options.
     * @param {string} options.id - The unique ID of the playlist.
     * @param {string} options.title - The title of the playlist.
     * @param {string} options.ownerId - The ID of the playlist owner.
     * @param {object[]} [options.tracks=[]] - An array of track objects.
     * @param {string} [options.description=''] - An optional description of the playlist.
     * @param {string[]} [options.tags=[]] - Optional tags associated with the playlist.
     * @param {Date} [options.createdAt=new Date()] - The creation date of the playlist.
     * @param {Date} [options.updatedAt=new Date()] - The last update date of the playlist.
     */
    constructor({
      id,
      title,
      ownerId,
      tracks = [],
      description = '',
      tags = [],
      createdAt = new Date(),
      updatedAt = new Date(),
    }) {
      if (!id || !title || !ownerId) {
        throw new Error('ID, title, and ownerId are required.');
      }
  
      this.id = id;
      this.title = title;
      this.ownerId = ownerId;
      this.tracks = tracks;
      this.description = description;
      this.tags = tags;
      this.createdAt = createdAt;
      this.updatedAt = updatedAt;
    }
  
    /**
     * Adds a track to the playlist.
     *
     * @param {object} track - The track object to add.
     */
    addTrack(track) {
      this.tracks.push(track);
      this.updatedAt = new Date();
    }
  
    /**
     * Removes a track from the playlist by its ID.
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
     * Gets a track from the playlist by its ID.
     *
     * @param {string} trackId - The ID of the track to retrieve.
     * @returns {object|null} The track object, or null if not found.
     */
    getTrack(trackId) {
      return this.tracks.find((track) => track.id === trackId) || null;
    }
  
    /**
     * Gets all tracks in the playlist.
     *
     * @returns {object[]} An array of track objects.
     */
    getTracks() {
      return [...this.tracks];
    }
  
      /**
       * Reorders tracks within the playlist.
       *
       * @param {string} trackId - The ID of the track to move.
       * @param {number} newIndex - The new index for the track.
       * @returns {boolean} True if the track was moved, false otherwise.
       */
      reorderTrack(trackId, newIndex) {
          const index = this.tracks.findIndex((track) => track.id === trackId);
          if (index === -1 || newIndex < 0 || newIndex >= this.tracks.length) {
              return false;
          }
  
          const track = this.tracks.splice(index, 1)[0];
          this.tracks.splice(newIndex, 0, track);
          this.updatedAt = new Date();
          return true;
      }
  
    /**
     * Returns a JSON representation of the Playlist.
     *
     * @returns {object} A JSON object representing the Playlist.
     */
    toJSON() {
      return {
        id: this.id,
        title: this.title,
        ownerId: this.ownerId,
        tracks: this.tracks,
        description: this.description,
        tags: this.tags,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      };
    }
  
      /**
       * Creates a new Playlist object from a JSON object.
       * @param {object} jsonObject - A JSON object representing the Playlist.
       * @returns {Playlist} a new Playlist object.
       */
      static fromJSON(jsonObject){
          return new Playlist(jsonObject);
      }
  }
  
  module.exports = Playlist;