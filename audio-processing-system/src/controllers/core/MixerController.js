// src/controllers/core/PlaybackController.js

class PlaybackController {
  constructor() {
    this.sessions = new Map(); // sessionId -> playback state
  }

  createSession(sessionId, options = {}) {
    this.sessions.set(sessionId, {
      isPlaying: false,
      currentTime: 0,
      loop: options.loop || false,
      duration: options.duration || 0
    });
  }

  play(sessionId) {
    const state = this.sessions.get(sessionId);
    if (state) state.isPlaying = true;
  }

  pause(sessionId) {
    const state = this.sessions.get(sessionId);
    if (state) state.isPlaying = false;
  }

  stop(sessionId) {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.isPlaying = false;
      state.currentTime = 0;
    }
  }

  seek(sessionId, time) {
    const state = this.sessions.get(sessionId);
    if (state && time >= 0 && time <= state.duration) {
      state.currentTime = time;
    }
  }

  getState(sessionId) {
    return this.sessions.get(sessionId) || null;
  }
}

module.exports = new PlaybackController();