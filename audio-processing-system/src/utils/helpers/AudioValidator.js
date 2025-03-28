// src/utils/helpers/AudioValidator.js

const path = require('path');
const supportedExtensions = ['.wav', '.mp3', '.flac', '.ogg', '.aac', '.m4a'];
const maxFileSizeMB = 100;

class AudioValidator {
  /**
   * Validate file extension
   * @param {string} filename 
   * @returns {boolean}
   */
  static isSupportedExtension(filename) {
    const ext = path.extname(filename).toLowerCase();
    return supportedExtensions.includes(ext);
  }

  /**
   * Validate MIME type (if available)
   * @param {string} mimetype 
   * @returns {boolean}
   */
  static isValidMimeType(mimetype) {
    return mimetype.startsWith('audio/');
  }

  /**
   * Validate file size (in bytes)
   * @param {number} fileSize 
   * @returns {boolean}
   */
  static isValidSize(fileSize) {
    return fileSize <= maxFileSizeMB * 1024 * 1024;
  }

  /**
   * Full validation for an uploaded file
   * @param {Object} file { originalname, mimetype, size }
   * @returns {Object} { valid: boolean, reason?: string }
   */
  static validateFile(file) {
    if (!this.isSupportedExtension(file.originalname)) {
      return { valid: false, reason: 'Unsupported file extension' };
    }

    if (!this.isValidMimeType(file.mimetype)) {
      return { valid: false, reason: 'Invalid MIME type' };
    }

    if (!this.isValidSize(file.size)) {
      return { valid: false, reason: 'File exceeds maximum size limit' };
    }

    return { valid: true };
  }
}

module.exports = AudioValidator;
