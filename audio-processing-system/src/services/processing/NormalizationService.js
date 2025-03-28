// src/services/processing/AudioProcessingService.js
class AudioProcessingService {
  applyEffect(buffer, effect = 'reverse') {
    if (effect === 'reverse') {
      return Buffer.from(buffer.reverse());
    }
    return buffer;
  }
}

module.exports = AudioProcessingService;