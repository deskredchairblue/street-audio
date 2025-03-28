/**
 * @module controllers/advanced/ClusterManagementController
 * @description Manages distributed audio processing resources across clustered nodes
 * 
 * This controller provides a comprehensive framework for orchestrating audio processing
 * workloads across distributed compute resources. It implements advanced scheduling algorithms,
 * fault-tolerant job distribution, and dynamic resource allocation to maximize processing
 * efficiency and throughput in distributed environments.
 */

'use strict';

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const logger = require('../../utils/helpers/AudioLogger');
const clusterConfig = require('../../config/cluster');
const DistributedProcessingModel = require('../../models/advanced/DistributedProcessingModel');

/**
 * Manages a distributed cluster of processing nodes for audio workloads
 * 
 * @class ClusterManagementController
 * @extends EventEmitter
 */
class ClusterManagementController extends EventEmitter {
  /**
   * Create a new ClusterManagementController instance
   * 
   * @param {Object} options - Controller configuration options
   * @param {Object} [options.discoveryAdapter] - Custom service discovery adapter
   * @param {Object} [options.messageAdapter] - Custom message transport adapter
   * @param {Function} [options.loadBalancingStrategy] - Custom load balancing function
   */
  constructor(options = {}) {
    super();
    
    this.nodeId = options.nodeId || clusterConfig.core.nodeId || this._generateNodeId();
    this.role = options.role || clusterConfig.core.mode;
    
    // Auto-detect role if set to 'auto'
    if (this.role === 'auto') {
      this.role = this._determineOptimalRole();
    }
    
    // Initialize internal state
    this.nodes = new Map();
    this.jobs = new Map();
    this.resourceCapacity = this._calculateResourceCapacity();
    this.metrics = this._initializeMetrics();
    
    // Initialize adapters with dependency injection support
    this.discoveryAdapter = options.discoveryAdapter || this._createDiscoveryAdapter();
    this.messageAdapter = options.messageAdapter || this._createMessageAdapter();
    this.loadBalancer = options.loadBalancingStrategy || this._createLoadBalancer();
    
    // Configure heartbeat and monitoring
    this.heartbeatInterval = null;
    this.monitoringInterval = null;
    
    logger.info('ClusterManagementController initialized', {
      nodeId: this.nodeId,
      role: this.role,
      cpuCores: this.resourceCapacity.cpuCores,
      memoryMB: Math.floor(this.resourceCapacity.memoryBytes / (1024 * 1024))
    });
  }
  
  /**
   * Initialize the cluster controller and join the cluster
   * 
   * @async
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      // Skip initialization if clustering is disabled
      if (!clusterConfig.core.enabled) {
        logger.info('Cluster mode disabled, operating in standalone mode');
        return true;
      }
      
      // Initialize discovery adapter
      await this.discoveryAdapter.initialize();
      
      // Initialize message transport
      await this.messageAdapter.initialize();
      
      // Register message handlers
      this._registerMessageHandlers();
      
      // Start heartbeat mechanism
      this._startHeartbeat();
      
      // Start resource monitoring
      this._startMonitoring();
      
      // Announce node to the cluster
      await this._announceNode();
      
      // Discover existing nodes
      await this._discoverNodes();
      
      // Emit initialization event
      this.emit('initialized', {
        nodeId: this.nodeId,
        role: this.role,
        clusterSize: this.nodes.size + 1 // +1 for self
      });
      
      logger.info('Cluster controller initialized', {
        nodeId: this.nodeId,
        role: this.role,
        clusterSize: this.nodes.size + 1
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize cluster controller', {
        error: error.message,
        stack: error.stack
      });
      
      // Emit error event
      this.emit('error', error);
      
      return false;
    }
  }
  
  /**
   * Distribute an audio processing job across the cluster
   * 
   * @async
   * @param {DistributedProcessingModel} job - Processing job to distribute
   * @returns {Promise<Object>} Job execution information
   */
  async distributeJob(job) {
    const operationId = logger.startTimer('distribute-job', { jobId: job.jobId });
    
    try {
      // Verify job model is valid
      if (!(job instanceof DistributedProcessingModel)) {
        throw new Error('Invalid job model. Must be an instance of DistributedProcessingModel.');
      }
      
      // Create work units based on distribution strategy if not already created
      if (job.workUnits.length === 0) {
        // Retrieve file metadata from job parameters
        const audioMetadata = await this._retrieveAudioMetadata(job);
        
        // Generate work units
        job.createWorkUnits(audioMetadata);
        
        logger.debug('Created work units for job', {
          jobId: job.jobId,
          unitsCount: job.workUnits.length,
          strategy: job.distributionStrategy.type
        });
      }
      
      // Register job in controller
      this.jobs.set(job.jobId, job);
      
      // Start job execution
      job.start();
      
      // If operating in standalone mode or as worker only
      if (!clusterConfig.core.enabled || this.role === 'worker') {
        await this._processJobLocally(job);
      } else {
        // Distribute job across available nodes
        await this._distributeWorkUnits(job);
      }
      
      // Track job completion
      this._trackJobCompletion(job);
      
      logger.stopTimer(operationId, {
        unitsCount: job.workUnits.length,
        status: job.executionState.status
      });
      
      return {
        jobId: job.jobId,
        status: job.executionState.status,
        workUnits: job.workUnits.length,
        distribution: this.role === 'master' ? 'distributed' : 'local'
      };
    } catch (error) {
      logger.stopTimer(operationId, { error: error.message });
      
      // Mark job as failed
      if (job) {
        job.fail(error);
      }
      
      throw error;
    }
  }
  
  /**
   * Get the status of a distributed job
   * 
   * @param {string} jobId - Job identifier
   * @returns {Object} Job status information
   */
  getJobStatus(jobId) {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      throw new Error(`Job with ID ${jobId} not found.`);
    }
    
