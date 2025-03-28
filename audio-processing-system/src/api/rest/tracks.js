/**
 * @module api/websocket/realtime
 * @description Real-time WebSocket API for audio streaming and processing
 * 
 * This module implements real-time WebSocket communication for audio data streaming,
 * live audio processing, and real-time feedback on audio operations. It supports
 * bidirectional communication with clients for immediate processing results and
 * continuous status updates.
 */

'use strict';

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/helpers/AudioLogger');
const AudioEventEmitter = require('../../utils/helpers/AudioEventEmitter');
const WorkerThreadPool = require('../../utils/performance/WorkerThreadPool');
const StreamingService = require('../../services/core/StreamingService');
const AdaptiveBitrateService = require('../../services/infrastructure/AdaptiveBitrateService');

// Initialize services
const streamingService = new StreamingService();
const adaptiveService = new AdaptiveBitrateService();

// Initialize worker thread pool for processing
const workerPool = new WorkerThreadPool({
  minThreads: parseInt(process.env.MIN_WORKER_THREADS) || 2,
  maxThreads: parseInt(process.env.MAX_WORKER_THREADS) || 4
});

// Client connection tracking
const clients = new Map();

/**
 * Initialize WebSocket server for real-time audio communication
 * 
 * @param {Object} server - HTTP/HTTPS server instance
 * @returns {WebSocket.Server} Configured WebSocket server
 */
function initializeWebSocketServer(server) {
  const operationId = logger.startTimer('initialize-websocket-server');
  
  const wss = new WebSocket.Server({
    server,
    path: '/api/ws/realtime'
  });
  
  // Setup connection handler
  wss.on('connection', handleConnection);
  
  // Setup error handler
  wss.on('error', error => {
    logger.error('WebSocket server error', { error: error.message });
  });
  
  logger.stopTimer(operationId);
  logger.info('Real-time WebSocket server initialized');
  
  return wss;
}

/**
 * Handle new WebSocket connection
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} req - HTTP request that initiated the connection
 */
function handleConnection(ws, req) {
  const clientId = uuidv4();
  const operationId = logger.startTimer('websocket-connection', { clientId });
  
  // Extract client information
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Initialize client state
  const clientState = {
    id: clientId,
    ip: clientIp,
    connectionTime: Date.now(),
    lastActivity: Date.now(),
    activeStreams: new Map(),
    processingJobs: new Map(),
    subscribedEvents: new Set(),
    networkMetrics: {
      latency: null,
      bandwidth: null,
      packetLoss: null
    }
  };
  
  // Add to clients map
  clients.set(clientId, { ws, state: clientState });
  
  logger.info('New WebSocket connection', { 
    clientId, 
    clientIp 
  });
  
  // Send welcome message
  sendToClient(ws, {
    type: 'connection',
    data: {
      clientId,
      timestamp: Date.now(),
      message: 'Connected to audio processing real-time API'
    }
  });
  
  // Setup message handler
  ws.on('message', message => handleMessage(ws, clientState, message));
  
  // Setup connection close handler
  ws.on('close', () => handleDisconnection(clientId));
  
  // Setup error handler
  ws.on('error', error => {
    logger.error('WebSocket client error', { 
      clientId, 
      error: error.message 
    });
  });
  
  // Setup ping/pong for connection health monitoring
  ws.on('pong', () => {
    clientState.lastActivity = Date.now();
  });
  
  logger.stopTimer(operationId);
}

/**
 * Handle client disconnection
 * 
 * @param {string} clientId - ID of disconnected client
 */
