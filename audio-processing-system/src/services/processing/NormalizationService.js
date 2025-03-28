// src/services/processing/NormalizationService.js
class NormalizationService {
  normalize(buffer, targetDb = -1.0) {
    const normalized = Buffer.from(buffer); // shallow clone

    let max = 0;
    for (let i = 0; i < buffer.length; i++) {
      max = Math.max(max, Math.abs(buffer[i]));
    }

    const gain = (255 * Math.pow(10, targetDb / 20)) / max;

    for (let i = 0; i < buffer.length; i++) {
      normalized[i] = buffer[i] * gain;
    }

    return normalized;
  }
}

module.exports = NormalizationService;