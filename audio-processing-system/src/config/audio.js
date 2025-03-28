/**
 * @module config/audio
 * @description Specialized audio processing configuration parameters
 * 
 * This module defines the technical specifications and operational parameters
 * for the audio processing subsystem, including format handling, DSP settings,
 * and performance optimization constraints.
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
 * Audio processing configuration parameters
 * 
 * Defines the technical constraints and operational behavior
 * of the audio processing pipeline.
 */
const audioConfig = {
  /**
   * Audio format specifications and constraints
   */
  formats: {
    supported: [
      'wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a', 'opus', 
      'aiff', 'alac', 'wma', 'webm'
    ],
    preferred: resolveConfig('PREFERRED_FORMAT', 'wav'),
    lossy: ['mp3', 'ogg', 'aac', 'm4a', 'opus', 'wma', 'webm'],
    lossless: ['wav', 'flac', 'aiff', 'alac'],
    exportDefaults: {
      wav: { sampleRate: 44100, bitDepth: 24, channels: 2 },
      mp3: { bitrate: 320, vbr: true, channels: 2 },
      flac: { compression: 5, sampleRate: 48000, bitDepth: 24 },
      aac: { bitrate: 256, channels: 2 }
    }
  },

  /**
   * Audio signal specifications and constraints
   */
  signal: {
    minSampleRate: parseInt(resolveConfig('MIN_SAMPLE_RATE', 8000), 10),
    maxSampleRate: parseInt(resolveConfig('MAX_SAMPLE_RATE', 192000), 10),
    preferredSampleRates: [44100, 48000, 96000],
    defaultSampleRate: parseInt(resolveConfig('DEFAULT_SAMPLE_RATE', 44100), 10),
    
    minBitDepth: parseInt(resolveConfig('MIN_BIT_DEPTH', 8), 10),
    maxBitDepth: parseInt(resolveConfig('MAX_BIT_DEPTH', 32), 10),
    preferredBitDepths: [16, 24, 32],
    defaultBitDepth: parseInt(resolveConfig('DEFAULT_BIT_DEPTH', 24), 10),
    
    maxChannels: parseInt(resolveConfig('MAX_CHANNELS', 8), 10),
    defaultChannels: parseInt(resolveConfig('DEFAULT_CHANNELS', 2), 10),
    
    defaultGain: parseFloat(resolveConfig('DEFAULT_GAIN', 1.0)),
    defaultPan: parseFloat(resolveConfig('DEFAULT_PAN', 0.0)),
    
    headroom: parseFloat(resolveConfig('HEADROOM_DB', 6.0)) // dB
  },

  /**
   * Processing parameters and behavior configuration
   */
  processing: {
    blockSize: parseInt(resolveConfig('PROCESSING_BLOCK_SIZE', 1024), 10),
    overlapFactor: parseFloat(resolveConfig('OVERLAP_FACTOR', 0.5)),
    windowFunction: resolveConfig('WINDOW_FUNCTION', 'hann'), // 'hann', 'hamming', 'blackman', 'rectangular'
    defaultFFTSize: parseInt(resolveConfig('DEFAULT_FFT_SIZE', 2048), 10),
    
    // Thread pool configuration for parallel processing
    workerThreads: {
      minThreads: parseInt(resolveConfig('MIN_WORKER_THREADS', 2), 10),
      maxThreads: parseInt(resolveConfig('MAX_WORKER_THREADS', 0), 10), // 0 = use available CPUs
      idleTimeout: parseInt(resolveConfig('WORKER_IDLE_TIMEOUT', 60000), 10), // 1 minute
      priorityLevels: parseInt(resolveConfig('PRIORITY_LEVELS', 3), 10)
    },
    
    // Memory management for efficient processing
    memory: {
      maxBufferSize: parseInt(resolveConfig('MAX_BUFFER_SIZE', 100 * 1024 * 1024), 10), // 100MB
      poolSize: parseInt(resolveConfig('BUFFER_POOL_SIZE', 32), 10),
      chunkSize: parseInt(resolveConfig('CHUNK_SIZE', 8192), 10),
      preferTypedArrays: resolveConfig('PREFER_TYPED_ARRAYS', 'true') === 'true',
      useZeroCopy: resolveConfig('USE_ZERO_COPY', 'true') === 'true'
    },
    
    // Optimizations for efficient processing
    optimizations: {
      useWebAssembly: resolveConfig('USE_WASM', 'true') === 'true',
      useSIMD: resolveConfig('USE_SIMD', 'true') === 'true',
      precomputeFilters: resolveConfig('PRECOMPUTE_FILTERS', 'true') === 'true',
      cacheLookupTables: resolveConfig('CACHE_LOOKUP_TABLES', 'true') === 'true'
    }
  },

  /**
   * Digital Signal Processing (DSP) configuration
   */
  dsp: {
    /**
     * Filter specifications
     */
    filters: {
      maxOrder: parseInt(resolveConfig('MAX_FILTER_ORDER', 100), 10),
      defaultQ: parseFloat(resolveConfig('DEFAULT_FILTER_Q', 0.7071)),
      defaultSlope: parseFloat(resolveConfig('DEFAULT_FILTER_SLOPE', 12.0)), // dB/octave
      types: ['lowpass', 'highpass', 'bandpass', 'notch', 'lowshelf', 'highshelf', 'peaking', 'allpass'],
      implementations: ['biquad', 'butterworth', 'chebyshev', 'linkwitz-riley']
    },
    
    /**
     * Dynamics processing specifications
     */
    dynamics: {
      defaultAttack: parseFloat(resolveConfig('DEFAULT_ATTACK', 50.0)), // ms
      defaultRelease: parseFloat(resolveConfig('DEFAULT_RELEASE', 200.0)), // ms
      defaultRatio: parseFloat(resolveConfig('DEFAULT_RATIO', 4.0)),
      defaultThreshold: parseFloat(resolveConfig('DEFAULT_THRESHOLD', -18.0)), // dB
      defaultKnee: parseFloat(resolveConfig('DEFAULT_KNEE', 6.0)) // dB
    },
    
    /**
     * Spectral processing specifications
     */
    spectral: {
      defaultWindowSize: parseInt(resolveConfig('DEFAULT_WINDOW_SIZE', 2048), 10),
      defaultHopSize: parseInt(resolveConfig('DEFAULT_HOP_SIZE', 512), 10),
      phaseVocoder: {
        defaultPhaseLocking: resolveConfig('PHASE_LOCKING', 'true') === 'true',
        defaultTimeStretch: parseFloat(resolveConfig('DEFAULT_TIME_STRETCH', 1.0))
      }
    },
    
    /**
     * Time-domain processing specifications
     */
    timeDomain: {
      maxDelayTime: parseFloat(resolveConfig('MAX_DELAY_TIME', 10.0)), // seconds
      delayInterpolation: resolveConfig('DELAY_INTERPOLATION', 'linear') // 'none', 'linear', 'cubic'
    }
  },

  /**
   * Neural processing configuration
   */
  neural: {
    enabled: resolveConfig('NEURAL_ENABLED', 'true') === 'true',
    gpuEnabled: resolveConfig('GPU_ENABLED', 'false') === 'true',
    modelType: resolveConfig('NEURAL_MODEL_TYPE', 'unet'), // 'unet', 'transformer', 'wavenet'
    quantization: resolveConfig('MODEL_QUANTIZATION', 'none'), // 'none', 'float16', 'int8'
    modelPath: resolveConfig('NEURAL_MODEL_PATH', './models'),
    defaultModels: {
      denoise: 'denoiser-v1',
      separation: 'separator-v1',
      enhancement: 'enhancer-v1'
    },
    batchSize: parseInt(resolveConfig('NEURAL_BATCH_SIZE', 1), 10)
  },

  /**
   * Streaming and real-time processing configuration
   */
  streaming: {
    bufferSize: parseInt(resolveConfig('STREAMING_BUFFER_SIZE', 4096), 10),
    maxLatency: parseInt(resolveConfig('MAX_LATENCY', 100), 10), // ms
    prioritizeLatency: resolveConfig('PRIORITIZE_LATENCY', 'false') === 'true',
    adaptiveBuffering: resolveConfig('ADAPTIVE_BUFFERING', 'true') === 'true',
    adaptiveBitrate: {
      enabled: resolveConfig('ADAPTIVE_BITRATE', 'true') === 'true',
      minBitrate: parseInt(resolveConfig('MIN_BITRATE', 64), 10), // kbps
      maxBitrate: parseInt(resolveConfig('MAX_BITRATE', 320), 10), // kbps
      targetBuffer: parseInt(resolveConfig('TARGET_BUFFER', 5000), 10) // ms
    },
    protocols: ['hls', 'dash', 'webrtc']
  },

  /**
   * Distributed audio processing configuration
   */
  distributed: {
    /**
     * Configuration for chunked processing distribution
     */
    chunking: {
      enabled: resolveConfig('CHUNK_PROCESSING', 'true') === 'true',
      chunkOverlap: parseInt(resolveConfig('CHUNK_OVERLAP', 1024), 10), // samples
      defaultStrategy: resolveConfig('CHUNKING_STRATEGY', 'adaptive'), // 'fixed', 'adaptive', 'dynamic'
      minChunkSize: parseInt(resolveConfig('MIN_CHUNK_SIZE', 5 * 1024 * 1024), 10), // 5MB
      maxChunkSize: parseInt(resolveConfig('MAX_CHUNK_SIZE', 50 * 1024 * 1024), 10), // 50MB
      loadBalancing: resolveConfig('LOAD_BALANCING', 'auto') // 'round-robin', 'least-loaded', 'auto'
    },
    
    /**
     * Cluster configuration for distributed processing
     */
    cluster: {
      replicationFactor: parseInt(resolveConfig('REPLICATION_FACTOR', 1), 10),
      nodeTimeout: parseInt(resolveConfig('NODE_TIMEOUT', 30000), 10), // 30 seconds
      retryLimit: parseInt(resolveConfig('RETRY_LIMIT', 3), 10),
      heartbeatInterval: parseInt(resolveConfig('HEARTBEAT_INTERVAL', 5000), 10) // 5 seconds
    }
  }
};

