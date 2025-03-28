// src/utils/performance/ZeroCopyBufferManager.js

class ZeroCopyBufferManager {
    /**
     * Create a buffer view (slice) without copying memory
     * @param {Buffer} buffer 
     * @param {number} start 
     * @param {number} end 
     * @returns {Buffer}
     */
    static slice(buffer, start = 0, end = buffer.length) {
      return buffer.subarray(start, end); // zero-copy buffer view
    }
  
    /**
     * Merge multiple buffers efficiently
     * @param {Buffer[]} buffers 
     * @returns {Buffer}
     */
    static merge(buffers) {
      return Buffer.concat(buffers);
    }
  
    /**
     * Get a typed array view (e.g., Float32Array)
     * @param {Buffer} buffer 
     * @param {string} type 
     * @returns {TypedArray}
     */
    static getTypedArray(buffer, type = 'Float32Array') {
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      return new global[type](arrayBuffer);
    }
  }
  
  module.exports = ZeroCopyBufferManager;
  