function handleDisconnection(clientId) {
  const operationId = logger.startTimer('websocket-disconnection', { clientId });
  
  const client = clients.get(clientId);
  
  if (client) {
    // Clean up client resources
    const { state } = client;
    
    // Stop any active streams
    for (const [streamId, stream] of state.activeStreams.entries()) {
      streamingService.stopStream(streamId).catch(error => {
        logger.error('Error stopping stream on disconnect', { 
          clientId, 
          streamId, 
          error: error.message 
        });
      });
    }
    
    // Cancel any processing jobs
    for (const [jobId, job] of state.processingJobs.entries()) {
      if (job.cancelFn && typeof job.cancelFn === 'function') {
        job.cancelFn();
        logger.debug('Canceled processing job on disconnect', { 
          clientId, 
          jobId 
        });
      }
    }
    
    // Remove event subscriptions
    for (const event of state.subscribedEvents) {
      AudioEventEmitter.removeListener(event, client.eventHandler);
    }
    
    // Remove from clients map
    clients.delete(clientId);
    
    logger.info('WebSocket client disconnected', { 
      clientId, 
      connectionDuration: Date.now() - state.connectionTime 
    });
  }
  
  logger.stopTimer(operationId);
}

/**
 * Handle incoming WebSocket message
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientState - Client state object
 * @param {string|Buffer} message - Received message
 */
function handleMessage(ws, clientState, message) {
  clientState.lastActivity = Date.now();
  
  let parsedMessage;
  
  try {
    // Handle binary messages (likely audio data)
    if (message instanceof Buffer) {
      handleBinaryMessage(ws, clientState, message);
      return;
    }
    
    // Handle JSON messages
    parsedMessage = JSON.parse(message);
    const { type, data } = parsedMessage;
    
    if (!type) {
      throw new Error('Message type is required');
    }
    
    const operationId = logger.startTimer(`websocket-message-${type}`, { 
      clientId: clientState.id 
    });
    
    // Process message based on type
    switch (type) {
      case 'ping':
        handlePing(ws, clientState, data);
        break;
        
      case 'stream:start':
        handleStreamStart(ws, clientState, data);
        break;
        
      case 'stream:stop':
        handleStreamStop(ws, clientState, data);
        break;
        
      case 'process:start':
        handleProcessStart(ws, clientState, data);
        break;
        
      case 'process:cancel':
        handleProcessCancel(ws, clientState, data);
        break;
        
      case 'subscribe':
        handleSubscribe(ws, clientState, data);
        break;
        
      case 'unsubscribe':
        handleUnsubscribe(ws, clientState, data);
        break;
        
      case 'network:metrics':
        handleNetworkMetrics(ws, clientState, data);
        break;
        
      default:
        logger.warn('Unknown message type', { 
          clientId: clientState.id, 
          type 
        });
        
        sendToClient(ws, {
          type: 'error',
          data: {
            message: `Unknown message type: ${type}`,
            originalType: type
          }
        });
    }
    
    logger.stopTimer(operationId);
  } catch (error) {
    logger.error('Error processing WebSocket message', { 
      clientId: clientState.id, 
      error: error.message,
      message: typeof message === 'string' ? message : 'binary data'
    });
    
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Error processing message',
        details: error.message
      }
    });
  }
}

/**
 * Handle binary message (audio data)
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientState - Client state object
 * @param {Buffer} data - Binary message data
 */
function handleBinaryMessage(ws, clientState, data) {
  const headerSize = 12; // First 12 bytes contain metadata
  
  // Ensure message is large enough to contain header
  if (data.length < headerSize) {
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Invalid binary message format',
        details: 'Message too small to contain header'
      }
    });
    return;
  }
  
  // Extract header information
  const streamId = data.readUInt32LE(0).toString();
  const timestamp = data.readUInt32LE(4);
  const format = data.readUInt32LE(8);
  
  // Get audio data (everything after header)
  const audioData = data.slice(headerSize);
  
  // Get stream if it exists
  const stream = clientState.activeStreams.get(streamId);
  
  if (!stream) {
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Stream not found',
        streamId
      }
    });
    return;
  }
  
  // Process audio chunk
  try {
    streamingService.processAudioChunk(streamId, audioData, {
      timestamp,
      format
    }).then(result => {
      if (result && result.processed) {
        sendToClient(ws, {
          type: 'stream:chunk:processed',
          data: {
            streamId,
            timestamp,
            processingTime: result.processingTime
          }
        });
      }
    }).catch(error => {
      logger.error('Error processing audio chunk', { 
        clientId: clientState.id, 
        streamId,
        error: error.message 
      });
    });
  } catch (error) {
    logger.error('Error handling audio data', { 
      clientId: clientState.id, 
      streamId,
      error: error.message 
    });
    
    sendToClient(ws, {
      type: 'stream:error',
      data: {
        streamId,
        message: 'Error processing audio data',
        details: error.message
      }
    });
  }
}

