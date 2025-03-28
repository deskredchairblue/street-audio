const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

class WebRTCIntegrationService {
  constructor(server, options = {}) {
    this.io = new Server(server, {
      cors: {
        origin: options.corsOrigin || '*',
        methods: ['GET', 'POST']
      }
    });

    this.rooms = new Map(); // { roomId: Set<socket.id> }

    this._setupSocketEvents();
  }

  /**
   * Setup socket.io events for WebRTC signaling
   */
  _setupSocketEvents() {
    this.io.on('connection', socket => {
      const clientId = uuidv4();
      socket.clientId = clientId;

      console.log(`[WebRTC] Client connected: ${clientId}`);

      // Join room
      socket.on('join-room', ({ roomId }) => {
        if (!this.rooms.has(roomId)) {
          this.rooms.set(roomId, new Set());
        }

        this.rooms.get(roomId).add(socket.id);
        socket.join(roomId);

        console.log(`[WebRTC] ${clientId} joined room ${roomId}`);

        socket.to(roomId).emit('peer-joined', { peerId: socket.id });
      });

      // Signaling: offer
      socket.on('webrtc-offer', ({ targetId, offer }) => {
        this.io.to(targetId).emit('webrtc-offer', {
          from: socket.id,
          offer
        });
      });

      // Signaling: answer
      socket.on('webrtc-answer', ({ targetId, answer }) => {
        this.io.to(targetId).emit('webrtc-answer', {
          from: socket.id,
          answer
        });
      });

      // Signaling: ICE candidates
      socket.on('webrtc-candidate', ({ targetId, candidate }) => {
        this.io.to(targetId).emit('webrtc-candidate', {
          from: socket.id,
          candidate
        });
      });

      // Leave room
      socket.on('leave-room', ({ roomId }) => {
        socket.leave(roomId);
        this.rooms.get(roomId)?.delete(socket.id);
        socket.to(roomId).emit('peer-left', { peerId: socket.id });

        console.log(`[WebRTC] ${clientId} left room ${roomId}`);
      });

      // Disconnect
      socket.on('disconnect', () => {
        for (const [roomId, members] of this.rooms) {
          if (members.has(socket.id)) {
            members.delete(socket.id);
            socket.to(roomId).emit('peer-left', { peerId: socket.id });
          }
        }
        console.log(`[WebRTC] Client disconnected: ${clientId}`);
      });
    });
  }

  /**
   * Get active room participants
   */
  getRoomParticipants(roomId) {
    return this.rooms.get(roomId) || new Set();
  }
}

module.exports = WebRTCIntegrationService;
