// src/utils/performance/PerformanceMonitor.js

class PerformanceMonitor {
    constructor() {
      this.snapshots = [];
    }
  
    capture(label = 'snapshot') {
      const mem = process.memoryUsage();
      const cpu = process.cpuUsage();
      const uptime = process.uptime();
  
      const snapshot = {
        label,
        memory: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
        },
        cpu,
        uptime,
        timestamp: Date.now()
      };
  
      this.snapshots.push(snapshot);
      return snapshot;
    }
  
    log(label = 'performance') {
      const snap = this.capture(label);
      console.log(`[${label}] Heap Used: ${snap.memory.heapUsed} | Uptime: ${snap.uptime}s`);
    }
  
    getRecent(n = 5) {
      return this.snapshots.slice(-n);
    }
  }
  
  module.exports = new PerformanceMonitor();
  