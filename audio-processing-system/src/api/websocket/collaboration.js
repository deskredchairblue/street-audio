/**
 * @module api/websocket/collaboration
 * @description Real-time collaboration WebSocket API for multi-user audio editing
 * 
 * This module implements WebSocket-based collaboration features that enable multiple
 * users to work simultaneously on audio projects with real-time synchronization.
 * It handles operation broadcasting, conflict resolution, presence tracking,
 * and session management for distributed audio editing workflows.
 */

'use strict';

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/helpers/AudioLogger');
const RealTimeCollaborationController = require('../../controllers/advanced/RealTimeCollaborationController');
const AudioProject = require('../../models/user/AudioProject');

// Initialize controllers
const collaborationController = new RealTimeCollaborationController();

// Track active collaboration sessions
const sessions = new Map();
const clientSessions = new Map();

/**
 * Initialize WebSocket server for real-time collaboration
 * 
 * @param {Object} server - HTTP/HTTPS server instance
 * @returns {WebSocket.Server} Configured WebSocket server
 */
function initializeWebSocketServer(server) {
  const operationId = logger.startTimer('initialize-collaboration-websocket');
  
  const wss = new WebSocket.Server({
    server,
    path: '/api/ws/collaboration'
  });
  
  // Setup connection handler
  wss.on('connection', handleConnection);
  
  // Setup error handler
  wss.on('error', error => {
    logger.error('Collaboration WebSocket server error', { error: error.message });
  });
  
  logger.stopTimer(operationId);
  logger.info('Collaboration WebSocket server initialized');
  
  return wss;
}

/**
 * Handle new WebSocket connection for collaboration
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} req - HTTP request that initiated the connection
 */
function handleConnection(ws, req) {
  const clientId = uuidv4();
  const operationId = logger.startTimer('collaboration-connection', { clientId });
  
  // Extract client information
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Parse connection parameters from URL query
  const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const userId = urlParams.get('userId');
  const username = urlParams.get('username') || 'Anonymous';
  const sessionId = urlParams.get('sessionId');
  
  if (!userId) {
    logger.warn('Collaboration connection without userId', { clientId, clientIp });
    ws.close(4000, 'User ID is required');
    return;
  }
  
  // Initialize client state
  const clientState = {
    id: clientId,
    userId,
    username,
    ip: clientIp,
    connectionTime: Date.now(),
    lastActivity: Date.now(),
    sessionId: null,
    role: null,
    presence: {
      status: 'online',
      cursor: null,
      selection: null,
      view: null,
      lastActive: Date.now()
    }
  };
  
  // Store client connection for later reference
  const clientInfo = { ws, state: clientState };
  
  // Send welcome message
  sendToClient(ws, {
    type: 'connection',
    data: {
      clientId,
      timestamp: Date.now(),
      message: 'Connected to collaboration API'
    }
  });
  
  // Setup message handler
  ws.on('message', message => handleMessage(ws, clientInfo, message));
  
  // Setup connection close handler
  ws.on('close', () => handleDisconnection(clientInfo));
  
  // Setup error handler
  ws.on('error', error => {
    logger.error('Collaboration client error', { 
      clientId, 
      error: error.message 
    });
  });
  
  // If session ID provided, join the session
  if (sessionId) {
    joinSession(ws, clientInfo, { sessionId });
  }
  
  logger.stopTimer(operationId);
}

/**
 * Handle client disconnection
 * 
 * @param {Object} clientInfo - Client information object
 */
function handleDisconnection(clientInfo) {
  const { state: clientState } = clientInfo;
  const operationId = logger.startTimer('collaboration-disconnection', { 
    clientId: clientState.id 
  });
  
  // Leave active session if any
  if (clientState.sessionId) {
    leaveSession(clientInfo);
  }
  
  logger.info('Collaboration client disconnected', { 
    clientId: clientState.id, 
    userId: clientState.userId,
    connectionDuration: Date.now() - clientState.connectionTime 
  });
  
  logger.stopTimer(operationId);
}

/**
 * Handle incoming WebSocket message
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientInfo - Client information
 * @param {string|Buffer} message - Received message
 */
