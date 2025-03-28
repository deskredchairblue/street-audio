/**
 * @module config/cluster
 * @description Distributed processing cluster configuration
 * 
 * This module defines the parameters and operational constraints for the
 * distributed audio processing architecture, including node coordination,
 * workload distribution, fault tolerance, and scaling policies.
 */

'use strict';

/**
 * Environment-specific configuration resolver with type conversion
 * 
 * @param {string} key - Configuration key to resolve
 * @param {*} defaultValue - Default value if not specified in environment
 * @param {Function} [converter] - Optional type conversion function
 * @returns {*} Resolved configuration value
 */
function resolveConfig(key, defaultValue, converter = null) {
  const value = process.env[key] !== undefined ? process.env[key] : defaultValue;
  return converter && process.env[key] !== undefined ? converter(process.env[key]) : value;
}

/**
 * Cluster topology and node management configuration
 * 
 * Defines the operational parameters for distributed audio processing
 * across multiple computational nodes.
 */
const clusterConfig = {
  /**
   * Cluster activation and core parameters
   */
  core: {
    enabled: resolveConfig('CLUSTER_ENABLED', false, value => value === 'true'),
    mode: resolveConfig('CLUSTER_MODE', 'auto'),  // 'auto', 'master', 'worker'
    serviceName: resolveConfig('SERVICE_NAME', 'audio-processor'),
    serviceVersion: resolveConfig('SERVICE_VERSION', '1.0.0'),
    nodeId: resolveConfig('NODE_ID', null) || generateNodeId(),
    namespace: resolveConfig('CLUSTER_NAMESPACE', 'default')
  },

  /**
   * Node coordination and discovery mechanisms
   */
  coordination: {
    /**
     * Service discovery configuration
     */
    discovery: {
      mechanism: resolveConfig('DISCOVERY_MECHANISM', 'multicast'),  // 'multicast', 'dns', 'k8s', 'consul', 'static'
      refreshInterval: resolveConfig('DISCOVERY_REFRESH', 30000, parseInt),  // 30 seconds
      announceInterval: resolveConfig('ANNOUNCE_INTERVAL', 15000, parseInt),  // 15 seconds
      
      // Static node configuration
      staticNodes: resolveConfig('STATIC_NODES', '').split(',').filter(Boolean),
      
      // Kubernetes discovery
      k8s: {
        enabled: resolveConfig('K8S_DISCOVERY', false, value => value === 'true'),
        namespace: resolveConfig('K8S_NAMESPACE', 'default'),
        labelSelector: resolveConfig('K8S_SELECTOR', 'app=audio-processor'),
        serviceName: resolveConfig('K8S_SERVICE', 'audio-processor-svc')
      },
      
      // Consul discovery
      consul: {
        enabled: resolveConfig('CONSUL_DISCOVERY', false, value => value === 'true'),
        host: resolveConfig('CONSUL_HOST', 'localhost'),
        port: resolveConfig('CONSUL_PORT', 8500, parseInt),
        serviceName: resolveConfig('CONSUL_SERVICE', 'audio-processor'),
        datacenter: resolveConfig('CONSUL_DC', 'dc1')
      }
    },
    
    /**
     * Consensus and leader election
     */
    consensus: {
      algorithm: resolveConfig('CONSENSUS_ALGORITHM', 'raft'),  // 'raft', 'paxos', 'zab'
      electionTimeout: resolveConfig('ELECTION_TIMEOUT', 5000, parseInt),  // 5 seconds
      heartbeatInterval: resolveConfig('HEARTBEAT_INTERVAL', 1000, parseInt),  // 1 second
      snapshotInterval: resolveConfig('SNAPSHOT_INTERVAL', 60000, parseInt)  // 1 minute
    }
  },

  /**
   * Workload distribution and resource allocation
   */
  workload: {
    /**
     * Job partitioning and assignment
     */
    distribution: {
      strategy: resolveConfig('DISTRIBUTION_STRATEGY', 'adaptive'),  // 'static', 'adaptive', 'dynamic'
      partitioningScheme: resolveConfig('PARTITIONING_SCHEME', 'chunk'),  // 'chunk', 'stream', 'task'
      loadBalancing: resolveConfig('LOAD_BALANCING', 'weighted'),  // 'round-robin', 'least-loaded', 'weighted'
      workStealingEnabled: resolveConfig('WORK_STEALING', true, value => value === 'true'),
      
      // Chunking parameters
      chunk: {
        minSize: resolveConfig('MIN_CHUNK_SIZE', 5 * 1024 * 1024, parseInt),  // 5MB
        maxSize: resolveConfig('MAX_CHUNK_SIZE', 50 * 1024 * 1024, parseInt),  // 50MB
        overlapSize: resolveConfig('CHUNK_OVERLAP', 1024, parseInt),  // 1024 samples
        boundaryDetection: resolveConfig('BOUNDARY_DETECTION', true, value => value === 'true')
      },
      
      // Job priority management
      priorities: {
        levels: resolveConfig('PRIORITY_LEVELS', 3, parseInt),
        preemptionEnabled: resolveConfig('PREEMPTION_ENABLED', true, value => value === 'true'),
        fairnessWeight: resolveConfig('FAIRNESS_WEIGHT', 0.7, parseFloat)
      }
    },
    
    /**
     * Resource allocation and management
     */
    resources: {
      /**
       * Node capacity declaration and constraints
       */
      capacity: {
        cpuAllocation: resolveConfig('CPU_ALLOCATION', 0.8, parseFloat),  // 80% of available CPUs
        memoryAllocation: resolveConfig('MEMORY_ALLOCATION', 0.7, parseFloat),  // 70% of available memory
        reservationRatio: resolveConfig('RESERVATION_RATIO', 0.2, parseFloat),  // 20% reserved for system
        overcommitRatio: resolveConfig('OVERCOMMIT_RATIO', 1.2, parseFloat)  // Allow 20% overcommitment
      },
      
      /**
       * Resource constraints and limits
       */
      limits: {
        maxConcurrentJobs: resolveConfig('MAX_CONCURRENT_JOBS', 10, parseInt),
        maxMemoryPerJob: resolveConfig('MAX_MEMORY_PER_JOB', 2048, parseInt),  // MB
        maxProcessingTime: resolveConfig('MAX_PROCESSING_TIME', 3600, parseInt),  // seconds
        cpuIntensityLevels: resolveConfig('CPU_INTENSITY_LEVELS', 'low,medium,high').split(',')
      }
    }
  },

  /**
   * Communication protocols and data exchange
   */
  communication: {
    /**
     * Protocol configuration
     */
    protocol: {
      primary: resolveConfig('PRIMARY_PROTOCOL', 'tcp'),  // 'tcp', 'udp', 'http', 'grpc'
      dataFormat: resolveConfig('DATA_FORMAT', 'binary'),  // 'json', 'binary', 'protobuf'
      compressionEnabled: resolveConfig('COMM_COMPRESSION', true, value => value === 'true'),
      compressionLevel: resolveConfig('COMPRESSION_LEVEL', 5, parseInt),  // 0-9
      encryptionEnabled: resolveConfig('COMM_ENCRYPTION', false, value => value === 'true'),
      maxMessageSize: resolveConfig('MAX_MESSAGE_SIZE', 100 * 1024 * 1024, parseInt)  // 100MB
    },
    
    /**
     * Transport configuration
     */
    transport: {
      port: resolveConfig('CLUSTER_PORT', 7000, parseInt),
      interfaces: resolveConfig('CLUSTER_INTERFACES', '0.0.0.0'),
      maxConnections: resolveConfig('MAX_CONNECTIONS', 100, parseInt),
      connectionTimeout: resolveConfig('CONNECTION_TIMEOUT', 10000, parseInt),  // 10 seconds
      keepAliveInterval: resolveConfig('KEEP_ALIVE', 15000, parseInt)  // 15 seconds
    },
    
    /**
     * Message queue configuration
     */
    queue: {
      enabled: resolveConfig('QUEUE_ENABLED', true, value => value === 'true'),
      engine: resolveConfig('QUEUE_ENGINE', 'internal'),  // 'internal', 'redis', 'kafka', 'rabbitmq'
      maxQueueSize: resolveConfig('MAX_QUEUE_SIZE', 1000, parseInt),
      persistenceEnabled: resolveConfig('QUEUE_PERSISTENCE', false, value => value === 'true'),
      
      // External message broker configuration
      broker: {
        redis: {
          host: resolveConfig('REDIS_HOST', 'localhost'),
          port: resolveConfig('REDIS_PORT', 6379, parseInt)
        },
        kafka: {
          brokers: resolveConfig('KAFKA_BROKERS', 'localhost:9092').split(','),
          topic: resolveConfig('KAFKA_TOPIC', 'audio-processing')
        },
        rabbitmq: {
          url: resolveConfig('RABBITMQ_URL', 'amqp://localhost'),
          queue: resolveConfig('RABBITMQ_QUEUE', 'audio-processing')
        }
      }
    }
  },

  /**
   * Data coordination and state management
   */
  dataManagement: {
    /**
     * Shared state management
     */
    sharedState: {
      mechanism: resolveConfig('STATE_MECHANISM', 'distributed'),  // 'centralized', 'distributed'
      consistency: resolveConfig('STATE_CONSISTENCY', 'eventual'),  // 'strong', 'eventual', 'session'
      replicationFactor: resolveConfig('REPLICATION_FACTOR', 2, parseInt),
      syncInterval: resolveConfig('STATE_SYNC_INTERVAL', 5000, parseInt)  // 5 seconds
    },
    
    /**
     * Distributed storage configuration
     */
    storage: {
      mechanism: resolveConfig('STORAGE_MECHANISM', 'local'),  // 'local', 's3', 'gcs', 'azure', 'shared-fs'
      sharedEnabled: resolveConfig('SHARED_STORAGE', false, value => value === 'true'),
      tempDirectory: resolveConfig('TEMP_DIRECTORY', './tmp'),
      retentionPeriod: resolveConfig('RETENTION_PERIOD', 86400, parseInt),  // 24 hours
      
      // Cloud storage configuration
      cloud: {
        s3: {
          bucket: resolveConfig('S3_BUCKET', 'audio-processing'),
          region: resolveConfig('S3_REGION', 'us-east-1'),
          keyPrefix: resolveConfig('S3_PREFIX', 'processing/')
        },
        gcs: {
          bucket: resolveConfig('GCS_BUCKET', 'audio-processing'),
          keyPrefix: resolveConfig('GCS_PREFIX', 'processing/')
        },
        azure: {
          container: resolveConfig('AZURE_CONTAINER', 'audio-processing'),
          accountName: resolveConfig('AZURE_ACCOUNT', 'audioprocessing')
        }
      }
    },
    
    /**
     * Caching strategy
     */
    caching: {
      enabled: resolveConfig('CACHE_ENABLED', true, value => value === 'true'),
      distributed: resolveConfig('DISTRIBUTED_CACHE', false, value => value === 'true'),
      maxSize: resolveConfig('CACHE_SIZE', 1024, parseInt),  // MB
      ttl: resolveConfig('CACHE_TTL', 3600, parseInt),  // 1 hour
      evictionPolicy: resolveConfig('EVICTION_POLICY', 'lru')  // 'lru', 'lfu', 'fifo'
    }
  },

  /**
   * Resilience, fault tolerance, and recovery mechanisms
   */
  resilience: {
    /**
     * Fault detection and health monitoring
     */
    healthCheck: {
      enabled: resolveConfig('HEALTH_CHECK_ENABLED', true, value => value === 'true'),
      interval: resolveConfig('HEALTH_CHECK_INTERVAL', 10000, parseInt),  // 10 seconds
      timeout: resolveConfig('HEALTH_CHECK_TIMEOUT', 5000, parseInt),  // 5 seconds
      thresholds: {
        cpu: resolveConfig('CPU_THRESHOLD', 90, parseInt),  // 90%
        memory: resolveConfig('MEMORY_THRESHOLD', 85, parseInt),  // 85%
        diskSpace: resolveConfig('DISK_THRESHOLD', 90, parseInt),  // 90%
        responseTime: resolveConfig('RESPONSE_THRESHOLD', 2000, parseInt)  // 2 seconds
      }
    },
    
    /**
     * Fault handling and recovery
     */
    recovery: {
      strategyOrder: resolveConfig('RECOVERY_STRATEGY', 'retry,reassign,recreate').split(','),
      maxRetries: resolveConfig('MAX_RETRIES', 3, parseInt),
      retryBackoffMs: resolveConfig('RETRY_BACKOFF', 1000, parseInt),  // 1 second
      jobRecoveryEnabled: resolveConfig('JOB_RECOVERY', true, value => value === 'true'),
      stateRecoveryEnabled: resolveConfig('STATE_RECOVERY', true, value => value === 'true'),
      nodeRemovalThreshold: resolveConfig('NODE_REMOVAL_THRESHOLD', 3, parseInt)  // failures before removal
    },
    
    /**
     * Circuit breaking and backpressure
     */
    circuitBreaker: {
      enabled: resolveConfig('CIRCUIT_BREAKER', true, value => value === 'true'),
      thresholdPercentage: resolveConfig('BREAKER_THRESHOLD', 50, parseInt),  // 50%
      windowSizeMs: resolveConfig('BREAKER_WINDOW', 60000, parseInt),  // 1 minute
      minimumRequests: resolveConfig('BREAKER_MIN_REQUESTS', 5, parseInt),
      halfOpenAfterMs: resolveConfig('BREAKER_RESET', 30000, parseInt)  // 30 seconds
    }
  },

  /**
   * Scaling and adaptation policies
   */
  scaling: {
    /**
     * Auto-scaling configuration
     */
    autoScaling: {
      enabled: resolveConfig('AUTO_SCALING', false, value => value === 'true'),
      mechanism: resolveConfig('SCALING_MECHANISM', 'load'),  // 'load', 'queue', 'predictive'
      cooldownPeriod: resolveConfig('SCALING_COOLDOWN', 300000, parseInt),  // 5 minutes
      evaluation: {
        interval: resolveConfig('EVALUATION_INTERVAL', 60000, parseInt),  // 1 minute
        loadThresholdUp: resolveConfig('LOAD_THRESHOLD_UP', 80, parseInt),  // 80%
        loadThresholdDown: resolveConfig('LOAD_THRESHOLD_DOWN', 30, parseInt),  // 30%
        queueThresholdUp: resolveConfig('QUEUE_THRESHOLD_UP', 100, parseInt),  // 100 jobs
        queueThresholdDown: resolveConfig('QUEUE_THRESHOLD_DOWN', 10, parseInt)  // 10 jobs
      },
      limits: {
        minNodes: resolveConfig('MIN_NODES', 1, parseInt),
        maxNodes: resolveConfig('MAX_NODES', 10, parseInt),
        scaleUpStep: resolveConfig('SCALE_UP_STEP', 1, parseInt),
        scaleDownStep: resolveConfig('SCALE_DOWN_STEP', 1, parseInt)
      }
    },
    
    /**
     * Load adaptation policies
     */
    loadAdaptation: {
      enabled: resolveConfig('LOAD_ADAPTATION', true, value => value === 'true'),
      metrics: resolveConfig('ADAPTATION_METRICS', 'cpu,memory,queue,latency').split(','),
      strategy: resolveConfig('ADAPTATION_STRATEGY', 'progressive'),  // 'progressive', 'aggressive', 'conservative'
      thresholds: {
        highLoad: resolveConfig('HIGH_LOAD_THRESHOLD', 80, parseInt),  // 80%
        mediumLoad: resolveConfig('MEDIUM_LOAD_THRESHOLD', 50, parseInt),  // 50%
        lowLoad: resolveConfig('LOW_LOAD_THRESHOLD', 20, parseInt)  // 20%
      }
    }
  },

  /**
   * Logging, monitoring, and observability
   */
  observability: {
    /**
     * Distributed tracing configuration
     */
    tracing: {
      enabled: resolveConfig('TRACING_ENABLED', true, value => value === 'true'),
      sampler: resolveConfig('TRACE_SAMPLER', 'probabilistic'),  // 'always', 'probabilistic', 'ratelimiting'
      samplingRate: resolveConfig('SAMPLING_RATE', 0.1, parseFloat),  // 10% of requests
      exportEndpoint: resolveConfig('TRACE_ENDPOINT', ''),
      
      // Propagation configuration
      propagation: {
        formats: resolveConfig('TRACE_FORMATS', 'b3,w3c').split(','),
        includeBaggage: resolveConfig('INCLUDE_BAGGAGE', true, value => value === 'true')
      }
    },
    
    /**
     * Metrics collection and reporting
     */
    metrics: {
      enabled: resolveConfig('METRICS_ENABLED', true, value => value === 'true'),
      interval: resolveConfig('METRICS_INTERVAL', 15000, parseInt),  // 15 seconds
      prefix: resolveConfig('METRICS_PREFIX', 'audio_processor'),
      exporters: resolveConfig('METRICS_EXPORTERS', 'prometheus').split(','),
      
      // Prometheus configuration
      prometheus: {
        endpoint: resolveConfig('PROMETHEUS_ENDPOINT', '/metrics'),
        port: resolveConfig('PROMETHEUS_PORT', 9090, parseInt)
      }
    },
    
    /**
     * Logging configuration
     */
    logging: {
      level: resolveConfig('LOG_LEVEL', 'info'),  // 'debug', 'info', 'warn', 'error'
      format: resolveConfig('LOG_FORMAT', 'json'),  // 'json', 'text'
      aggregation: resolveConfig('LOG_AGGREGATION', true, value => value === 'true'),
      distributedContext: resolveConfig('DISTRIBUTED_CONTEXT', true, value => value === 'true'),
      obfuscateSensitive: resolveConfig('OBFUSCATE_SENSITIVE', true, value => value === 'true')
    }
  }
};

