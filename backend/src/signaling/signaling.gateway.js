// src/signaling/signaling.gateway.js
import { SIGNALING_EVENTS } from "./signaling.events.js";
import {
  addChatMessage,
  canSendChat,
  getChatHistory,
  getParticipant,
  joinRoom,
  leaveRoom,
  listParticipants,
  normalizeName,
  updateMediaState,
} from "./room-state.js";

export function setupSignaling(io) {
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on(SIGNALING_EVENTS.JOIN_MEETING, ({ meetingId, roomId, userId, name, media } = {}) => {
      const normalizedRoomId = meetingId || roomId;
      if (!normalizedRoomId) {
        socket.emit("ROOM_ERROR", { error: "Missing meetingId" });
        return;
      }

      const existingParticipants = listParticipants(normalizedRoomId);
      const participant = joinRoom({
        socket,
        roomId: normalizedRoomId,
        userId,
        name: normalizeName(name, socket.id),
        media,
      });

      socket.join(normalizedRoomId);
      socket.emit(SIGNALING_EVENTS.ROOM_PARTICIPANTS, {
        roomId: normalizedRoomId,
        participants: listParticipants(normalizedRoomId),
      });
      socket.emit(SIGNALING_EVENTS.CHAT_HISTORY, getChatHistory(normalizedRoomId));

      socket.to(normalizedRoomId).emit(SIGNALING_EVENTS.USER_JOINED, {
        socketId: socket.id,
        userId: participant.userId,
        name: participant.name,
        media: participant.media,
      });
      io.to(normalizedRoomId).emit(SIGNALING_EVENTS.ROOM_PARTICIPANTS, {
        roomId: normalizedRoomId,
        participants: listParticipants(normalizedRoomId),
      });

      socket.emit("room:existing-participants", {
        roomId: normalizedRoomId,
        participants: existingParticipants,
      });
    });

    socket.on(SIGNALING_EVENTS.OFFER, ({ target, sdp, from }) => {
      const senderName = socket.data.name || normalizeName("", socket.id);
      io.to(target).emit(SIGNALING_EVENTS.OFFER, {
        sdp,
        from: from || socket.id,
        fromName: senderName,
      });
    });

    socket.on(SIGNALING_EVENTS.ANSWER, ({ target, sdp, from }) => {
      const senderName = socket.data.name || normalizeName("", socket.id);
      io.to(target).emit(SIGNALING_EVENTS.ANSWER, {
        sdp,
        from: from || socket.id,
        fromName: senderName,
      });
    });

    socket.on(SIGNALING_EVENTS.ICE_CANDIDATE, ({ target, candidate, from }) => {
      io.to(target).emit(SIGNALING_EVENTS.ICE_CANDIDATE, {
        candidate,
        from: from || socket.id,
      });
    });

    socket.on(SIGNALING_EVENTS.MEDIA_STATE, (media = {}) => {
      const participant = updateMediaState(socket.id, media);
      if (!participant) return;

      io.to(participant.roomId).emit(SIGNALING_EVENTS.PARTICIPANT_MEDIA_STATE, {
        socketId: socket.id,
        media: participant.media,
      });
      io.to(participant.roomId).emit(SIGNALING_EVENTS.ROOM_PARTICIPANTS, {
        roomId: participant.roomId,
        participants: listParticipants(participant.roomId),
      });
    });

    socket.on(SIGNALING_EVENTS.CHAT_MESSAGE, ({ meetingId, roomId, content, message } = {}) => {
      const participant = getParticipant(socket.id);
      const normalizedRoomId = meetingId || roomId || socket.data.roomId;
      const text = typeof content === "string" ? content.trim() : typeof message === "string" ? message.trim() : "";
      if (!participant || !normalizedRoomId || !text || !canSendChat(socket.id)) return;

      const chatMessage = addChatMessage(normalizedRoomId, {
        id: `${Date.now()}_${socket.id}`,
        senderId: socket.id,
        userId: socket.data.userId || socket.id,
        senderName: socket.data.name || normalizeName("", socket.id),
        content: text.slice(0, 2000),
        timestamp: Date.now(),
      });

      io.to(normalizedRoomId).emit(SIGNALING_EVENTS.CHAT_MESSAGE, chatMessage);
    });

    socket.on(SIGNALING_EVENTS.LEAVE_MEETING, () => {
      const participant = leaveRoom(socket.id);
      if (!participant?.roomId) return;
      socket.leave(participant.roomId);
      socket.to(participant.roomId).emit(SIGNALING_EVENTS.USER_LEFT, {
        socketId: socket.id,
      });
      io.to(participant.roomId).emit(SIGNALING_EVENTS.ROOM_PARTICIPANTS, {
        roomId: participant.roomId,
        participants: listParticipants(participant.roomId),
      });
    });

    socket.on("disconnect", () => {
      const participant = leaveRoom(socket.id);
      if (participant?.roomId) {
        socket.to(participant.roomId).emit(SIGNALING_EVENTS.USER_LEFT, {
          socketId: socket.id,
        });
        io.to(participant.roomId).emit(SIGNALING_EVENTS.ROOM_PARTICIPANTS, {
          roomId: participant.roomId,
          participants: listParticipants(participant.roomId),
        });
      }

    });

    socket.on("LEGACY_JOIN_MEETING", ({ meetingId, userId }) => {
      socket.join(meetingId);
      socket.to(meetingId).emit(SIGNALING_EVENTS.USER_JOINED, {
        userId,
        socketId: socket.id,
      });
    });
  });
}