/**
 * Handle ping message (keep-alive and latency measurement)
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientState - Client state object
 * @param {Object} data - Message data
 */
function handlePing(ws, clientState, data) {
  const { timestamp } = data || {};
  
  // Respond with pong
  sendToClient(ws, {
    type: 'pong',
    data: {
      timestamp: timestamp || Date.now(),
      serverTime: Date.now()
    }
  });
}

/**
 * Handle stream start request
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientState - Client state object
 * @param {Object} data - Message data
 */
async function handleStreamStart(ws, clientState, data) {
  const { format, sampleRate, channels, effects } = data || {};
  
  if (!format) {
    sendToClient(ws, {
      type: 'stream:error',
      data: {
        message: 'Format is required to start a stream'
      }
    });
    return;
  }
  
  try {
    // Create stream
    const streamId = await streamingService.createStream({
      format: format || 'raw',
      sampleRate: sampleRate || 44100,
      channels: channels || 2,
      effects: effects || []
    });
    
    // Store stream in client state
    clientState.activeStreams.set(streamId, {
      id: streamId,
      format,
      sampleRate,
      channels,
      effects,
      startTime: Date.now(),
      chunksReceived: 0,
      bytesReceived: 0
    });
    
    // Configure network conditions based on client metrics
    if (clientState.networkMetrics.bandwidth) {
      adaptiveService.configureStream(streamId, {
        bandwidth: clientState.networkMetrics.bandwidth,
        latency: clientState.networkMetrics.latency
      });
    }
    
    logger.info('Stream started', { 
      clientId: clientState.id, 
      streamId 
    });
    
    sendToClient(ws, {
      type: 'stream:started',
      data: {
        streamId,
        format,
        sampleRate,
        channels
      }
    });
  } catch (error) {
    logger.error('Error starting stream', { 
      clientId: clientState.id, 
      error: error.message 
    });
    
    sendToClient(ws, {
      type: 'stream:error',
      data: {
        message: 'Failed to start stream',
        details: error.message
      }
    });
  }
}

/**
 * Handle stream stop request
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientState - Client state object
 * @param {Object} data - Message data
 */
async function handleStreamStop(ws, clientState, data) {
  const { streamId } = data || {};
  
  if (!streamId) {
    sendToClient(ws, {
      type: 'stream:error',
      data: {
        message: 'Stream ID is required to stop a stream'
      }
    });
    return;
  }
  
  // Check if stream exists
  if (!clientState.activeStreams.has(streamId)) {
    sendToClient(ws, {
      type: 'stream:error',
      data: {
        streamId,
        message: 'Stream not found'
      }
    });
    return;
  }
  
  try {
    // Stop the stream
    await streamingService.stopStream(streamId);
    
    // Get stream stats
    const stream = clientState.activeStreams.get(streamId);
    const duration = Date.now() - stream.startTime;
    
    // Remove from active streams
    clientState.activeStreams.delete(streamId);
    
    logger.info('Stream stopped', { 
      clientId: clientState.id, 
      streamId,
      duration,
      chunksReceived: stream.chunksReceived
    });
    
    sendToClient(ws, {
      type: 'stream:stopped',
      data: {
        streamId,
        duration,
        chunksProcessed: stream.chunksReceived
      }
    });
  } catch (error) {
    logger.error('Error stopping stream', { 
      clientId: clientState.id, 
      streamId,
      error: error.message 
    });
    
    sendToClient(ws, {
      type: 'stream:error',
      data: {
        streamId,
        message: 'Failed to stop stream',
        details: error.message
      }
    });
  }
}

/**
 * Handle real-time processing start request
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientState - Client state object
 * @param {Object} data - Message data
 */
