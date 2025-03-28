class AudioProject {
    constructor({ id, ownerId, title, tracks = [], createdAt = new Date(), updatedAt = new Date(), settings = {} }) {
      this.id = id;                     // UUID or ObjectId
      this.ownerId = ownerId;           // Associated user
      this.title = title;               // Project name/title
      this.tracks = tracks;             // Array of AudioTrack IDs or objects
      this.createdAt = createdAt;
      this.updatedAt = updatedAt;
      this.settings = settings;         // e.g. bpm, key, grid size
    }
  
    addTrack(track) {
      this.tracks.push(track);
      this.touch();
    }
  
    removeTrack(trackId) {
      this.tracks = this.tracks.filter(t => t.id !== trackId);
      this.touch();
    }
  
    updateSettings(newSettings = {}) {
      this.settings = { ...this.settings, ...newSettings };
      this.touch();
    }
  
    rename(title) {
      this.title = title;
      this.touch();
    }
  
    touch() {
      this.updatedAt = new Date();
    }
  
    toJSON() {
      return {
        id: this.id,
        ownerId: this.ownerId,
        title: this.title,
        tracks: this.tracks,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        settings: this.settings
      };
    }
  }
  
  module.exports = AudioProject;
  