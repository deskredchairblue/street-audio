/**
 * BufferUtils.js
 * @description Utilities for handling audio buffers
 */

class BufferUtils {
    /**
     * Merge multiple Float32Array buffers into one
     * @param {Float32Array[]} buffers
     * @returns {Float32Array}
     */
    static merge(buffers) {
      const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
      const result = new Float32Array(totalLength);
      let offset = 0;
  
      for (const buf of buffers) {
        result.set(buf, offset);
        offset += buf.length;
      }
  
      return result;
    }
  
    /**
     * Slice a portion of a Float32Array buffer
     * @param {Float32Array} buffer
     * @param {number} start
     * @param {number} end
     * @returns {Float32Array}
     */
    static slice(buffer, start, end) {
      return buffer.subarray(start, end);
    }
  
    /**
     * Pad a buffer to a desired length with zeros
     * @param {Float32Array} buffer
     * @param {number} length
     * @returns {Float32Array}
     */
    static pad(buffer, length) {
      if (buffer.length >= length) return buffer;
      const padded = new Float32Array(length);
      padded.set(buffer);
      return padded;
    }
  
    /**
     * Convert a Node.js Buffer (from file) to Float32Array
     * @param {Buffer} rawBuffer
     * @returns {Float32Array}
     */
    static toFloat32Array(rawBuffer) {
      const floatArray = new Float32Array(rawBuffer.length / 2);
      for (let i = 0; i < floatArray.length; i++) {
        const int16 = rawBuffer.readInt16LE(i * 2);
        floatArray[i] = int16 / 32768;
      }
      return floatArray;
    }
  }
  
  module.exports = BufferUtils;
  