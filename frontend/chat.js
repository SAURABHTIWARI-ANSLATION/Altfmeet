// chat.js
export function initChat(socket, meetingId, userId) {
  const msgInput = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");
  const messagesDiv = document.getElementById("messages");

  // Join chat room
  socket.emit("JOIN_CHAT", { meetingId, userId });

  // Receive chat history
  socket.on("CHAT_HISTORY", (history) => {
    history.forEach(({ userId, message, time }) => {
      appendMessage(userId, message, time);
    });
  });

  // Receive new messages
  socket.on("CHAT_MESSAGE", ({ userId, message, time }) => {
    appendMessage(userId, message, time);
  });

  // Send message
  sendBtn.onclick = () => {
    const message = msgInput.value.trim();
    if (message) {
      socket.emit("CHAT_MESSAGE", { meetingId, userId, message });
      msgInput.value = "";
    }
  };

  function appendMessage(sender, text, time) {
    const msg = document.createElement("div");
    msg.textContent = `[${new Date(time).toLocaleTimeString()}] ${sender}: ${text}`;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}
