const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');

class ExportService {
  /**
   * Export raw buffer to a specific audio format
   * @param {Buffer} buffer
   * @param {Object} options
   * @returns {Promise<string>} Path to exported file
   */
  async exportToFormat(buffer, options = {}) {
    const {
      format = 'mp3',
      outputDir = path.join(process.cwd(), 'exports'),
      fileName = `export-${uuidv4()}.${format}`
    } = options;

    const inputPath = path.join(outputDir, `temp-${uuidv4()}.raw`);
    const outputPath = path.join(outputDir, fileName);

    // Ensure directory
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(inputPath, buffer);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat(format)
        .on('end', () => {
          fs.unlinkSync(inputPath); // cleanup temp
          resolve(outputPath);
        })
        .on('error', reject)
        .save(outputPath);
    });
  }
}

module.exports = ExportService;
