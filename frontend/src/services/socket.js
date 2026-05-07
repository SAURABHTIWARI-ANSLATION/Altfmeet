import { io } from "socket.io-client";
import { BACKEND_URL } from "./config";
import { getAuthToken } from "./authToken";

let socket;

export const initiateSocketConnection = async () => {
  if (socket?.connected) return socket;
  const token = await getAuthToken();

  socket = io(BACKEND_URL, {
    auth: { token },
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
