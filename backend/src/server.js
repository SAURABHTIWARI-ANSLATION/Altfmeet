// src/main.js
import dotenv from "dotenv";
dotenv.config();
import http from "http";
import path from "path";
import express from "express";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import app from "./app.js";
import { setupSignaling } from "./signaling/signaling.gateway.js";
import { setupChat } from "./chat/chat.gateway.js";
import { setupMediasoup } from "./media/mediasoup.config.js";
import { setupMedia } from "./media/media.gateway.js";
import { corsOptions } from "./config/cors.js";
import { authenticateSocket } from "./auth/auth.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendDistPath = path.join(__dirname, "../../frontend/dist");

// Serve the built frontend from the repo-level Vite app.
app.use(express.static(frontendDistPath));

// Catch-all route for SPA (serves index.html for any unknown path)
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});
io.use(authenticateSocket);

// Setup Mediasoup SFU before accepting RTC clients.
await setupMediasoup(io);
// Setup signaling and chat
setupSignaling(io);
setupChat(io);
setupMedia(io);

// Socket.IO connection logs
io.on("connection", (socket) => {
  socket.emit("PING", "Socket.IO is working");
  console.log("Socket.IO connected:", socket.id);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
