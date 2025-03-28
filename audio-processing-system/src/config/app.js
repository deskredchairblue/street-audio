/**
 * @module config/app
 * @description Core application configuration for the audio processing system
 * 
 * This module defines the fundamental configuration parameters that govern
 * the behavior of the audio processing application, including server settings,
 * performance tuning, and operational constraints.
 */

'use strict';

/**
 * Environment-specific configuration resolver
 * 
 * @param {string} key - Configuration key to resolve
 * @param {*} defaultValue - Default value if not specified in environment
 * @returns {*} Resolved configuration value
 */
function resolveConfig(key, defaultValue) {
  return process.env[key] !== undefined ? process.env[key] : defaultValue;
}

/**
 * Application configuration object
 * 
 * Defines core application parameters with intelligent defaults
 * and environment variable overrides.
 */
const appConfig = {
  /**
   * Core application identity and operational parameters
   */
  core: {
    name: resolveConfig('APP_NAME', 'Advanced Audio Processing System'),
    version: resolveConfig('APP_VERSION', '1.0.0'),
    environment: resolveConfig('NODE_ENV', 'development'),
    debug: resolveConfig('DEBUG_MODE', 'development') === 'true',
    logLevel: resolveConfig('LOG_LEVEL', 'info'),
    port: parseInt(resolveConfig('PORT', 3000), 10),
    hostname: resolveConfig('HOST', '0.0.0.0'),
    baseUrl: resolveConfig('BASE_URL', 'http://localhost:3000'),
    apiPrefix: resolveConfig('API_PREFIX', '/api')
  },

  /**
   * Security configuration parameters
   */
  security: {
    corsEnabled: resolveConfig('CORS_ENABLED', 'true') === 'true',
    corsOrigins: resolveConfig('CORS_ORIGINS', '*'),
    corsHeaders: resolveConfig('CORS_HEADERS', 'Content-Type, Authorization'),
    helmetEnabled: resolveConfig('HELMET_ENABLED', 'true') === 'true',
    rateLimitEnabled: resolveConfig('RATE_LIMIT_ENABLED', 'true') === 'true',
    rateLimit: {
      windowMs: parseInt(resolveConfig('RATE_LIMIT_WINDOW', 15 * 60 * 1000), 10), // 15 minutes
      max: parseInt(resolveConfig('RATE_LIMIT_MAX', 100), 10), // 100 requests per window
      standardHeaders: resolveConfig('RATE_LIMIT_HEADERS', 'true') === 'true',
      legacyHeaders: resolveConfig('RATE_LIMIT_LEGACY', 'false') === 'true'
    },
    jwtSecret: resolveConfig('JWT_SECRET', 'dev-jwt-secret-change-in-production'),
    jwtExpiresIn: resolveConfig('JWT_EXPIRES', '24h')
  },

  /**
   * Resource management configuration
   */
  resources: {
    tempDir: resolveConfig('TEMP_DIR', './tmp'),
    uploadDir: resolveConfig('UPLOAD_DIR', './uploads'),
    modelsDir: resolveConfig('MODELS_DIR', './models'),
    maxRequestSize: parseInt(resolveConfig('MAX_REQUEST_SIZE', 50 * 1024 * 1024), 10), // 50MB
    maxFileSize: parseInt(resolveConfig('MAX_FILE_SIZE', 500 * 1024 * 1024), 10), // 500MB
    cleanupInterval: parseInt(resolveConfig('CLEANUP_INTERVAL', 24 * 60 * 60 * 1000), 10), // 24 hours
    storageTTL: parseInt(resolveConfig('STORAGE_TTL', 7 * 24 * 60 * 60 * 1000), 10) // 7 days
  },

  /**
   * Performance optimization parameters
   */
  performance: {
    compression: resolveConfig('COMPRESSION_ENABLED', 'true') === 'true',
    compressionLevel: parseInt(resolveConfig('COMPRESSION_LEVEL', 6), 10), // 0-9, higher = more compression
    etag: resolveConfig('ETAG_ENABLED', 'true') === 'true',
    cacheControl: resolveConfig('CACHE_CONTROL', 'public, max-age=300'),
    timeout: parseInt(resolveConfig('REQUEST_TIMEOUT', 300000), 10), // 5 minutes
    keepAliveTimeout: parseInt(resolveConfig('KEEP_ALIVE_TIMEOUT', 60000), 10), // 1 minute
    maxConcurrentProcessing: parseInt(resolveConfig('MAX_CONCURRENT_PROCESSING', 5), 10)
  },

  /**
   * Distributed application infrastructure
   */
  infrastructure: {
    clusterEnabled: resolveConfig('CLUSTER_ENABLED', 'false') === 'true',
    workerCount: parseInt(resolveConfig('WORKER_COUNT', 0), 10), // 0 = use CPU count
    socketEnabled: resolveConfig('SOCKET_ENABLED', 'true') === 'true',
    socketPath: resolveConfig('SOCKET_PATH', '/socket.io'),
    redisEnabled: resolveConfig('REDIS_ENABLED', 'false') === 'true',
    redisUrl: resolveConfig('REDIS_URL', 'redis://localhost:6379'),
    sessionStore: resolveConfig('SESSION_STORE', 'memory'), // 'memory', 'redis'
    pubsubEnabled: resolveConfig('PUBSUB_ENABLED', 'false') === 'true'
  },

  /**
   * Application metrics and monitoring
   */
  monitoring: {
    metricsEnabled: resolveConfig('METRICS_ENABLED', 'true') === 'true',
    metricsPath: resolveConfig('METRICS_PATH', '/metrics'),
    healthCheckEnabled: resolveConfig('HEALTH_CHECK_ENABLED', 'true') === 'true',
    healthCheckPath: resolveConfig('HEALTH_CHECK_PATH', '/health'),
    performanceMonitoring: resolveConfig('PERFORMANCE_MONITORING', 'true') === 'true',
    logRequests: resolveConfig('LOG_REQUESTS', 'true') === 'true',
    errorTracking: resolveConfig('ERROR_TRACKING', 'true') === 'true'
  }
};

/**
 * Environment-specific configuration overrides
 */
const environmentConfigs = {
  development: {
    core: {
      debug: true,
      logLevel: 'debug'
    },
    security: {
      corsEnabled: true,
      corsOrigins: '*'
    },
    performance: {
      compression: false
    }
  },
  production: {
    core: {
      debug: false,
      logLevel: 'warn'
    },
    security: {
      corsEnabled: true,
      corsOrigins: resolveConfig('CORS_ORIGINS', '*') // Must be explicitly configured in production
    },
    performance: {
      compression: true,
      compressionLevel: 7
    }
  },
  test: {
    core: {
      debug: true,
      logLevel: 'debug',
      port: parseInt(resolveConfig('TEST_PORT', 3001), 10)
    },
    security: {
      rateLimitEnabled: false
    },
    monitoring: {
      logRequests: false
    }
  }
};

/**
 * Merge base configuration with environment-specific overrides
 */
const environment = appConfig.core.environment;
if (environmentConfigs[environment]) {
  const deepMerge = (target, source) => {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  };
  
  deepMerge(appConfig, environmentConfigs[environment]);
}

module.exports = appConfig;