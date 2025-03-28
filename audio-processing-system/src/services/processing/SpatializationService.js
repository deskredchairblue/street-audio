// src/services/processing/SpatializationService.js
class SpatializationService {
  spatialize(buffer, { pan = 0 }) {
    // pan: -1 (left) to 1 (right)
    const leftGain = (1 - pan) / 2;
    const rightGain = (1 + pan) / 2;

    const stereo = Buffer.alloc(buffer.length * 2);
    for (let i = 0; i < buffer.length; i++) {
      stereo[i * 2] = buffer[i] * leftGain;
      stereo[i * 2 + 1] = buffer[i] * rightGain;
    }

    return stereo;
  }
}

module.exports = SpatializationService;