async function handleProcessStart(ws, clientState, data) {
  const { processType, parameters } = data || {};
  
  if (!processType) {
    sendToClient(ws, {
      type: 'process:error',
      data: {
        message: 'Process type is required'
      }
    });
    return;
  }
  
  try {
    // Create job ID
    const jobId = uuidv4();
    
    // Define processing function based on type
    let processingFn;
    let cancellable = true;
    
    switch (processType) {
      case 'analyze':
        processingFn = createAnalysisJob(jobId, parameters, ws, clientState);
        break;
        
      case 'filter':
        processingFn = createFilterJob(jobId, parameters, ws, clientState);
        break;
        
      case 'neural':
        processingFn = createNeuralJob(jobId, parameters, ws, clientState);
        break;
        
      default:
        throw new Error(`Unknown process type: ${processType}`);
    }
    
    // Store processing job in client state
    clientState.processingJobs.set(jobId, {
      id: jobId,
      type: processType,
      parameters,
      startTime: Date.now(),
      cancelFn: null, // Will be set by processing function
      status: 'starting'
    });
    
    // Execute processing function
    processingFn().catch(error => {
      logger.error('Processing job error', { 
        clientId: clientState.id, 
        jobId,
        processType,
        error: error.message 
      });
      
      sendToClient(ws, {
        type: 'process:error',
        data: {
          jobId,
          message: 'Processing error',
          details: error.message
        }
      });
      
      // Clean up job
      if (clientState.processingJobs.has(jobId)) {
        clientState.processingJobs.delete(jobId);
      }
    });
    
    // Send confirmation
    sendToClient(ws, {
      type: 'process:started',
      data: {
        jobId,
        processType,
        cancellable
      }
    });
    
    logger.info('Processing job created', { 
      clientId: clientState.id, 
      jobId,
      processType
    });
  } catch (error) {
    logger.error('Error creating processing job', { 
      clientId: clientState.id, 
      processType,
      error: error.message 
    });
    
    sendToClient(ws, {
      type: 'process:error',
      data: {
        message: 'Failed to create processing job',
        details: error.message
      }
    });
  }
}

/**
 * Create analysis job function
 * 
 * @param {string} jobId - Job ID
 * @param {Object} parameters - Analysis parameters
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientState - Client state object
 * @returns {Function} Async function that performs the analysis
 */
function createAnalysisJob(jobId, parameters, ws, clientState) {
  return async () => {
    const { streamId, analysisType } = parameters || {};
    
    if (!streamId) {
      throw new Error('Stream ID is required for analysis');
    }
    
    if (!clientState.activeStreams.has(streamId)) {
      throw new Error('Stream not found');
    }
    
    // Get the analysis service
    const analysisService = require('../../services/analysis/AnalysisService');
    
    // Update job status
    const job = clientState.processingJobs.get(jobId);
    job.status = 'running';
    
    // Create cancellation function
    let cancelled = false;
    job.cancelFn = () => {
      cancelled = true;
      job.status = 'cancelled';
      
      sendToClient(ws, {
        type: 'process:cancelled',
        data: {
          jobId
        }
      });
    };
    
    // Start analysis
    const stream = clientState.activeStreams.get(streamId);
    
    // Send periodic updates
    const updateInterval = setInterval(() => {
      if (cancelled) {
        clearInterval(updateInterval);
        return;
      }
      
      // Simulate ongoing analysis
      sendToClient(ws, {
        type: 'process:update',
        data: {
          jobId,
          metrics: {
            chunksAnalyzed: stream.chunksReceived,
            processing: true
          }
        }
      });
    }, 1000);
    
    // Define cleanup function
    const cleanup = () => {
      clearInterval(updateInterval);
    };
    
    try {
      // Set up live analysis on stream
      const results = await new Promise((resolve, reject) => {
        const resultsCollector = [];
        
        // Set up analysis handling on streaming service
        const analysisHandler = (chunk, chunkInfo) => {
          if (cancelled) return;
          
          // Analyze chunk
          const result = analysisService.analyzeChunk(chunk, {
            type: analysisType || 'spectrum',
            sampleRate: stream.sampleRate,
            channels: stream.channels
          });
          
          resultsCollector.push(result);
          
          // Send result to client
          sendToClient(ws, {
            type: 'process:result',
            data: {
              jobId,
              partial: true,
              result,
              timestamp: chunkInfo.timestamp
            }
          });
        };
        
        // Register handler
        streamingService.on(`chunk:${streamId}`, analysisHandler);
        
        // Handle stream end
        streamingService.once(`end:${streamId}`, () => {
          streamingService.removeListener(`chunk:${streamId}`, analysisHandler);
          resolve(resultsCollector);
        });
        
        // Set timeout to prevent hanging
        setTimeout(() => {
          streamingService.removeListener(`chunk:${streamId}`, analysisHandler);
          resolve(resultsCollector);
        }, 60000); // 1 minute timeout
      });
      
      if (cancelled) {
        cleanup();
        return;
      }
      
      // Job completed
      job.status = 'completed';
      
      // Send final results
      sendToClient(ws, {
        type: 'process:completed',
        data: {
          jobId,
          results: {
            type: analysisType || 'spectrum',
            count: results.length,
            summary: results.length > 0 ? results[results.length - 1] : null
          }
        }
      });
      
      // Clean up
      cleanup();
      
      // Remove job after completion
      clientState.processingJobs.delete(jobId);
    } catch (error) {
      cleanup();
      throw error;
    }
  };
}