    return job.generateStatusReport();
  }
  
  /**
   * Cancel a distributed job
   * 
   * @async
   * @param {string} jobId - Job identifier
   * @returns {Promise<boolean>} Success status
   */
  async cancelJob(jobId) {
    const operationId = logger.startTimer('cancel-job', { jobId });
    
    try {
      const job = this.jobs.get(jobId);
      
      if (!job) {
        throw new Error(`Job with ID ${jobId} not found.`);
      }
      
      // If operating in standalone mode or as worker
      if (!clusterConfig.core.enabled || this.role === 'worker') {
        job.cancel();
      } else {
        // Send cancellation messages to all nodes with assigned work units
        const nodesWithUnits = new Set();
        job.workUnits.forEach(unit => {
          if (unit.assignedNode) {
            nodesWithUnits.add(unit.assignedNode);
          }
        });
        
        // Send cancellation message to each node
        const cancellationPromises = Array.from(nodesWithUnits).map(nodeId => {
          return this.messageAdapter.sendMessage(nodeId, {
            type: 'job:cancel',
            jobId,
            senderId: this.nodeId
          });
        });
        
        await Promise.all(cancellationPromises);
        
        // Update local job status
        job.cancel();
      }
      
      logger.stopTimer(operationId, { status: 'cancelled' });
      
      return true;
    } catch (error) {
      logger.stopTimer(operationId, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Retrieve cluster metrics and state information
   * 
   * @returns {Object} Comprehensive cluster state and metrics
   */
  getClusterState() {
    // Collect node information
    const nodesList = Array.from(this.nodes.entries()).map(([nodeId, node]) => ({
      id: nodeId,
      role: node.role,
      status: node.status,
      lastSeen: node.lastSeen,
      resources: node.resources,
      activeJobs: node.activeJobs || 0
    }));
    
    // Add self to the list
    nodesList.push({
      id: this.nodeId,
      role: this.role,
      status: 'active',
      lastSeen: Date.now(),
      resources: this.resourceCapacity,
      activeJobs: this.jobs.size
    });
    
    // Calculate cluster capacity
    const totalCapacity = nodesList.reduce((capacity, node) => {
      capacity.cpuCores += node.resources.cpuCores || 0;
      capacity.memoryBytes += node.resources.memoryBytes || 0;
      return capacity;
    }, { cpuCores: 0, memoryBytes: 0 });
    
    // Retrieve job statistics
    const jobStats = {
      total: this.jobs.size,
      running: 0,
      completed: 0,
      failed: 0,
      pending: 0
    };
    
    for (const job of this.jobs.values()) {
      jobStats[job.executionState.status]++;
    }
    
    return {
      selfId: this.nodeId,
      selfRole: this.role,
      clusterSize: nodesList.length,
      nodes: nodesList,
      capacity: totalCapacity,
      jobs: jobStats,
      metrics: this.metrics
    };
  }
  
  /**
   * Shutdown the cluster controller and leave the cluster
   * 
   * @async
   * @returns {Promise<boolean>} Success status
   */
  async shutdown() {
    try {
      // Skip shutdown if clustering is disabled
      if (!clusterConfig.core.enabled) {
        return true;
      }
      
      // Stop heartbeat and monitoring
      this._stopHeartbeat();
      this._stopMonitoring();
      
      // Cancel all active jobs
      const cancelPromises = [];
      for (const [jobId, job] of this.jobs.entries()) {
        if (['running', 'pending'].includes(job.executionState.status)) {
          cancelPromises.push(this.cancelJob(jobId).catch(err => {
            logger.warn(`Failed to cancel job ${jobId} during shutdown: ${err.message}`);
          }));
        }
      }
      
      await Promise.all(cancelPromises);
      
      // Announce departure from cluster
      await this._announceNodeDeparture();
      
      // Shutdown adapters
      await this.discoveryAdapter.shutdown();
      await this.messageAdapter.shutdown();
      
      logger.info('Cluster controller shutdown complete', { nodeId: this.nodeId });
      
      return true;
    } catch (error) {
      logger.error('Error during cluster controller shutdown', {
        error: error.message,
        stack: error.stack
      });
      
      return false;
    }
  }
  
  /**
   * Register node information from discovery mechanism
   * 
   * @param {Object} nodeInfo - Discovered node information
   * @returns {boolean} Success status
   */
  registerNode(nodeInfo) {
    // Skip self-registration
    if (nodeInfo.id === this.nodeId) {
      return false;
    }
    
    // Create or update node entry
    const existingNode = this.nodes.get(nodeInfo.id);
    
    const updatedNode = {
      id: nodeInfo.id,
      role: nodeInfo.role,
      status: nodeInfo.status || 'active',
      address: nodeInfo.address,
      resources: nodeInfo.resources || {},
      capabilities: nodeInfo.capabilities || [],
      lastSeen: Date.now(),
      heartbeats: existingNode ? existingNode.heartbeats + 1 : 1
    };
    
    this.nodes.set(nodeInfo.id, updatedNode);
    
    // Emit node registration event
    this.emit('node:registered', { node: updatedNode });
    
    logger.debug('Node registered in cluster', {
      nodeId: nodeInfo.id,
      role: nodeInfo.role
    });
    
    return true;
  }
  
  /**
   * Handle node heartbeat message
   * 
   * @param {Object} heartbeat - Heartbeat message data
   * @returns {boolean} Success status
   */
  handleHeartbeat(heartbeat) {
    const { nodeId, timestamp, metrics } = heartbeat;
    
    // Skip self-heartbeats
    if (nodeId === this.nodeId) {
      return false;
    }
    
    // Update node information
    const node = this.nodes.get(nodeId);
    
    if (!node) {
      logger.warn('Received heartbeat from unknown node', { nodeId });
      return false;
    }
    
    node.lastSeen = Date.now();
    node.heartbeats++;
    
    // Update node metrics if provided
    if (metrics) {
      node.metrics = metrics;
      
      // Update resource usage if available
      if (metrics.resources) {
        node.resources = {
          ...node.resources,
          ...metrics.resources
        };
      }
      
      // Update active jobs count if available
      if (metrics.activeJobs !== undefined) {
        node.activeJobs = metrics.activeJobs;
      }
    }
    
    return true;
  }
  
  /**
   * Process work unit result from a worker node
   * 
   * @async
   * @param {Object} resultData - Work unit result data
   * @returns {Promise<boolean>} Success status
   */
  async processWorkUnitResult(resultData) {
    const { jobId, unitId, result, error } = resultData;
    
    // Find the job
    const job = this.jobs.get(jobId);
    
    if (!job) {
      logger.warn('Received result for unknown job', { jobId, unitId });
      return false;
    }
    
    try {
      if (error) {
        // Update work unit with error
        job.updateWorkUnit(unitId, {
          status: 'failed',
          error: error,
          progress: 0
        });
        
        logger.warn('Work unit failed', { jobId, unitId, error });
      } else {
        // Update work unit with result
        job.updateWorkUnit(unitId, {
          status: 'completed',
          result: result,
          progress: 100
        });
        
        logger.debug('Work unit completed', { jobId, unitId });
      }
      
      return true;
    } catch (err) {
      logger.error('Error processing work unit result', {
        jobId,
        unitId,
        error: err.message
      });
      
      return false;
    }
  }
  
  /**
   * Process a work unit assigned from the master node
   * 
   * @async
   * @param {Object} unitData - Work unit data and metadata
   * @returns {Promise<Object>} Processing result
   */
  async processWorkUnit(unitData) {
    const { jobId, unitId, operations, parameters } = unitData;
    const operationId = logger.startTimer('process-work-unit', { unitId });
    
    try {
      logger.debug('Processing work unit', { unitId, jobId });
      
      // Create work context
      const context = {
        jobId,
        unitId,
        nodeId: this.nodeId,
        startTime: Date.now()
      };
      
      // Execute operations sequence
      const result = await this._executeOperations(operations, parameters, context);
      
      logger.stopTimer(operationId, { status: 'completed' });
      
      return {
        unitId,
        jobId,
        result,
        processingTime: Date.now() - context.startTime,
        processorId: this.nodeId
      };
    } catch (error) {
      logger.stopTimer(operationId, { error: error.message });
      
      return {
        unitId,
        jobId,
        error: error.message,
        processorId: this.nodeId
      };
    }
  }
  
  /**
   * Dynamically scale worker nodes based on current workload
   * 
   * @async
   * @param {Object} options - Scaling configuration
   * @param {number} [options.targetCount] - Target node count
   * @returns {Promise<Object>} Scaling operation result
   */
  async scaleWorkerNodes(options = {}) {
    if (this.role !== 'master') {
      throw new Error('Only master nodes can perform scaling operations');
    }
    
    // Calculate optimal scaling based on workload if targetCount not specified
    const targetCount = options.targetCount || this._calculateOptimalNodeCount();
    
    // Implementation depends on deployment environment (K8s, Docker Swarm, etc.)
    // This is a placeholder for the actual implementation
    logger.info('Scaling worker nodes', {
      currentCount: this.nodes.size,
      targetCount
    });
    
    return {
      success: true,
      previousCount: this.nodes.size,
      targetCount
    };
  }
  
  /**
   * Generate a unique node identifier
   * 
   * @private
   * @returns {string} Unique node ID
   */
  _generateNodeId() {
    const hostname = os.hostname();
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return `node-${hostname}-${randomSuffix}`;
  }
  
  /**
   * Determine optimal node role based on system capabilities
   * 
   * @private
   * @returns {string} Optimal node role ('master' or 'worker')
   */
  _determineOptimalRole() {
    // Calculate system capability score
    const cpuCount = os.cpus().length;
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    
    // Simple heuristic: Higher-spec machines tend to be better masters
    const capabilityScore = (cpuCount * 10) + (totalMemory / (1024 * 1024 * 1024));
    
    // Default to worker unless system has significant resources
    return capabilityScore > 40 ? 'master' : 'worker';
  }
  
  /**
   * Calculate node resource capacity
   * 
   * @private
   * @returns {Object} Resource capacity information
   */
  _calculateResourceCapacity() {
    const cpuInfo = os.cpus();
    
    return {
      cpuCores: cpuInfo.length,
      cpuModel: cpuInfo[0].model,
      cpuSpeed: cpuInfo[0].speed,
      memoryBytes: os.totalmem(),
      platform: os.platform(),
      architecture: os.arch(),
      allocatableCores: Math.max(1, Math.floor(cpuInfo.length * clusterConfig.workload.resources.capacity.cpuAllocation)),
      allocatableMemory: Math.floor(os.totalmem() * clusterConfig.workload.resources.capacity.memoryAllocation)
    };
  }
  
  /**
   * Initialize metrics collection
   * 
   * @private
   * @returns {Object} Metrics data structure
   */
  _initializeMetrics() {
    return {
      startTime: Date.now(),
      jobsProcessed: 0,
      workUnitsProcessed: 0,
      successRate: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      nodeCommunication: {
        messagesSent: 0,
        messagesReceived: 0,
        bytesTransferred: 0
      },
      resourceUtilization: {
        cpuUsage: 0,
        memoryUsage: 0,
        networkBandwidth: 0
      }
    };
  }
  
  /**
   * Create a service discovery adapter based on configuration
   * 
   * @private
   * @returns {Object} Discovery adapter instance
   */
  _createDiscoveryAdapter() {
    const mechanism = clusterConfig.coordination.discovery.mechanism;
    
    // Simplified implementation with a basic adapter factory
    // In production, this would dynamically load appropriate adapters
    const adapter = {
      initialize: async () => {
        logger.debug(`Initializing ${mechanism} discovery adapter`);
        return true;
      },
      discoverNodes: async () => {
        // Mock implementation that would be replaced with actual discovery
        return [];
      },
      announceNode: async (nodeInfo) => {
        logger.debug('Announcing node to cluster', { nodeId: nodeInfo.id });
        return true;
      },
      announceNodeDeparture: async (nodeId) => {
        logger.debug('Announcing node departure', { nodeId });
        return true;
      },
      shutdown: async () => {
        logger.debug('Shutting down discovery adapter');
        return true;
      }
    };
    
    return adapter;
  }
  
  /**
   * Create a message transport adapter based on configuration
   * 
   * @private
   * @returns {Object} Message adapter instance
   */
  _createMessageAdapter() {
    const protocol = clusterConfig.communication.protocol.primary;
    
    // Simplified implementation with a basic adapter factory
    // In production, this would dynamically load appropriate adapters
    const adapter = {
      initialize: async () => {
        logger.debug(`Initializing ${protocol} message adapter`);
        return true;
      },
      sendMessage: async (nodeId, message) => {
        logger.debug('Sending message to node', { 
          nodeId, 
          messageType: message.type
        });
        
        // Update metrics
        this.metrics.nodeCommunication.messagesSent++;
        this.metrics.nodeCommunication.bytesTransferred += 
          Buffer.from(JSON.stringify(message)).length;
        
        return true;
      },
      subscribeToMessages: (callback) => {
        // This would set up message reception in a real implementation
        logger.debug('Subscribing to incoming messages');
      },
      shutdown: async () => {
        logger.debug('Shutting down message adapter');
        return true;
      }
    };
    
    return adapter;
  }
  
  /**
   * Create a load balancing strategy based on configuration
   * 
   * @private
   * @returns {Function} Load balancing function
   */
  _createLoadBalancer() {
    const strategy = clusterConfig.workload.distribution.loadBalancing;
    
    // Different load balancing algorithms
    switch (strategy) {
      case 'round-robin':
        return this._roundRobinLoadBalancer.bind(this);
        
      case 'least-loaded':
        return this._leastLoadedBalancer.bind(this);
        
      case 'weighted':
        return this._weightedLoadBalancer.bind(this);
        
      case 'auto':
      default:
        return this._adaptiveLoadBalancer.bind(this);
    }
  }
  
  /**
   * Register message handlers for different message types
   * 
   * @private
   */
  _registerMessageHandlers() {
    // This would set up handlers for different message types
    this.messageAdapter.subscribeToMessages((message, sender) => {
      try {
        const { type } = message;
        
        // Update metrics
        this.metrics.nodeCommunication.messagesReceived++;
        this.metrics.nodeCommunication.bytesTransferred += 
          Buffer.from(JSON.stringify(message)).length;
        
        switch (type) {
          case 'heartbeat':
            this.handleHeartbeat(message);
            break;
            
          case 'node:announce':
            this.registerNode(message.node);
            break;
            
          case 'node:departure':
            this._handleNodeDeparture(message.nodeId);
            break;
            
          case 'work:assign':
            this._handleWorkAssignment(message);
            break;
            
          case 'work:result':
            this.processWorkUnitResult(message);
            break;
            
          case 'job:cancel':
            this._handleJobCancellation(message);
            break;
            
          default:
            logger.warn('Received unknown message type', { 
              type, 
              sender 
            });
        }
      } catch (error) {
        logger.error('Error handling message', {
          error: error.message,
          sender
        });
      }
    });
  }
  
  /**
   * Start regular heartbeat to announce node presence
   * 
   * @private
   */
  _startHeartbeat() {
    const interval = clusterConfig.coordination.consensus.heartbeatInterval;
    
    this.heartbeatInterval = setInterval(() => {
      try {
        // Skip heartbeat if clustering is disabled
        if (!clusterConfig.core.enabled) {
          return;
        }
        
        // Prepare heartbeat message
        const heartbeat = {
          type: 'heartbeat',
          nodeId: this.nodeId,
          role: this.role,
          timestamp: Date.now(),
          metrics: {
            resources: {
              cpuUsage: this._getCurrentCpuUsage(),
              memoryUsage: this._getCurrentMemoryUsage()
            },
            activeJobs: this.jobs.size
          }
        };
        
        // Send heartbeat to all known nodes
        for (const [nodeId, node] of this.nodes.entries()) {
          this.messageAdapter.sendMessage(nodeId, heartbeat).catch(err => {
            logger.warn(`Failed to send heartbeat to ${nodeId}: ${err.message}`);
          });
        }
      } catch (error) {
        logger.error('Error in heartbeat mechanism', { error: error.message });
      }
    }, interval);
  }
  
  /**
   * Stop heartbeat mechanism
   * 
   * @private
   */
  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  /**
   * Start node monitoring and health checks
   * 
   * @private
   */
  _startMonitoring() {
    const interval = clusterConfig.resilience.healthCheck.interval;
    
    this.monitoringInterval = setInterval(() => {
      try {
        // Skip if clustering is disabled
        if (!clusterConfig.core.enabled) {
          return;
        }
        
        // Check node health and remove unreachable nodes
        const now = Date.now();
        const timeoutThreshold = now - (clusterConfig.coordination.consensus.heartbeatInterval * 
          clusterConfig.resilience.recovery.nodeRemovalThreshold);
        
        for (const [nodeId, node] of this.nodes.entries()) {
          if (node.lastSeen < timeoutThreshold) {
            logger.warn(`Node ${nodeId} has not sent heartbeat, removing from cluster`, {
              lastSeen: new Date(node.lastSeen).toISOString(),
              timeSinceLastSeen: now - node.lastSeen
            });
            
            // Handle node failure
            this._handleNodeFailure(nodeId);
            
            // Remove node from list
            this.nodes.delete(nodeId);
            
            // Emit node departure event
            this.emit('node:departed', { nodeId });
          }
        }
        
        // Update resource utilization metrics
        this.metrics.resourceUtilization = {
          cpuUsage: this._getCurrentCpuUsage(),
          memoryUsage: this._getCurrentMemoryUsage(),
          networkBandwidth: 0 // Would be implemented with actual monitoring
        };
        
        // Dynamic scaling if master node
        if (this.role === 'master' && clusterConfig.scaling.autoScaling.enabled) {
          this._evaluateAutoScaling();
        }
      } catch (error) {
        logger.error('Error in monitoring', { error: error.message });
      }
    }, interval);
  }
  
  /**
   * Stop monitoring
   * 
   * @private
   */
  _stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
  
  /**
   * Announce this node to the cluster
   * 
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async _announceNode() {
    const nodeInfo = {
      id: this.nodeId,
      role: this.role,
      address: this._getNodeAddress(),
      resources: this.resourceCapacity,
      status: 'active',
      capabilities: this._getNodeCapabilities()
    };
    
    await this.discoveryAdapter.announceNode(nodeInfo);
    
    logger.info('Node announced to cluster', { 
      nodeId: this.nodeId, 
      role: this.role 
    });
  }
  
  /**
   * Announce node departure from the cluster
   * 
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async _announceNodeDeparture() {
    await this.discoveryAdapter.announceNodeDeparture(this.nodeId);
    
    // Send departure message to all known nodes
    const departureMsg = {
      type: 'node:departure',
      nodeId: this.nodeId,
      timestamp: Date.now()
    };
    
    for (const nodeId of this.nodes.keys()) {
      await this.messageAdapter.sendMessage(nodeId, departureMsg).catch(() => {
        // Ignore errors when sending departure messages
      });
    }
    
    logger.info('Node departure announced', { nodeId: this.nodeId });
  }
  
  /**
   * Discover existing nodes in the cluster
   * 
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async _discoverNodes() {
    const discoveredNodes = await this.discoveryAdapter.discoverNodes();
    
    for (const node of discoveredNodes) {
      // Skip self
      if (node.id === this.nodeId) {
        continue;
      }
      
      this.registerNode(node);
    }
    
    logger.info('Discovered nodes in cluster', { 
      count: discoveredNodes.length,
      nodeIds: discoveredNodes.map(n => n.id).join(', ')
    });
  }
  
  /**
   * Get current node address for communication
   * 
  * @private
 * @returns {string} Node address
 */
_getNodeAddress() {
    // In a real implementation, this would determine the appropriate
    // network interface and port for communication
    const networkInterfaces = os.networkInterfaces();
    let ipAddress = 'localhost';
    
    // Find a suitable non-internal IPv4 address
    Object.keys(networkInterfaces).some(ifname => {
      return networkInterfaces[ifname].some(iface => {
        if (iface.family === 'IPv4' && !iface.internal) {
          ipAddress = iface.address;
          return true;
        }
        return false;
      });
    });
    
    // Combine with configured port
    const port = clusterConfig.communication.transport.port;
    return `${ipAddress}:${port}`;
  }
  
  /**
   * Get node capabilities for capability-based scheduling
   * 
   * @private
   * @returns {Array<string>} Node capabilities
   */
  _getNodeCapabilities() {
    const capabilities = ['audio-processing'];
    
    // Add hardware-specific capabilities
    const cpuInfo = os.cpus()[0];
    
    if (cpuInfo && cpuInfo.model.includes('Intel')) {
      capabilities.push('intel-cpu');
      
      // Check for AVX support (simplified approach)
      if (cpuInfo.model.includes('AVX')) {
        capabilities.push('avx');
      }
    }
    
    // Add OS-specific capabilities
    capabilities.push(`os-${os.platform()}`);
    
    // Add resource-based capabilities
    if (this.resourceCapacity.cpuCores >= 8) {
      capabilities.push('high-cpu');
    }
    
    if (this.resourceCapacity.memoryBytes >= 16 * 1024 * 1024 * 1024) {
      capabilities.push('high-memory');
    }
    
    // Add configured capabilities from configuration
    const configCapabilities = clusterConfig.workload.resources.capabilities;
    if (configCapabilities && Array.isArray(configCapabilities)) {
      capabilities.push(...configCapabilities);
    }
    
    return capabilities;
  }
  
  /**
   * Get current CPU usage as a percentage
   * 
   * @private
   * @returns {number} CPU usage percentage
   */
  _getCurrentCpuUsage() {
    // In a full implementation, this would use OS-specific methods
    // to get accurate CPU usage. This is a simple placeholder.
    return Math.random() * 30 + 10; // Random value between 10-40%
  }
  
  /**
   * Get current memory usage as a percentage
   * 
   * @private
   * @returns {number} Memory usage percentage
   */
  _getCurrentMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return (usedMem / totalMem) * 100;
  }
  
  /**
   * Handle node failure recovery
   * 
   * @private
   * @param {string} nodeId - ID of the failed node
   */
  _handleNodeFailure(nodeId) {
    logger.info(`Initiating recovery for failed node ${nodeId}`);
    
    // Find all work units assigned to the failed node
    for (const job of this.jobs.values()) {
      const affectedUnits = job.workUnits.filter(unit => 
        unit.assignedNode === nodeId && 
        ['assigned', 'processing'].includes(unit.status)
      );
      
      if (affectedUnits.length === 0) continue;
      
      logger.info(`Recovering ${affectedUnits.length} work units from failed node ${nodeId}`, {
        jobId: job.jobId
      });
      
      // Apply recovery strategy based on configuration
      const recoveryStrategy = clusterConfig.resilience.recovery.strategyOrder[0];
      
      switch (recoveryStrategy) {
        case 'retry':
          // Mark units for retry
          affectedUnits.forEach(unit => {
            job.updateWorkUnit(unit.id, {
              status: 'pending',
              assignedNode: null,
              attempts: unit.attempts + 1
            });
          });
          
          // If master node, reassign the units
          if (this.role === 'master') {
            this._distributeWorkUnits(job, affectedUnits);
          }
          break;
          
        case 'reassign':
          // Similar to retry but with different node selection logic
          affectedUnits.forEach(unit => {
            job.updateWorkUnit(unit.id, {
              status: 'pending',
              assignedNode: null,
              attempts: unit.attempts + 1,
              blacklistedNodes: [...(unit.blacklistedNodes || []), nodeId]
            });
          });
          
          // If master node, reassign the units
          if (this.role === 'master') {
            this._distributeWorkUnits(job, affectedUnits);
          }
          break;
          
        case 'recreate':
          // More aggressive recovery by regenerating work units
          // This would typically be used for stateless operations
          // or when work units can be easily recreated
          job.workUnits = job.workUnits.filter(unit => unit.assignedNode !== nodeId);
          
          // Regenerate the affected work units
          // In a real implementation, this would use job parameters and audio metadata
          // to recreate the necessary work units
          break;
      }
    }
  }
  
  /**
   * Handle job cancellation message
   * 
   * @private
   * @param {Object} message - Cancellation message
   */
  _handleJobCancellation(message) {
    const { jobId, senderId } = message;
    
    logger.info(`Received job cancellation request for ${jobId} from ${senderId}`);
    
    // Find all work units for this job
    const job = this.jobs.get(jobId);
    
    if (!job) {
      logger.warn(`Cannot cancel unknown job ${jobId}`);
      return;
    }
    
    // Cancel the job
    job.cancel();
    
    // Send confirmation if needed
    if (senderId !== this.nodeId) {
      this.messageAdapter.sendMessage(senderId, {
        type: 'job:cancelled',
        jobId,
        nodeId: this.nodeId,
        timestamp: Date.now()
      }).catch(err => {
        logger.warn(`Failed to send cancellation confirmation: ${err.message}`);
      });
    }
  }
  
  /**
   * Handle node departure
   * 
   * @private
   * @param {string} nodeId - ID of the departing node
   */
  _handleNodeDeparture(nodeId) {
    if (!this.nodes.has(nodeId)) {
      return;
    }
    
    logger.info(`Node ${nodeId} has departed from the cluster`);
    
    // Handle graceful departure - may need to redistribute work
    this._handleNodeFailure(nodeId);
    
    // Remove node from list
    this.nodes.delete(nodeId);
    
    // Emit node departure event
    this.emit('node:departed', { nodeId });
  }
  
  /**
   * Handle work unit assignment
   * 
   * @private
   * @async
   * @param {Object} message - Work assignment message
   */
  async _handleWorkAssignment(message) {
    const { jobId, units, jobDefinition } = message;
    
    logger.info(`Received work assignment for job ${jobId} with ${units.length} units`);
    
    // Create or retrieve job
    let job = this.jobs.get(jobId);
    
    if (!job && jobDefinition) {
      // Create new job from definition
      job = new DistributedProcessingModel(jobDefinition);
      this.jobs.set(jobId, job);
      job.start();
    }
    
    if (!job) {
      logger.error(`Cannot process work assignment for unknown job ${jobId}`);
      return;
    }
    
    // Process each assigned work unit
    const processingPromises = units.map(async unit => {
      try {
        // Process the work unit
        const result = await this.processWorkUnit(unit);
        
        // Send result back to coordinator
        await this.messageAdapter.sendMessage(message.senderId, {
          type: 'work:result',
          jobId,
          unitId: unit.unitId,
          result: result.result,
          error: result.error,
          processingTime: result.processingTime,
          processorId: this.nodeId
        });
        
        // Update metrics
        this.metrics.workUnitsProcessed++;
        
        return result;
      } catch (error) {
        logger.error(`Error processing work unit ${unit.unitId}`, {
          error: error.message
        });
        
        // Send error to coordinator
        await this.messageAdapter.sendMessage(message.senderId, {
          type: 'work:result',
          jobId,
          unitId: unit.unitId,
          error: error.message,
          processorId: this.nodeId
        });
        
        return { error: error.message };
      }
    });
    
    // Wait for all units to be processed
    await Promise.all(processingPromises);
  }
  
  /**
   * Evaluate whether to auto-scale the cluster
   * 
   * @private
   */
  _evaluateAutoScaling() {
    if (!clusterConfig.scaling.autoScaling.enabled || this.role !== 'master') {
      return;
    }
    
    const { evaluation } = clusterConfig.scaling.autoScaling;
    const { limits } = clusterConfig.scaling.autoScaling;
    
    // Get current state
    const currentNodeCount = this.nodes.size + 1; // Include self
    const activeJobs = Array.from(this.jobs.values())
      .filter(job => ['running', 'processing'].includes(job.executionState.status));
    
    // Calculate average load
    let avgCpuLoad = this._getCurrentCpuUsage();
    let avgQueueSize = 0;
    
    // Add node metrics if available
    let nodeCount = 1;
    for (const node of this.nodes.values()) {
      if (node.metrics && node.metrics.resources) {
        avgCpuLoad += node.metrics.resources.cpuUsage || 0;
        nodeCount++;
      }
      
      if (node.metrics && node.metrics.jobQueue) {
        avgQueueSize += node.metrics.jobQueue.length || 0;
      }
    }
    
    avgCpuLoad /= nodeCount;
    
    // Check if scaling is needed
    let scalingAction = null;
    
    // Scale up if load is too high or queue is too long
    if ((avgCpuLoad > evaluation.loadThresholdUp || 
         avgQueueSize > evaluation.queueThresholdUp) && 
        currentNodeCount < limits.maxNodes) {
      
      scalingAction = 'up';
    } 
    // Scale down if load is low and queue is short
    else if ((avgCpuLoad < evaluation.loadThresholdDown && 
             avgQueueSize < evaluation.queueThresholdDown) && 
            currentNodeCount > limits.minNodes) {
      
      scalingAction = 'down';
    }
    
    // Execute scaling action if needed
    if (scalingAction === 'up') {
      const targetCount = Math.min(
        limits.maxNodes, 
        currentNodeCount + limits.scaleUpStep
      );
      
      logger.info(`Auto-scaling up from ${currentNodeCount} to ${targetCount} nodes`);
      
      this.scaleWorkerNodes({ targetCount }).catch(err => {
        logger.error(`Auto-scaling up failed: ${err.message}`);
      });
    } else if (scalingAction === 'down') {
      const targetCount = Math.max(
        limits.minNodes, 
        currentNodeCount - limits.scaleDownStep
      );
      
      logger.info(`Auto-scaling down from ${currentNodeCount} to ${targetCount} nodes`);
      
      this.scaleWorkerNodes({ targetCount }).catch(err => {
        logger.error(`Auto-scaling down failed: ${err.message}`);
      });
    }
  }
  
  /**
   * Calculate the optimal node count based on workload
   * 
   * @private
   * @returns {number} Optimal node count
   */
  _calculateOptimalNodeCount() {
    // Get active jobs
    const activeJobs = Array.from(this.jobs.values())
      .filter(job => ['running', 'processing'].includes(job.executionState.status));
    
    // Calculate total pending work units
    let pendingUnits = 0;
    activeJobs.forEach(job => {
      pendingUnits += job.getWorkUnitsByStatus('pending').length;
    });
    
    // Calculate processing capacity
    const avgUnitsPerNode = 5; // This would be dynamically calculated in production
    
    // Calculate needed nodes based on pending work
    const neededNodes = Math.ceil(pendingUnits / avgUnitsPerNode);
    
    // Constrain by configuration limits
    const { minNodes, maxNodes } = clusterConfig.scaling.autoScaling.limits;
    
    return Math.max(minNodes, Math.min(maxNodes, neededNodes));
  }
  
  /**
   * Retrieve audio metadata for work unit creation
   * 
   * @private
   * @async
   * @param {DistributedProcessingModel} job - Processing job
   * @returns {Promise<Object>} Audio metadata
   */
  async _retrieveAudioMetadata(job) {
    // In a real implementation, this would retrieve metadata
    // from the specified file or stream source
    
    // Placeholder implementation
    return {
      duration: 180, // 3 minutes
      sampleRate: 44100,
      channels: 2,
      format: job.taskDefinition.inputFormat,
      fileSize: 30 * 1024 * 1024 // 30 MB
    };
  }
  
  /**
   * Process a job locally (used in standalone mode or by worker nodes)
   * 
   * @private
   * @async
   * @param {DistributedProcessingModel} job - Processing job
   * @returns {Promise<void>}
   */
  async _processJobLocally(job) {
    logger.info(`Processing job ${job.jobId} locally`);
    
    // Get all pending work units
    const pendingUnits = job.getWorkUnitsByStatus('pending');
    
    // Process units sequentially or with limited parallelism
    const maxConcurrent = clusterConfig.workload.resources.limits.maxConcurrentJobs;
    const processUnit = async (unit) => {
      try {
        // Update unit status
        job.updateWorkUnit(unit.id, {
          status: 'processing',
          assignedNode: this.nodeId,
          progress: 0
        });
        
        // Execute operations
        const context = {
          jobId: job.jobId,
          unitId: unit.id,
          nodeId: this.nodeId,
          startTime: Date.now()
        };
        
        const result = await this._executeOperations(
          unit.operations, 
          unit.parameters, 
          context
        );
        
        // Update unit with result
        job.updateWorkUnit(unit.id, {
          status: 'completed',
          progress: 100,
          result
        });
        
        // Update metrics
        this.metrics.workUnitsProcessed++;
        
        return result;
      } catch (error) {
        logger.error(`Error processing unit ${unit.id} locally`, {
          error: error.message
        });
        
        // Update unit with error
        job.updateWorkUnit(unit.id, {
          status: 'failed',
          error: error.message
        });
        
        return { error: error.message };
      }
    };
    
    // Process with limited concurrency
    const concurrentProcess = async () => {
      const active = new Set();
      
      for (const unit of pendingUnits) {
        // Wait if at concurrency limit
        while (active.size >= maxConcurrent) {
          await Promise.race(Array.from(active));
        }
        
        // Start processing and track the promise
        const processPromise = processUnit(unit).finally(() => {
          active.delete(processPromise);
        });
        
        active.add(processPromise);
      }
      
      // Wait for remaining tasks
      await Promise.all(Array.from(active));
    };
    
    await concurrentProcess();
    
    // Finalize job if all units are processed
    if (job.workUnits.every(unit => 
      ['completed', 'failed'].includes(unit.status))) {
      // Complete the job
      job.complete({
        outputLocations: [], // Would be populated in a real implementation
        metrics: {
          processingTime: (Date.now() - job.executionState.startTime) / 1000,
          nodeConcurrency: 1
        }
      });
      
      // Update metrics
      this.metrics.jobsProcessed++;
    }
  }
  
  /**
   * Distribute work units across available nodes
   * 
   * @private
   * @async
   * @param {DistributedProcessingModel} job - Processing job
   * @param {Array<Object>} [specificUnits=null] - Specific units to distribute
   * @returns {Promise<void>}
   */
  async _distributeWorkUnits(job, specificUnits = null) {
    // Get available nodes (workers only)
    const workerNodes = Array.from(this.nodes.values())
      .filter(node => node.role === 'worker' && node.status === 'active');
    
    if (workerNodes.length === 0) {
      logger.warn(`No worker nodes available, processing job ${job.jobId} locally`);
      return this._processJobLocally(job);
    }
    
    // Get units to distribute
    const unitsToDistribute = specificUnits || job.getWorkUnitsByStatus('pending');
    
    if (unitsToDistribute.length === 0) {
      logger.info(`No pending units to distribute for job ${job.jobId}`);
      return;
    }
    
    logger.info(`Distributing ${unitsToDistribute.length} work units for job ${job.jobId}`);
    
    // Group units by node using load balancer
    const nodeAssignments = new Map();
    
    for (const unit of unitsToDistribute) {
      // Use load balancing strategy to select node
      const selectedNode = this.loadBalancer(workerNodes, unit);
      
      if (!selectedNode) {
        logger.warn(`No suitable node found for unit ${unit.id}`);
        continue;
      }
      
      // Add to node assignments
      if (!nodeAssignments.has(selectedNode.id)) {
        nodeAssignments.set(selectedNode.id, []);
      }
      
      nodeAssignments.get(selectedNode.id).push(unit);
      
      // Update unit assignment
      job.assignWorkUnit(unit.id, selectedNode.id);
    }
    
    // Send work to each assigned node
    const assignmentPromises = [];
    
    for (const [nodeId, units] of nodeAssignments.entries()) {
      assignmentPromises.push(
        this.messageAdapter.sendMessage(nodeId, {
          type: 'work:assign',
          jobId: job.jobId,
          units,
          senderId: this.nodeId,
          jobDefinition: units.length > 0 ? {
            jobId: job.jobId,
            processingType: job.processingType,
            taskDefinition: job.taskDefinition,
            distributionStrategy: job.distributionStrategy
          } : null
        }).catch(err => {
          logger.error(`Failed to send work assignment to node ${nodeId}`, {
            error: err.message
          });
          
          // Reset unit assignments on error
          units.forEach(unit => {
            job.updateWorkUnit(unit.id, {
              status: 'pending',
              assignedNode: null
            });
          });
        })
      );
    }
    
    await Promise.all(assignmentPromises);
  }
  
  /**
   * Round-robin load balancing strategy
   * 
   * @private
   * @param {Array<Object>} nodes - Available nodes
   * @param {Object} workUnit - Work unit to assign
   * @returns {Object} Selected node
   */
  _roundRobinLoadBalancer(nodes, workUnit) {
    if (nodes.length === 0) return null;
    
    // Simple round-robin using a static counter
    this._roundRobinCounter = (this._roundRobinCounter || 0) % nodes.length;
    const selectedNode = nodes[this._roundRobinCounter];
    this._roundRobinCounter++;
    
    return selectedNode;
  }
  
  /**
   * Least-loaded balancing strategy
   * 
   * @private
   * @param {Array<Object>} nodes - Available nodes
   * @param {Object} workUnit - Work unit to assign
   * @returns {Object} Selected node
   */
  _leastLoadedBalancer(nodes, workUnit) {
    if (nodes.length === 0) return null;
    
    // Sort nodes by active jobs (least loaded first)
    const sortedNodes = [...nodes].sort((a, b) => {
      const aJobs = a.activeJobs || 0;
      const bJobs = b.activeJobs || 0;
      return aJobs - bJobs;
    });
    
    return sortedNodes[0];
  }
  
  /**
   * Weighted load balancing strategy based on node resources
   * 
   * @private
   * @param {Array<Object>} nodes - Available nodes
   * @param {Object} workUnit - Work unit to assign
   * @returns {Object} Selected node
   */
  _weightedLoadBalancer(nodes, workUnit) {
    if (nodes.length === 0) return null;
    
    // Calculate weights based on available resources
    const nodeWeights = nodes.map(node => {
      // Base weight
      let weight = 1.0;
      
      // Adjust weight based on CPU cores
      if (node.resources && node.resources.cpuCores) {
        weight *= (node.resources.cpuCores / 4); // Normalize to 4 cores
      }
      
      // Adjust for memory
      if (node.resources && node.resources.memoryBytes) {
        weight *= (node.resources.memoryBytes / (8 * 1024 * 1024 * 1024)); // Normalize to 8GB
      }
      
      // Reduce weight if node is busy
      if (node.activeJobs) {
        weight /= (1 + node.activeJobs * 0.2);
      }
      
      // Check for CPU usage if available
      if (node.metrics && node.metrics.resources && 
          node.metrics.resources.cpuUsage !== undefined) {
        const cpuLoad = node.metrics.resources.cpuUsage / 100;
        weight *= (1 - cpuLoad * 0.8); // Reduce weight as CPU load increases
      }
      
      return { node, weight: Math.max(0.1, weight) };
    });
    
    // Weighted random selection
    const totalWeight = nodeWeights.reduce((sum, nw) => sum + nw.weight, 0);
    let randomValue = Math.random() * totalWeight;
    
    for (const { node, weight } of nodeWeights) {
      randomValue -= weight;
      if (randomValue <= 0) {
        return node;
      }
    }
    
    // Fallback to first node
    return nodes[0];
  }
  
  /**
   * Adaptive load balancing strategy that combines multiple approaches
   * 
   * @private
   * @param {Array<Object>} nodes - Available nodes
   * @param {Object} workUnit - Work unit to assign
   * @returns {Object} Selected node
   */
  _adaptiveLoadBalancer(nodes, workUnit) {
    if (nodes.length === 0) return null;
    
    // Filter out blacklisted nodes
    const availableNodes = nodes.filter(node => {
      if (!workUnit.blacklistedNodes) return true;
      return !workUnit.blacklistedNodes.includes(node.id);
    });
    
    if (availableNodes.length === 0) return null;
    
    // Filter for capability requirements if specified
    if (workUnit.requiredCapabilities && workUnit.requiredCapabilities.length > 0) {
      const capableNodes = availableNodes.filter(node => {
        return workUnit.requiredCapabilities.every(cap => 
          node.capabilities && node.capabilities.includes(cap)
        );
      });
      
      if (capableNodes.length > 0) {
        return this._weightedLoadBalancer(capableNodes, workUnit);
      }
    }
    
    // Use weighted balancer for complex assignments
    return this._weightedLoadBalancer(availableNodes, workUnit);
  }
  
  /**
   * Execute a sequence of audio processing operations
   * 
   * @private
   * @async
   * @param {Array<Object>} operations - Operations to execute
   * @param {Object} parameters - Processing parameters
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Processing result
   */
  async _executeOperations(operations, parameters, context) {
    // This would implement the actual audio processing logic
    // For demonstration purposes, we'll simulate processing time
    
    let result = { processed: true };
    
    // Process each operation in sequence
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      
      logger.debug(`Executing operation ${operation.type}`, { 
        unitId: context.unitId,
        operationIndex: i
      });
      
      // Simulate processing time
      await new Promise(resolve => {
        setTimeout(resolve, Math.random() * 1000 + 500);
      });
      
      // Simulate operation result
      result[operation.type] = { completed: true };
    }
    
    // Add processing metadata
    result.processingTime = Date.now() - context.startTime;
    result.processorId = context.nodeId;
    
    return result;
  }
  
  /**
   * Track job completion and clean up resources
   * 
   * @private
   * @param {DistributedProcessingModel} job - Processing job
   */
  _trackJobCompletion(job) {
    // Set up listener for job completion
    const completionHandler = ({ jobId, endTime, results }) => {
      if (jobId !== job.jobId) return;
      
      // Update metrics
      this.metrics.jobsProcessed++;
      this.metrics.totalProcessingTime += (endTime - job.executionState.startTime) / 1000;
      this.metrics.averageProcessingTime = 
        this.metrics.totalProcessingTime / this.metrics.jobsProcessed;
      
      // Calculate success rate
      const completedUnits = job.getWorkUnitsByStatus('completed').length;
      const totalUnits = job.workUnits.length;
      
      if (totalUnits > 0) {
        const jobSuccessRate = completedUnits / totalUnits;
        // Update overall success rate with exponential moving average
        this.metrics.successRate = 
          this.metrics.successRate * 0.7 + jobSuccessRate * 0.3;
      }
      
      // Clean up job after a delay
      setTimeout(() => {
        this.jobs.delete(job.jobId);
        logger.debug(`Removed completed job ${job.jobId} from registry`);
      }, 3600000); // Keep job for 1 hour
      
      // Remove the listener
      job.removeListener('jobCompleted', completionHandler);
    };
    
    job.on('jobCompleted', completionHandler);
    
    // Also listen for job failure
    job.on('jobFailed', ({ jobId }) => {
      if (jobId !== job.jobId) return;
      
      // Update metrics
      this.metrics.jobsProcessed++;
      
      // Clean up job after a delay
      setTimeout(() => {
        this.jobs.delete(job.jobId);
        logger.debug(`Removed failed job ${job.jobId} from registry`);
      }, 3600000); // Keep job for 1 hour
    });
  }
  }
  
  module.exports = ClusterManagementController;