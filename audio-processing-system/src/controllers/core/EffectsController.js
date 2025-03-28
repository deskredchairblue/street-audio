// src/controllers/core/EffectsController.js

class EffectsController {
  constructor() {
    this.effectsMap = new Map(); // trackId -> [ { name, params } ]
  }

  applyEffect(trackId, effect) {
    const effects = this.effectsMap.get(trackId) || [];
    effects.push(effect);
    this.effectsMap.set(trackId, effects);
  }

  removeEffect(trackId, effectName) {
    const effects = this.effectsMap.get(trackId) || [];
    const filtered = effects.filter(e => e.name !== effectName);
    this.effectsMap.set(trackId, filtered);
  }

  updateEffect(trackId, effectName, newParams) {
    const effects = this.effectsMap.get(trackId) || [];
    const updated = effects.map(effect => 
      effect.name === effectName ? { ...effect, params: newParams } : effect
    );
    this.effectsMap.set(trackId, updated);
  }

  getEffects(trackId) {
    return this.effectsMap.get(trackId) || [];
  }
}

module.exports = new EffectsController();