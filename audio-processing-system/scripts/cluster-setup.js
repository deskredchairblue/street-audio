const os = require('os');
const crypto = require('crypto');
const EventEmitter = require('events');

class ClusterManager extends EventEmitter {
  constructor() {
    super();
    this.nodes = new Map();
  }

  registerNode({ hostname, capabilities }) {
    const nodeId = crypto.randomUUID();
    this.nodes.set(nodeId, {
      hostname,
      capabilities,
      lastSeen: Date.now(),
      status: 'active',
    });

    this.emit('node:registered', { nodeId, hostname });
    return nodeId;
  }

  heartbeat(nodeId) {
    if (this.nodes.has(nodeId)) {
      this.nodes.get(nodeId).lastSeen = Date.now();
      this.emit('node:heartbeat', { nodeId });
    }
  }

  monitorNodes(interval = 10000) {
    setInterval(() => {
      const now = Date.now();
      for (const [nodeId, node] of this.nodes.entries()) {
        if (now - node.lastSeen > 30000) {
          node.status = 'offline';
          this.emit('node:offline', { nodeId });
        }
      }
    }, interval);
  }
}

// Example usage
const cluster = new ClusterManager();

cluster.on('node:registered', ({ nodeId, hostname }) => {
  console.log(`[Cluster] Registered node ${nodeId} (${hostname})`);
});

cluster.on('node:heartbeat', ({ nodeId }) => {
  console.log(`[Cluster] Heartbeat from ${nodeId}`);
});

cluster.on('node:offline', ({ nodeId }) => {
  console.warn(`[Cluster] Node ${nodeId} is offline`);
});

const nodeId = cluster.registerNode({
  hostname: os.hostname(),
  capabilities: ['audio-processing', 'transcription', 'ai-enhancement']
});

// Simulate heartbeats
setInterval(() => {
  cluster.heartbeat(nodeId);
}, 5000);

// Start node monitoring
cluster.monitorNodes();