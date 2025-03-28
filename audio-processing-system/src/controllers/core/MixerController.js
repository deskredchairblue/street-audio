// src/controllers/core/MixerController.js

class MixerController {
  constructor() {
    this.trackStates = new Map(); // trackId -> { volume, pan, muted, solo }
  }

  setTrack(trackId, options = {}) {
    this.trackStates.set(trackId, {
      volume: options.volume ?? 1.0,
      pan: options.pan ?? 0,
      muted: options.muted ?? false,
      solo: options.solo ?? false
    });
  }

  updateTrack(trackId, options = {}) {
    const state = this.trackStates.get(trackId);
    if (!state) return;

    Object.assign(state, options);
  }

  mute(trackId) {
    const state = this.trackStates.get(trackId);
    if (state) state.muted = true;
  }

  unmute(trackId) {
    const state = this.trackStates.get(trackId);
    if (state) state.muted = false;
  }

  solo(trackId) {
    const state = this.trackStates.get(trackId);
    if (state) state.solo = true;
  }

  unsolo(trackId) {
    const state = this.trackStates.get(trackId);
    if (state) state.solo = false;
  }

  getTrackState(trackId) {
    return this.trackStates.get(trackId) || null;
  }
}

module.exports = new MixerController();