/**
 * Create filter job function
 * 
 * @param {string} jobId - Job ID
 * @param {Object} parameters - Filter parameters
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientState - Client state object
 * @returns {Function} Async function that performs the filtering
 */
function createFilterJob(jobId, parameters, ws, clientState) {
  // Implementation similar to createAnalysisJob but with filtering logic
  // This would apply real-time filters to audio streams
  
  return async () => {
    const { streamId, filterType, filterParams } = parameters || {};
    
    // Similar implementation to analysis job
    // Omitted for brevity
  };
}

/**
 * Create neural processing job function
 * 
 * @param {string} jobId - Job ID
 * @param {Object} parameters - Neural processing parameters
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientState - Client state object
 * @returns {Function} Async function that performs neural processing
 */
function createNeuralJob(jobId, parameters, ws, clientState) {
  // Implementation similar to createAnalysisJob but with neural network processing
  // This would apply ML models to audio data
  
  return async () => {
    const { streamId, modelType, modelParams } = parameters || {};
    
    // Similar implementation to analysis job
    // Omitted for brevity
  };
}

/**
 * Handle processing job cancellation
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientState - Client state object
 * @param {Object} data - Message data
 */
function handleProcessCancel(ws, clientState, data) {
  const { jobId } = data || {};
  
  if (!jobId) {
    sendToClient(ws, {
      type: 'process:error',
      data: {
        message: 'Job ID is required to cancel a processing job'
      }
    });
    return;
  }
  
  // Check if job exists
  if (!clientState.processingJobs.has(jobId)) {
    sendToClient(ws, {
      type: 'process:error',
      data: {
        jobId,
        message: 'Processing job not found'
      }
    });
    return;
  }
  
  const job = clientState.processingJobs.get(jobId);
  
  // Check if job can be cancelled
  if (!job.cancelFn || typeof job.cancelFn !== 'function') {
    sendToClient(ws, {
      type: 'process:error',
      data: {
        jobId,
        message: 'Processing job cannot be cancelled'
      }
    });
    return;
  }
  
  try {
    // Cancel the job
    job.cancelFn();
    
    logger.info('Processing job cancelled', { 
      clientId: clientState.id, 
      jobId,
      duration: Date.now() - job.startTime
    });
    
    sendToClient(ws, {
      type: 'process:cancelled',
      data: {
        jobId
      }
    });
    
    // Remove the job
    clientState.processingJobs.delete(jobId);
  } catch (error) {
    logger.error('Error cancelling processing job', { 
      clientId: clientState.id, 
      jobId,
      error: error.message 
    });
    
    sendToClient(ws, {
      type: 'process:error',
      data: {
        jobId,
        message: 'Failed to cancel processing job',
        details: error.message
      }
    });
  }
}

