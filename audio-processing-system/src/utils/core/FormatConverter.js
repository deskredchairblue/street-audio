/**
 * FormatConverter.js
 * @description Audio format conversion utilities (e.g., WAV <-> PCM)
 */

const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

class FormatConverter {
  /**
   * Convert an audio file to WAV format using ffmpeg
   * @param {string} inputPath
   * @param {string} outputPath
   * @returns {Promise<string>} - Resolves with outputPath
   */
  static convertToWav(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      const out = outputPath || inputPath.replace(path.extname(inputPath), '.wav');

      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', inputPath,
        '-acodec', 'pcm_s16le',
        '-ac', '2',
        '-ar', '44100',
        out
      ]);

      ffmpeg.stderr.on('data', data => {
        // Optional: log or collect for error reporting
      });

      ffmpeg.on('close', code => {
        if (code === 0) {
          resolve(out);
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Get file extension (e.g., "mp3", "wav")
   * @param {string} filename
   * @returns {string}
   */
  static getExtension(filename) {
    return path.extname(filename).slice(1).toLowerCase();
  }

  /**
   * Check if the format is supported
   * @param {string} format
   * @returns {boolean}
   */
  static isSupportedFormat(format) {
    const supported = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
    return supported.includes(format.toLowerCase());
  }
}

module.exports = FormatConverter;
