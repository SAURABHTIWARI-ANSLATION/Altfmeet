// src/chat/chat.gateway.js
import * as meetingModel from "../meetings/meeting.model.js";

export function setupChat(io) {
  const participants = {};

  io.on("connection", (socket) => {
    // Participant joins meeting
    socket.on("JOIN_MEETING", async ({ meetingId, userId }) => {
      try {
        const meeting = await meetingModel.getMeetingById(meetingId);
        if (!meeting) {
          socket.emit("INVALID_MEETING", { error: "Meeting not found" });
          return;
        }

        socket.join(meetingId);
        if (!participants[meetingId]) participants[meetingId] = new Set();
        participants[meetingId].add(userId);

        // Sync participant list to everyone in the room
        io.to(meetingId).emit("PARTICIPANT_LIST", Array.from(participants[meetingId]));
        
        console.log(`User ${userId} joined room ${meetingId}`);
      } catch (err) {
        console.error("Error in JOIN_MEETING:", err);
      }
    });

    // Handle leaving
    socket.on("disconnecting", () => {
      socket.rooms.forEach(room => {
        if (participants[room]) {
          // We don't have userId here easily, so we rely on explicit LEAVE_MEETING 
          // or we can track socketId -> userId mapping.
        }
      });
    });

    socket.on("LEAVE_MEETING", ({ meetingId, userId }) => {
      socket.leave(meetingId);
      if (participants[meetingId]) {
        participants[meetingId].delete(userId);
        io.to(meetingId).emit("PARTICIPANT_LIST", Array.from(participants[meetingId]));
      }
    });
  });
}
