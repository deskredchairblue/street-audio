const EventEmitter = require('events');
const axios = require('axios');

class MicroserviceOrchestration extends EventEmitter {
  constructor(services = {}) {
    super();

    // Example: { streaming: 'http://streaming.local', processing: 'http://processing.local' }
    this.services = services;
    this.serviceStatus = {}; // { serviceName: { status, lastChecked } }
  }

  /**
   * Register a microservice
   * @param {string} name
   * @param {string} url
   */
  register(name, url) {
    this.services[name] = url;
    this.emit('registered', { name, url });
  }

  /**
   * Call a service with fallback + timeout
   * @param {string} name - service name
   * @param {string} endpoint - relative path (e.g., "/process")
   * @param {Object} options - axios config (method, data, headers, etc.)
   */
  async callService(name, endpoint, options = {}) {
    const baseUrl = this.services[name];
    if (!baseUrl) throw new Error(`Service "${name}" not registered.`);

    const url = `${baseUrl}${endpoint}`;
    const defaultTimeout = 8000;

    try {
      const response = await axios({
        url,
        timeout: options.timeout || defaultTimeout,
        ...options,
      });

      this._updateStatus(name, true);
      return response.data;
    } catch (error) {
      this._updateStatus(name, false);
      this.emit('error', { service: name, url, error: error.message });
      throw error;
    }
  }

  /**
   * Check health of all services
   */
  async pingAll(timeout = 3000) {
    const results = {};

    await Promise.all(Object.entries(this.services).map(async ([name, url]) => {
      try {
        const healthUrl = `${url}/health`;
        const res = await axios.get(healthUrl, { timeout });
        results[name] = res.status === 200;
        this._updateStatus(name, true);
      } catch (err) {
        results[name] = false;
        this._updateStatus(name, false);
      }
    }));

    this.emit('healthCheck', results);
    return results;
  }

  /**
   * Internal: Update status of a service
   */
  _updateStatus(name, isAlive) {
    this.serviceStatus[name] = {
      status: isAlive ? 'healthy' : 'unreachable',
      lastChecked: new Date(),
    };
  }

  /**
   * Get current status of a service
   */
  getStatus(name) {
    return this.serviceStatus[name] || { status: 'unknown' };
  }

  /**
   * Broadcast message to all services (POST)
   */
  async broadcast(endpoint, payload = {}, headers = {}) {
    const results = [];

    for (const [name, url] of Object.entries(this.services)) {
      try {
        const res = await axios.post(`${url}${endpoint}`, payload, { headers });
        results.push({ name, success: true, data: res.data });
      } catch (error) {
        this._updateStatus(name, false);
        results.push({ name, success: false, error: error.message });
      }
    }

    return results;
  }
}

module.exports = MicroserviceOrchestration;
