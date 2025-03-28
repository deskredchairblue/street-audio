const crypto = require('crypto');

class AudioSecurityService {
  constructor(secret = process.env.SECRET_KEY || 'supersecret') {
    this.secret = secret;
    this.activeTokens = new Set(); // Token whitelist
  }

  /**
   * Generate secure audio access token
   * @param {string} userId
   * @param {string} resourceId
   * @returns {string} token
   */
  generateToken(userId, resourceId) {
    const payload = `${userId}:${resourceId}:${Date.now()}`;
    const token = crypto.createHmac('sha256', this.secret).update(payload).digest('hex');
    this.activeTokens.add(token);
    return token;
  }

  /**
   * Validate access token
   */
  validateToken(token) {
    return this.activeTokens.has(token);
  }

  /**
   * Revoke access token
   */
  revokeToken(token) {
    this.activeTokens.delete(token);
  }

  /**
   * Middleware (Express)
   */
  authMiddleware(req, res, next) {
    const token = req.headers['x-audio-token'];
    if (!token || !this.validateToken(token)) {
      return res.status(403).json({ error: 'Invalid or missing audio token' });
    }
    next();
  }
}

module.exports = AudioSecurityService;