/**
 * Handle event subscription request
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientState - Client state object
 * @param {Object} data - Message data
 */
function handleSubscribe(ws, clientState, data) {
  const { events } = data || {};
  
  if (!events || !Array.isArray(events) || events.length === 0) {
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Events array is required for subscription'
      }
    });
    return;
  }
  
  // Process each event
  const subscribedEvents = [];
  
  for (const eventName of events) {
    // Check if already subscribed
    if (clientState.subscribedEvents.has(eventName)) {
      continue;
    }
    
    // Create event handler for this client
    const eventHandler = (eventData) => {
      sendToClient(ws, {
        type: 'event',
        data: {
          event: eventName,
          data: eventData,
          timestamp: Date.now()
        }
      });
    };
    
    // Store handler reference for later removal
    if (!clientState.eventHandler) {
      clientState.eventHandler = {};
    }
    clientState.eventHandler[eventName] = eventHandler;
    
    // Subscribe to event
    AudioEventEmitter.on(eventName, eventHandler);
    
    // Add to subscribed set
    clientState.subscribedEvents.add(eventName);
    subscribedEvents.push(eventName);
    
    logger.debug('Client subscribed to event', { 
      clientId: clientState.id, 
      event: eventName 
    });
  }
  
  sendToClient(ws, {
    type: 'subscribed',
    data: {
      events: subscribedEvents,
      total: clientState.subscribedEvents.size
    }
  });
}

/**
 * Handle event unsubscription request
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientState - Client state object
 * @param {Object} data - Message data
 */
function handleUnsubscribe(ws, clientState, data) {
  const { events } = data || {};
  
  if (!events || !Array.isArray(events) || events.length === 0) {
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Events array is required for unsubscription'
      }
    });
    return;
  }
  
  // Process each event
  const unsubscribedEvents = [];
  
  for (const eventName of events) {
    // Check if subscribed
    if (!clientState.subscribedEvents.has(eventName)) {
      continue;
    }
    
    // Get event handler
    const eventHandler = clientState.eventHandler?.[eventName];
    
    if (eventHandler) {
      // Unsubscribe from event
      AudioEventEmitter.removeListener(eventName, eventHandler);
      
      // Remove from subscribed set
      clientState.subscribedEvents.delete(eventName);
      delete clientState.eventHandler[eventName];
      
      unsubscribedEvents.push(eventName);
      
      logger.debug('Client unsubscribed from event', { 
        clientId: clientState.id, 
        event: eventName 
      });
    }
  }
  
  sendToClient(ws, {
    type: 'unsubscribed',
    data: {
      events: unsubscribedEvents,
      total: clientState.subscribedEvents.size
    }
  });
}

/**
 * Handle network metrics update from client
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientState - Client state object
 * @param {Object} data - Message data
 */
function handleNetworkMetrics(ws, clientState, data) {
  const { latency, bandwidth, packetLoss } = data || {};
  
  // Update client state with network metrics
  if (latency !== undefined) {
    clientState.networkMetrics.latency = latency;
  }
  
  if (bandwidth !== undefined) {
    clientState.networkMetrics.bandwidth = bandwidth;
  }
  
  if (packetLoss !== undefined) {
    clientState.networkMetrics.packetLoss = packetLoss;
  }
  
  // Update stream configurations if needed
  for (const [streamId, stream] of clientState.activeStreams.entries()) {
    adaptiveService.configureStream(streamId, {
      bandwidth: clientState.networkMetrics.bandwidth,
      latency: clientState.networkMetrics.latency
    }).catch(error => {
      logger.error('Error configuring stream for network metrics', { 
        clientId: clientState.id, 
        streamId,
        error: error.message 
      });
    });
  }
  
  logger.debug('Updated client network metrics', { 
    clientId: clientState.id, 
    metrics: clientState.networkMetrics 
  });
}

/**
 * Send message to client
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} message - Message to send
 */
function sendToClient(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}