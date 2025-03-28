class DistributedProcessingModel {
    constructor({ jobId, nodes = [], status = 'pending', metadata = {} }) {
      this.jobId = jobId;
      this.nodes = nodes; // Array of node objects: { id, status, load, latency }
      this.status = status;
      this.createdAt = new Date();
      this.updatedAt = new Date();
      this.metadata = metadata; // e.g., input size, model type, taskType
    }
  
    updateStatus(status) {
      this.status = status;
      this.updatedAt = new Date();
    }
  
    assignNode(node) {
      this.nodes.push({
        id: node.id,
        status: 'assigned',
        load: node.load || 0,
        latency: node.latency || null
      });
      this.updatedAt = new Date();
    }
  
    updateNodeStatus(nodeId, newStatus) {
      const node = this.nodes.find(n => n.id === nodeId);
      if (node) {
        node.status = newStatus;
        node.lastUpdated = new Date();
        this.updatedAt = new Date();
      }
    }
  
    getActiveNodes() {
      return this.nodes.filter(n => n.status === 'processing');
    }
  
    isComplete() {
      return this.nodes.every(n => n.status === 'completed');
    }
  
    toJSON() {
      return {
        jobId: this.jobId,
        status: this.status,
        nodes: this.nodes,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        metadata: this.metadata
      };
    }
  }
  
  module.exports = DistributedProcessingModel;
  