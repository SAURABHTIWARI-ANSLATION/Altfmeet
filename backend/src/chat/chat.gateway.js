export function setupChat(io) {
  io.on("connection", (socket) => {
    socket.on("JOIN_CHAT", ({ meetingId }) => {
      if (meetingId) socket.join(meetingId);
    });
  });
}
