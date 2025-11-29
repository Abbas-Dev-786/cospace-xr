// Node.js WebSocket server for real-time multiplayer sync
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingInterval: 10000, // 10 seconds
  pingTimeout: 5000, // 5 seconds
});

// Store active rooms and users
const rooms = new Map();
const users = new Map();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  /**
   * User joins a room (max 4 users per room)
   */
  socket.on("join-room", (data) => {
    const { roomId, userId, color } = data;

    // Check room capacity
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    const room = rooms.get(roomId);

    if (room.size >= 4) {
      socket.emit("room-full");
      return;
    }

    // Join room
    socket.join(roomId);
    room.add(socket.id);

    users.set(socket.id, { userId, roomId, color });

    // Notify others in room
    socket.to(roomId).emit("user-joined", { userId, color });

    // Send existing users to new user
    const existingUsers = Array.from(room)
      .filter((id) => id !== socket.id)
      .map((id) => users.get(id));

    socket.emit("room-joined", { users: existingUsers });

    console.log(`User ${userId} joined room ${roomId} (${room.size}/4)`);
  });

  /**
   * Broadcast avatar transform updates (head, hands)
   */
  socket.on("update-transform", (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    // Forward to all others in room
    socket.to(user.roomId).emit("remote-transform", {
      userId: user.userId,
      ...data,
    });
  });

  /**
   * Broadcast gesture updates
   */
  socket.on("update-gesture", (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    socket.to(user.roomId).emit("remote-gesture", {
      userId: user.userId,
      ...data,
    });
  });

  /**
   * Task board synchronization
   */
  socket.on("task-update", (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    // Broadcast task change to room
    socket.to(user.roomId).emit("task-changed", data);
  });

  /**
   * Voice-to-text comment
   */
  socket.on("voice-comment", (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    socket.to(user.roomId).emit("new-comment", {
      userId: user.userId,
      ...data,
    });
  });

  /**
   * Handle disconnection
   */
  socket.on("disconnect", () => {
    const user = users.get(socket.id);

    if (user) {
      const room = rooms.get(user.roomId);
      if (room) {
        room.delete(socket.id);

        // Notify others
        socket.to(user.roomId).emit("user-left", { userId: user.userId });

        // Clean up empty rooms
        if (room.size === 0) {
          rooms.delete(user.roomId);
        }
      }

      users.delete(socket.id);
      console.log(`User ${user.userId} disconnected from ${user.roomId}`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ WebSocket server running on port ${PORT}`);
});
