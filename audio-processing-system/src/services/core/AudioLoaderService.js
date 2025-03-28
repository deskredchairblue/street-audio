const fs = require('fs');
const axios = require('axios');
const path = require('path');
const { parseFile } = require('music-metadata');

class AudioLoaderService {
  /**
   * Load audio from a local file path
   * @param {string} filePath
   * @returns {Promise<Object>}
   */
  async loadFile(filePath) {
    const buffer = fs.readFileSync(filePath);
    const metadata = await parseFile(filePath);

    return {
      id: null,
      path: filePath,
      title: metadata.common.title || path.basename(filePath),
      format: metadata.format.container || 'unknown',
      duration: metadata.format.duration || 0,
      channels: metadata.format.numberOfChannels || 2,
      sampleRate: metadata.format.sampleRate || 44100,
      bitDepth: metadata.format.bitsPerSample || 16,
      metadata,
      buffer
    };
  }

  /**
   * Load audio from a remote URL
   * @param {string} url
   * @returns {Promise<Object>}
   */
  async loadUrl(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    // Save to temp file (optional, for metadata parsing)
    const tempPath = path.join(__dirname, '../../../temp', `temp-${Date.now()}.audio`);
    fs.writeFileSync(tempPath, buffer);

    const metadata = await parseFile(tempPath);
    fs.unlinkSync(tempPath); // Clean up

    return {
      id: null,
      sourceUrl: url,
      title: metadata.common.title || 'Remote Track',
      format: metadata.format.container || 'unknown',
      duration: metadata.format.duration || 0,
      channels: metadata.format.numberOfChannels || 2,
      sampleRate: metadata.format.sampleRate || 44100,
      bitDepth: metadata.format.bitsPerSample || 16,
      metadata,
      buffer
    };
  }
}

module.exports = AudioLoaderService;