/**
 * Dynamic configuration adaptations based on available system resources
 */
function adaptConfigToEnvironment() {
  const os = require('os');
  
  // Adjust worker thread count based on available CPUs
  if (audioConfig.processing.workerThreads.maxThreads === 0) {
    const cpuCount = os.cpus().length;
    audioConfig.processing.workerThreads.maxThreads = Math.max(2, cpuCount - 1);
  }
  
  // Adjust memory limits based on system memory
  const totalMemory = os.totalmem();
  const memoryRatio = 0.25; // Use up to 25% of available memory
  const calculatedMaxBuffer = Math.floor(totalMemory * memoryRatio);
  
  // Limit max buffer size to the smaller of configured value or calculated value
  audioConfig.processing.memory.maxBufferSize = Math.min(
    audioConfig.processing.memory.maxBufferSize,
    calculatedMaxBuffer
  );
  
  // Adjust batch size for neural processing based on available memory
  if (audioConfig.neural.enabled && audioConfig.neural.gpuEnabled) {
    const gpuMemoryAvailable = false; // Would be determined by GPU detection
    if (!gpuMemoryAvailable) {
      audioConfig.neural.batchSize = 1; // Reduce batch size if no GPU available
    }
  }
  
  return audioConfig;
}

// Apply dynamic adaptations
adaptConfigToEnvironment();

module.exports = audioConfig;