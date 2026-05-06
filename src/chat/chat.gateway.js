// src/chat/chat.gateway.js
import { SIGNALING_EVENTS } from "../signaling/signaling.events.js";
import * as chatService from "./chat.service.js";
import db from "../config/db.js";

export function setupChat(io) {
  const participants = {};

  io.on("connection", (socket) => {
    console.log(`Chat connected: ${socket.id}`);

    socket.on("JOIN_MEETING", async ({ meetingId, userId }) => {
      try {
        // Check if meeting exists in DB
        const result = await db.query("SELECT * FROM meetings WHERE id = $1", [
          meetingId,
        ]);

        if (result.rowCount === 0) {
          socket.emit("INVALID_MEETING", { error: "Meeting not found" });
          return;
        }

        //  Join room and track participants
        socket.join(meetingId);

        if (!participants[meetingId]) participants[meetingId] = new Set();
        participants[meetingId].add(userId);

        io.to(meetingId).emit(
          "PARTICIPANT_LIST",
          Array.from(participants[meetingId])
        );

        // io.to(meetingId).emit("PARTICIPANT_LIST", participants[meetingId]);
      } catch (err) {
        console.error("Error in JOIN_MEETING:", err);
        socket.emit("JOIN_ERROR", { error: "Internal server error" });
      }
    });

    // Join a chat room
    socket.on(SIGNALING_EVENTS.JOIN_CHAT, async ({ meetingId, userId }) => {
      try {
        socket.join(meetingId);

        // Send chat history (last 50 messages)
        const history = await chatService.getMessages(meetingId, 50);
        socket.emit(SIGNALING_EVENTS.CHAT_HISTORY, history);

        // Notify others
        socket.to(meetingId).emit(SIGNALING_EVENTS.CHAT_MESSAGE, {
          userId: "System",
          message: `User ${userId} joined the chat.`,
          time: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Join chat error:", err);
      }
    });

    // Handle chat messages
    socket.on(
      SIGNALING_EVENTS.CHAT_MESSAGE,
      async ({ meetingId, userId, message }) => {
        try {
          const time = new Date().toISOString();
          // await chatService.sendMessage({ meetingId, userId, message, time });

          if (!message || typeof message !== "string" || message.trim() === "")
            return;
          if (!userId || typeof userId !== "string") return;
          if (!meetingId || typeof meetingId !== "string") return;

          await chatService.sendMessage({ meetingId, userId, message, time });

          io.to(meetingId).emit(SIGNALING_EVENTS.CHAT_MESSAGE, {
            userId,
            message,
            time,
          });
        } catch (err) {
          console.error("Chat message error:", err);
        }
      }
    );

    // io.on("connection", (socket) => {
    //    // Should log on every client connect
    // });

    // Leave chat room
    socket.on(SIGNALING_EVENTS.LEAVE_CHAT, ({ meetingId, userId }) => {
      socket.leave(meetingId);
      socket.to(meetingId).emit(SIGNALING_EVENTS.CHAT_MESSAGE, {
        userId: "System",
        message: `User ${userId} left the chat.`,
        time: new Date().toISOString(),
      });
    });
  });
}