function handleMessage(ws, clientInfo, message) {
  const { state: clientState } = clientInfo;
  clientState.lastActivity = Date.now();
  
  let parsedMessage;
  
  try {
    parsedMessage = JSON.parse(message);
    const { type, data } = parsedMessage;
    
    if (!type) {
      throw new Error('Message type is required');
    }
    
    const operationId = logger.startTimer(`collaboration-message-${type}`, { 
      clientId: clientState.id 
    });
    
    // Process message based on type
    switch (type) {
      case 'ping':
        handlePing(ws, clientInfo);
        break;
        
      case 'session:create':
        createSession(ws, clientInfo, data);
        break;
        
      case 'session:join':
        joinSession(ws, clientInfo, data);
        break;
        
      case 'session:leave':
        leaveSession(clientInfo);
        break;
        
      case 'operation':
        handleOperation(clientInfo, data);
        break;
        
      case 'presence:update':
        updatePresence(clientInfo, data);
        break;
        
      case 'chat:message':
        handleChatMessage(clientInfo, data);
        break;
        
      case 'project:sync':
        syncProject(ws, clientInfo);
        break;
        
      default:
        logger.warn('Unknown collaboration message type', { 
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
    logger.error('Error processing collaboration message', { 
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
 * Handle ping message (for connection health monitoring)
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientInfo - Client information
 */
function handlePing(ws, clientInfo) {
  const { state: clientState } = clientInfo;
  
  // Update presence
  clientState.presence.lastActive = Date.now();
  
  // Respond with pong
  sendToClient(ws, {
    type: 'pong',
    data: {
      timestamp: Date.now()
    }
  });
  
  // If in a session, broadcast presence update
  if (clientState.sessionId) {
    broadcastPresenceUpdates(clientState.sessionId);
  }
}

/**
 * Create a new collaboration session
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientInfo - Client information
 * @param {Object} data - Message data
 */
function createSession(ws, clientInfo, data) {
  const { state: clientState } = clientInfo;
  const { projectId, name } = data || {};
  
  if (!projectId) {
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Project ID is required to create a session'
      }
    });
    return;
  }
  
  try {
    // Create session ID
    const sessionId = uuidv4();
    
    // Create session
    const session = {
      id: sessionId,
      projectId,
      name: name || `Collaboration on ${projectId}`,
      createdAt: Date.now(),
      createdBy: clientState.userId,
      participants: new Map(),
      operations: [],
      chatHistory: [],
      projectVersion: 0
    };
    
    // Add session to sessions map
    sessions.set(sessionId, session);
    
    // Join the newly created session
    joinSession(ws, clientInfo, { sessionId, role: 'admin' });
    
    logger.info('Collaboration session created', { 
      clientId: clientState.id, 
      sessionId,
      projectId
    });
  } catch (error) {
    logger.error('Error creating collaboration session', { 
      clientId: clientState.id, 
      projectId,
      error: error.message 
    });
    
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Failed to create collaboration session',
        details: error.message
      }
    });
  }
}

/**
 * Join an existing collaboration session
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientInfo - Client information
 * @param {Object} data - Message data
 */
function joinSession(ws, clientInfo, data) {
  const { state: clientState } = clientInfo;
  const { sessionId, role } = data || {};
  
  if (!sessionId) {
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Session ID is required to join a session'
      }
    });
    return;
  }
  
  try {
    // Check if session exists
    const session = sessions.get(sessionId);
    
    if (!session) {
      sendToClient(ws, {
        type: 'error',
        data: {
          message: 'Collaboration session not found',
          sessionId
        }
      });
      return;
    }
    
    // Leave current session if any
    if (clientState.sessionId && clientState.sessionId !== sessionId) {
      leaveSession(clientInfo);
    }
    
    // Add client to session participants
    const participant = {
      clientId: clientState.id,
      userId: clientState.userId,
      username: clientState.username,
      role: role || 'editor',
      joinedAt: Date.now(),
      presence: clientState.presence
    };
    
    session.participants.set(clientState.id, participant);
    
    // Update client state
    clientState.sessionId = sessionId;
    clientState.role = participant.role;
    
    // Associate client with session for easy lookup
    if (!clientSessions.has(clientState.id)) {
      clientSessions.set(clientState.id, sessionId);
    }
    
    // Send session information
    sendToClient(ws, {
      type: 'session:joined',
      data: {
        sessionId,
        name: session.name,
        projectId: session.projectId,
        role: participant.role,
        participantCount: session.participants.size,
        operationCount: session.operations.length,
        projectVersion: session.projectVersion
      }
    });
    
    // Send participants list
    sendParticipantsList(ws, session);
    
    // Send recent operations
    sendRecentOperations(ws, session);
    
    // Send recent chat messages
    sendRecentChatMessages(ws, session);
    
    // Broadcast join notification to other participants
    broadcastToSession(sessionId, {
      type: 'participant:joined',
      data: {
        clientId: clientState.id,
        userId: clientState.userId,
        username: clientState.username,
        role: participant.role,
        timestamp: participant.joinedAt
      }
    }, [clientState.id]);
    
    logger.info('Client joined collaboration session', { 
      clientId: clientState.id, 
      sessionId,
      role: participant.role
    });
  } catch (error) {
    logger.error('Error joining collaboration session', { 
      clientId: clientState.id, 
      sessionId,
      error: error.message 
    });
    
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Failed to join collaboration session',
        details: error.message
      }
    });
  }
}

