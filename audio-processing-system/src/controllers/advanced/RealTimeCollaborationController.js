// src/controllers/advanced/RealTimeCollaborationController.js

const { Server } = require("socket.io");

class RealTimeCollaborationController {
  constructor(server) {
    this.io = new Server(server, {
      cors: { origin: "*" },
    });

    this.io.on("connection", (socket) => {
      console.log("User connected:", socket.id);

      socket.on("join-session", ({ projectId, user }) => {
        socket.join(projectId);
        this.io.to(projectId).emit("user-joined", { user, socketId: socket.id });
      });

      socket.on("track-update", ({ projectId, track }) => {
        socket.to(projectId).emit("track-update", track);
      });

      socket.on("cursor-move", ({ projectId, cursor }) => {
        socket.to(projectId).emit("cursor-move", cursor);
      });

      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
      });
    });
  }
}

module.exports = RealTimeCollaborationController;
