// src/controllers/advanced/HorizontalScalingController.js

const os = require('os');

class HorizontalScalingController {
  constructor(clusterManager) {
    this.clusterManager = clusterManager; // Hook into your process manager (PM2, Kubernetes, etc.)
  }

  async evaluateScaling(metrics) {
    const { cpuUsage, queueLength, averageLatency } = metrics;

    if (cpuUsage > 80 || queueLength > 20 || averageLatency > 1000) {
      return await this.clusterManager.scaleOut();
    }

    if (cpuUsage < 30 && queueLength === 0) {
      return await this.clusterManager.scaleIn();
    }

    return { action: 'no_change' };
  }

  async getSystemStatus() {
    return {
      cpu: os.loadavg(),
      memory: process.memoryUsage(),
      timestamp: new Date(),
    };
  }
}

module.exports = HorizontalScalingController;