/**
 * Leave the current collaboration session
 * 
 * @param {Object} clientInfo - Client information
 */
function leaveSession(clientInfo) {
  const { ws, state: clientState } = clientInfo;
  
  if (!clientState.sessionId) {
    return;
  }
  
  try {
    const sessionId = clientState.sessionId;
    const session = sessions.get(sessionId);
    
    if (session) {
      // Remove client from session participants
      session.participants.delete(clientState.id);
      
      // Broadcast leave notification
      broadcastToSession(sessionId, {
        type: 'participant:left',
        data: {
          clientId: clientState.id,
          userId: clientState.userId,
          username: clientState.username,
          timestamp: Date.now()
        }
      });
      
      // Clean up empty sessions
      if (session.participants.size === 0) {
        sessions.delete(sessionId);
        logger.info('Collaboration session closed (no participants)', { sessionId });
      } else if (clientState.userId === session.createdBy) {
        // Reassign admin role if creator leaves
        const nextParticipant = session.participants.values().next().value;
        if (nextParticipant) {
          nextParticipant.role = 'admin';
          
          // Notify the new admin
          const adminClientInfo = getClientById(nextParticipant.clientId);
          if (adminClientInfo) {
            sendToClient(adminClientInfo.ws, {
              type: 'role:changed',
              data: {
                role: 'admin',
                message: 'You are now the session admin'
              }
            });
          }
        }
      }
    }
    
    // Remove client-session association
    clientSessions.delete(clientState.id);
    
    // Reset client state
    clientState.sessionId = null;
    clientState.role = null;
    
    // Confirm session left
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendToClient(ws, {
        type: 'session:left',
        data: {
          sessionId,
          timestamp: Date.now()
        }
      });
    }
    
    logger.info('Client left collaboration session', { 
      clientId: clientState.id, 
      sessionId
    });
  } catch (error) {
    logger.error('Error leaving collaboration session', { 
      clientId: clientState.id, 
      sessionId: clientState.sessionId,
      error: error.message 
    });
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendToClient(ws, {
        type: 'error',
        data: {
          message: 'Error leaving collaboration session',
          details: error.message
        }
      });
    }
  }
}

/**
 * Handle operation from client
 * 
 * @param {Object} clientInfo - Client information
 * @param {Object} data - Operation data
 */
