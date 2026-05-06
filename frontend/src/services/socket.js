import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

let socket;

export const initiateSocketConnection = (meetingId, userId) => {
  socket = io(SOCKET_URL, {
    transports: ["websocket"],
    query: { meetingId, userId },
  });
  
  console.log(`Connecting socket...`);
  return socket;
};

export const disconnectSocket = () => {
  console.log("Disconnecting socket...");
  if (socket) socket.disconnect();
};

export const getSocket = () => socket;

export const joinMeeting = (meetingId, userId) => {
  if (socket) {
    socket.emit("JOIN_MEETING", { meetingId, userId });
  }
};

export const sendMessage = (meetingId, userId, message) => {
  if (socket) {
    socket.emit("CHAT_MESSAGE", { meetingId, userId, message });
  }
};

export const subscribeToChat = (cb) => {
  if (!socket) return true;
  socket.on("CHAT_MESSAGE", (msg) => {
    return cb(null, msg);
  });
};

export const subscribeToParticipants = (cb) => {
  if (!socket) return true;
  socket.on("PARTICIPANT_LIST", (list) => {
    return cb(null, list);
  });
};
