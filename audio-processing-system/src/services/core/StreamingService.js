const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

class StreamingService extends EventEmitter {
  constructor() {
    super();
    this.streams = new Map(); // streamId -> streamState
  }

  /**
   * Create a new stream and register it
   * @param {Object} options
   * @returns {string} streamId
   */
  async createStream(options = {}) {
    const streamId = uuidv4();
    this.streams.set(streamId, {
      id: streamId,
      ...options,
      createdAt: Date.now(),
      chunks: [],
      active: true
    });

    return streamId;
  }

  /**
   * Process an incoming audio chunk
   * @param {string} streamId
   * @param {Buffer} chunk
   * @param {Object} info
   */
  async processAudioChunk(streamId, chunk, info = {}) {
    const stream = this.streams.get(streamId);
    if (!stream || !stream.active) throw new Error('Stream not found or inactive');

    stream.chunks.push(chunk);

    const start = Date.now();
    this.emit(`chunk:${streamId}`, chunk, info);
    const end = Date.now();

    return { processed: true, processingTime: end - start };
  }

  /**
   * Stop and clean up a stream
   * @param {string} streamId
   */
  async stopStream(streamId) {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    stream.active = false;
    this.emit(`end:${streamId}`, stream);
    this.streams.delete(streamId);
  }
}

module.exports = StreamingService;
