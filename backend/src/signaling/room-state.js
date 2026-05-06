const rooms = new Map();
const socketToRoom = new Map();
const chatHistory = new Map();
const chatWindows = new Map();

const MAX_CHAT_MESSAGES = 250;
const CHAT_WINDOW_MS = 5000;
const CHAT_WINDOW_LIMIT = 10;

function nowIso() {
  return new Date().toISOString();
}

export function normalizeName(name, socketId = "") {
  const cleaned = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (cleaned) return cleaned.slice(0, 80);
  return `Guest ${socketId.slice(0, 4) || "User"}`;
}

export function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  return rooms.get(roomId);
}

export function getParticipant(socketId) {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return null;
  return getRoom(roomId).get(socketId) || null;
}

export function listParticipants(roomId) {
  return Array.from(getRoom(roomId).entries()).map(([socketId, participant]) => ({
    socketId,
    id: socketId,
    userId: participant.userId,
    name: participant.name,
    joinedAt: participant.joinedAt,
    media: participant.media,
  }));
}

export function joinRoom({ socket, roomId, userId, name, media = {} }) {
  leaveRoom(socket.id);

  const participant = {
    socketId: socket.id,
    userId: userId || socket.id,
    roomId,
    name: normalizeName(name, socket.id),
    joinedAt: Date.now(),
    media: {
      micOn: media.micOn !== false,
      camOn: media.camOn !== false,
      screenSharing: Boolean(media.screenSharing),
    },
  };

  getRoom(roomId).set(socket.id, participant);
  socketToRoom.set(socket.id, roomId);
  socket.data.roomId = roomId;
  socket.data.userId = participant.userId;
  socket.data.name = participant.name;

  console.log(`[${nowIso()}] join room=${roomId} socket=${socket.id} name="${participant.name}"`);
  return participant;
}

export function updateMediaState(socketId, nextMedia) {
  const participant = getParticipant(socketId);
  if (!participant) return null;

  participant.media = {
    ...participant.media,
    ...Object.fromEntries(
      Object.entries(nextMedia || {}).filter(([, value]) => typeof value === "boolean")
    ),
  };

  return participant;
}

export function leaveRoom(socketId) {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return null;

  const room = getRoom(roomId);
  const participant = room.get(socketId);
  room.delete(socketId);
  socketToRoom.delete(socketId);
  chatWindows.delete(socketId);

  if (room.size === 0) {
    rooms.delete(roomId);
    chatHistory.delete(roomId);
  }

  if (participant) {
    console.log(`[${nowIso()}] leave room=${roomId} socket=${socketId} name="${participant.name}"`);
  }

  return participant || { socketId, roomId };
}

export function getChatHistory(roomId) {
  return chatHistory.get(roomId) || [];
}

export function canSendChat(socketId) {
  const now = Date.now();
  const windowState = chatWindows.get(socketId) || { startedAt: now, count: 0 };

  if (now - windowState.startedAt > CHAT_WINDOW_MS) {
    chatWindows.set(socketId, { startedAt: now, count: 1 });
    return true;
  }

  if (windowState.count >= CHAT_WINDOW_LIMIT) return false;

  windowState.count += 1;
  chatWindows.set(socketId, windowState);
  return true;
}

export function addChatMessage(roomId, message) {
  const history = getChatHistory(roomId);
  const nextHistory = [...history, message].slice(-MAX_CHAT_MESSAGES);
  chatHistory.set(roomId, nextHistory);
  return message;
}