function handleOperation(clientInfo, data) {
  const { ws, state: clientState } = clientInfo;
  const { type, target, parameters } = data || {};
  
  if (!clientState.sessionId) {
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Not in a collaboration session'
      }
    });
    return;
  }
  
  if (!type || !target) {
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Operation type and target are required'
      }
    });
    return;
  }
  
  try {
    const session = sessions.get(clientState.sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Create operation record
    const operation = {
      id: uuidv4(),
      type,
      target,
      parameters: parameters || {},
      timestamp: Date.now(),
      clientId: clientState.id,
      userId: clientState.userId,
      username: clientState.username,
      version: session.projectVersion + 1
    };
    
    // Process operation
    const result = collaborationController.processOperation(operation, session.projectId);
    
    // Update project version
    session.projectVersion++;
    
    // Store operation
    session.operations.push(operation);
    
    // Keep only the latest 100 operations
    if (session.operations.length > 100) {
      session.operations = session.operations.slice(-100);
    }
    
    // Broadcast operation to all participants
    broadcastToSession(clientState.sessionId, {
      type: 'operation',
      data: {
        ...operation,
        result
      }
    });
    
    logger.debug('Processed collaboration operation', {
      clientId: clientState.id,
      sessionId: clientState.sessionId,
      operationType: type,
      target
    });
  } catch (error) {
    logger.error('Error processing operation', { 
      clientId: clientState.id, 
      sessionId: clientState.sessionId,
      error: error.message 
    });
    
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Failed to process operation',
        details: error.message
      }
    });
  }
}

/**
 * Update client presence information
 * 
 * @param {Object} clientInfo - Client information
 * @param {Object} data - Presence data
 */
function updatePresence(clientInfo, data) {
  const { ws, state: clientState } = clientInfo;
  
  if (!clientState.sessionId) {
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Not in a collaboration session'
      }
    });
    return;
  }
  
  try {
    // Update presence data
    if (data.status) {
      clientState.presence.status = data.status;
    }
    
    if (data.cursor) {
      clientState.presence.cursor = data.cursor;
    }
    
    if (data.selection) {
      clientState.presence.selection = data.selection;
    }
    
    if (data.view) {
      clientState.presence.view = data.view;
    }
    
    clientState.presence.lastActive = Date.now();
    
    // Update session participant
    const session = sessions.get(clientState.sessionId);
    
    if (session && session.participants.has(clientState.id)) {
      const participant = session.participants.get(clientState.id);
      participant.presence = { ...clientState.presence };
    }
    
    // Broadcast presence update to other participants
    broadcastToSession(clientState.sessionId, {
      type: 'presence:update',
      data: {
        clientId: clientState.id,
        userId: clientState.userId,
        username: clientState.username,
        presence: clientState.presence
      }
    }, [clientState.id]);
    
    logger.debug('Updated client presence', {
      clientId: clientState.id,
      sessionId: clientState.sessionId,
      status: clientState.presence.status
    });
  } catch (error) {
    logger.error('Error updating presence', { 
      clientId: clientState.id, 
      sessionId: clientState.sessionId,
      error: error.message 
    });
  }
}

/**
 * Handle chat message from client
 * 
 * @param {Object} clientInfo - Client information
 * @param {Object} data - Chat message data
 */
function handleChatMessage(clientInfo, data) {
  const { ws, state: clientState } = clientInfo;
  const { content } = data || {};
  
  if (!clientState.sessionId) {
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Not in a collaboration session'
      }
    });
    return;
  }
  
  if (!content) {
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Message content is required'
      }
    });
    return;
  }
  
  try {
    const session = sessions.get(clientState.sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Create message record
    const message = {
      id: uuidv4(),
      content,
      timestamp: Date.now(),
      clientId: clientState.id,
      userId: clientState.userId,
      username: clientState.username
    };
    
    // Store message
    session.chatHistory.push(message);
    
    // Keep only the latest 100 messages
    if (session.chatHistory.length > 100) {
      session.chatHistory = session.chatHistory.slice(-100);
    }
    
    // Broadcast message to all participants
    broadcastToSession(clientState.sessionId, {
      type: 'chat:message',
      data: message
    });
    
    logger.debug('Processed chat message', {
      clientId: clientState.id,
      sessionId: clientState.sessionId,
      messageId: message.id
    });
  } catch (error) {
    logger.error('Error processing chat message', { 
      clientId: clientState.id, 
      sessionId: clientState.sessionId,
      error: error.message 
    });
    
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Failed to process chat message',
        details: error.message
      }
    });
  }
}

