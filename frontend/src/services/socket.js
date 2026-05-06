import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

let socket;

export const initiateSocketConnection = () => {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    transports: ["websocket"],
  });
  
  console.log("Connecting socket...");
  return socket;
};

export const disconnectSocket = () => {
  console.log("Disconnecting socket...");
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export const joinMeeting = ({ meetingId, userId, name, media }) => {
  if (socket) {
    socket.emit("JOIN_MEETING", { meetingId, userId, name, media });
  }
};

export const leaveMeeting = () => {
  if (socket) {
    socket.emit("LEAVE_MEETING");
  }
};

export const sendMessage = ({ meetingId, content }) => {
  if (socket) {
    socket.emit("CHAT_MESSAGE", { meetingId, content });
  }
};

export const sendMediaState = (media) => {
  if (socket) {
    socket.emit("media:state", media);
  }
};
