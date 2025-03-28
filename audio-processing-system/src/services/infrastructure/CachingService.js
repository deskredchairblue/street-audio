const NodeCache = require('node-cache');
const crypto = require('crypto');

class CachingService {
  constructor(ttl = 60) {
    this.cache = new NodeCache({ stdTTL: ttl });
  }

  /**
   * Generate a consistent cache key
   */
  static generateKey(...parts) {
    const raw = parts.join(':');
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  /**
   * Save data to cache
   * @param {string} key
   * @param {any} value
   */
  set(key, value, ttl = null) {
    this.cache.set(key, value, ttl);
  }

  /**
   * Retrieve from cache
   * @param {string} key
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * Remove a cached item
   */
  del(key) {
    this.cache.del(key);
  }

  /**
   * Clear all cached items
   */
  flush() {
    this.cache.flushAll();
  }

  /**
   * Middleware to auto-cache route responses (Express)
   */
  middleware(ttl = 60) {
    return (req, res, next) => {
      const key = CachingService.generateKey(req.originalUrl);
      const cached = this.get(key);
      if (cached) return res.json(cached);

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        this.set(key, body, ttl);
        return originalJson(body);
      };

      next();
    };
  }
}

module.exports = CachingService;
