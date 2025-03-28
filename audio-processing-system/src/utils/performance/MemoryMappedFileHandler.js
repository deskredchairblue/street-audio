// src/utils/performance/MemoryMappedFileHandler.js

const fs = require('fs');
const mmap = require('mmap-io'); // you’ll need to install this: `npm i mmap-io`

class MemoryMappedFileHandler {
  /**
   * Memory-map a file for efficient I/O
   * @param {string} filePath 
   * @returns {Buffer} Mapped buffer
   */
  static map(filePath) {
    const fd = fs.openSync(filePath, 'r');
    const stats = fs.fstatSync(fd);
    const length = stats.size;

    const buffer = mmap.map(length, mmap.PROT_READ, mmap.MAP_SHARED, fd, 0);
    fs.closeSync(fd);

    return buffer;
  }

  /**
   * Unmap buffer (requires GC or external tools in Node)
   */
  static unmap(buffer) {
    // Unmapping is automatic in modern Node versions via GC
    // Can trigger manual cleanup if needed
  }
}

module.exports = MemoryMappedFileHandler;