/**
 * Generate a unique node ID
 * 
 * @returns {string} Unique identifier for the node
 */
function generateNodeId() {
  const os = require('os');
  const crypto = require('crypto');
  
  // Combine hostname, some network interface info, and a random component
  const hostname = os.hostname();
  const networkInterfaces = os.networkInterfaces();
  let macAddress = '';
  
  // Try to get a consistent MAC address
  Object.keys(networkInterfaces).some(ifName => {
    return networkInterfaces[ifName].some(iface => {
      if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
        macAddress = iface.mac;
        return true;
      }
      return false;
    });
  });
  
  // Create a deterministic but unique identifier
  const baseString = `${hostname}-${macAddress}-${process.pid}`;
  const hash = crypto.createHash('sha256').update(baseString).digest('hex');
  
  return `node-${hash.substring(0, 8)}`;
}

/**
 * Perform runtime validation of critical configuration parameters
 */
function validateConfiguration() {
  const errors = [];
  
  // Validate node communication settings
  if (clusterConfig.core.enabled) {
    if (!clusterConfig.communication.transport.port) {
      errors.push('Cluster port must be specified when clustering is enabled');
    }
    
    if (clusterConfig.coordination.discovery.mechanism === 'static' && 
        clusterConfig.coordination.discovery.staticNodes.length === 0) {
      errors.push('Static nodes must be specified when using static discovery mechanism');
    }
  }
  
  // Validate workload distribution settings
  if (clusterConfig.workload.distribution.chunk.minSize >= clusterConfig.workload.distribution.chunk.maxSize) {
    errors.push('Minimum chunk size must be less than maximum chunk size');
  }
  
  // Log warnings for suboptimal configurations
  if (clusterConfig.workload.resources.capacity.overcommitRatio > 1.5) {
    console.warn('Warning: High overcommit ratio may lead to resource contention');
  }
  
  if (clusterConfig.resilience.circuitBreaker.enabled && 
      clusterConfig.resilience.circuitBreaker.thresholdPercentage < 10) {
    console.warn('Warning: Low circuit breaker threshold may trigger false positives');
  }
  
  // Throw error if critical validation fails
  if (errors.length > 0) {
    throw new Error(`Cluster configuration validation failed: ${errors.join(', ')}`);
  }
  
  return true;
}

// Perform validation if cluster is enabled
if (clusterConfig.core.enabled) {
  validateConfiguration();
}

module.exports = clusterConfig;