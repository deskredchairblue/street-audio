/**
 * StreamHelper.js
 * @description Streaming utilities for piping, buffering, and managing stream events
 */

const { PassThrough } = require('stream');

class StreamHelper {
  /**
   * Pipe a readable stream to a writable stream with error handling
   * @param {ReadableStream} input
   * @param {WritableStream} output
   * @returns {Promise<void>}
   */
  static pipeWithPromise(input, output) {
    return new Promise((resolve, reject) => {
      input.pipe(output);
      input.on('end', resolve);
      input.on('error', reject);
      output.on('error', reject);
    });
  }

  /**
   * Convert stream to buffer
   * @param {ReadableStream} stream
   * @returns {Promise<Buffer>}
   */
  static streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Creates a pass-through stream
   * @returns {PassThrough}
   */
  static createPassThrough() {
    return new PassThrough();
  }

  /**
   * Pipe a stream and log its size
   * @param {ReadableStream} stream
   * @param {WritableStream} destination
   * @param {function(number):void} onSizeLogged
   */
  static pipeAndTrackSize(stream, destination, onSizeLogged) {
    let size = 0;
    stream.on('data', chunk => size += chunk.length);
    stream.on('end', () => onSizeLogged(size));
    stream.pipe(destination);
  }
}

module.exports = StreamHelper;