/**
 * Synchronize project state for client
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} clientInfo - Client information
 */
function syncProject(ws, clientInfo) {
  const { state: clientState } = clientInfo;
  
  if (!clientState.sessionId) {
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Not in a collaboration session'
      }
    });
    return;
  }
  
  try {
    const session = sessions.get(clientState.sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Get project from storage
    const projectStorage = new Map(); // This would be imported from a shared module
    const project = projectStorage.get(session.projectId);
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Send project state
    sendToClient(ws, {
      type: 'project:sync',
      data: {
        projectId: project.id,
        name: project.name,
        state: project.toJSON(), // Convert project to serializable format
        version: session.projectVersion,
        timestamp: Date.now()
      }
    });
    
    logger.debug('Synchronized project state', {
      clientId: clientState.id,
      sessionId: clientState.sessionId,
      projectId: session.projectId,
      version: session.projectVersion
    });
  } catch (error) {
    logger.error('Error synchronizing project', { 
      clientId: clientState.id, 
      sessionId: clientState.sessionId,
      error: error.message 
    });
    
    sendToClient(ws, {
      type: 'error',
      data: {
        message: 'Failed to synchronize project',
        details: error.message
      }
    });
  }
}

/**
 * Send participants list to client
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} session - Collaboration session
 */
function sendParticipantsList(ws, session) {
  const participants = Array.from(session.participants.values()).map(p => ({
    clientId: p.clientId,
    userId: p.userId,
    username: p.username,
    role: p.role,
    joinedAt: p.joinedAt,
    presence: p.presence
  }));
  
  sendToClient(ws, {
    type: 'session:participants',
    data: {
      sessionId: session.id,
      participants,
      count: participants.length
    }
  });
}

/**
 * Send recent operations to client
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} session - Collaboration session
 */
function sendRecentOperations(ws, session) {
  // Send only the last 50 operations
  const recentOperations = session.operations.slice(-50);
  
  sendToClient(ws, {
    type: 'session:operations',
    data: {
      sessionId: session.id,
      operations: recentOperations,
      count: recentOperations.length,
      totalCount: session.operations.length
    }
  });
}

/**
 * Send recent chat messages to client
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} session - Collaboration session
 */
function sendRecentChatMessages(ws, session) {
  // Send only the last 50 messages
  const recentMessages = session.chatHistory.slice(-50);
  
  sendToClient(ws, {
    type: 'session:chat-history',
    data: {
      sessionId: session.id,
      messages: recentMessages,
      count: recentMessages.length,
      totalCount: session.chatHistory.length
    }
  });
}

/**
 * Broadcast message to all participants in a session
 * 
 * @param {string} sessionId - Session ID
 * @param {Object} message - Message to broadcast
 * @param {Array<string>} [excludeClients=[]] - Client IDs to exclude
 */
function broadcastToSession(sessionId, message, excludeClients = []) {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return;
  }
  
  for (const [clientId, participant] of session.participants.entries()) {
    if (excludeClients.includes(clientId)) {
      continue;
    }
    
    const clientInfo = getClientById(clientId);
    
    if (clientInfo && clientInfo.ws.readyState === WebSocket.OPEN) {
      sendToClient(clientInfo.ws, message);
    }
  }
}

/**
 * Broadcast presence updates to all participants in a session
 * 
 * @param {string} sessionId - Session ID
 */
function broadcastPresenceUpdates(sessionId) {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return;
  }
  
  // Create presence update message for each participant
  for (const [clientId, participant] of session.participants.entries()) {
    const presenceUpdate = {
      type: 'presence:update',
      data: {
        clientId,
        userId: participant.userId,
        username: participant.username,
        presence: participant.presence
      }
    };
    
    // Send to all other participants
    broadcastToSession(sessionId, presenceUpdate, [clientId]);
  }
}

/**
 * Get client information by client ID
 * 
 * @param {string} clientId - Client ID
 * @returns {Object|null} Client information or null if not found
 */
function getClientById(clientId) {
  // This function would retrieve client information from a map of connected clients
  // For the purpose of this implementation, we'll return null
  return null;
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

module.exports = {
  initializeWebSocketServer
};