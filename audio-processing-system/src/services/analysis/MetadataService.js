const mm = require('music-metadata');
const path = require('path');
const fs = require('fs');

class MetadataService {
  /**
   * Extract metadata from a local file path or stream
   * @param {Object} track - Track object or path
   * @returns {Object} metadata
   */
  async extractMetadata(track) {
    try {
      const filePath = track?.path || track;
      const metadata = await mm.parseFile(filePath);

      return {
        title: metadata.common.title || path.basename(filePath),
        artist: metadata.common.artist || 'Unknown',
        album: metadata.common.album || 'Unknown',
        duration: metadata.format.duration || null,
        bitrate: metadata.format.bitrate || null,
        sampleRate: metadata.format.sampleRate || null,
        channels: metadata.format.numberOfChannels || null,
        format: metadata.format.container || null,
        codec: metadata.format.codec || null
      };
    } catch (err) {
      console.error('Metadata extraction error:', err.message);
      return {};
    }
  }
}

module.exports = MetadataService;
