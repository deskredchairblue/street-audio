const { Readable, Transform } = require('stream');

/**
 * Create a custom readable stream from a buffer
 */
class BufferAudioStream extends Readable {
  constructor(buffer, options = {}) {
    super(options);
    this.buffer = buffer;
    this.sent = false;
  }

  _read() {
    if (!this.sent) {
      this.push(this.buffer);
      this.sent = true;
    } else {
      this.push(null); // End of stream
    }
  }
}

/**
 * Apply gain to audio stream in real-time
 */
class GainTransformStream extends Transform {
  constructor(gain = 1.0, options = {}) {
    super(options);
    this.gain = gain;
  }

  _transform(chunk, encoding, callback) {
    const output = Buffer.alloc(chunk.length);

    for (let i = 0; i < chunk.length; i++) {
      let sample = chunk[i] * this.gain;
      sample = Math.min(255, Math.max(0, sample)); // clamp value
      output[i] = sample;
    }

    this.push(output);
    callback();
  }
}

module.exports = {
  BufferAudioStream,
  GainTransformStream
};