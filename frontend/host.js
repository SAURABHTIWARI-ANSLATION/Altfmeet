// host.js
export function setupHostControls(socket, meetingId) {
  const muteAllBtn = document.getElementById("muteAllBtn");
  const lockRoomBtn = document.getElementById("lockRoomBtn");

  muteAllBtn.onclick = () => {
    socket.emit("HOST_MUTE_ALL", { meetingId });
  };

  lockRoomBtn.onclick = () => {
    socket.emit("HOST_LOCK_ROOM", { meetingId });
  };

  
  socket.on("ROOM_LOCKED", () => {
    alert("Room has been locked. No new participants can join.");
  });

  socket.on("ALL_MUTED", () => {
    alert("All participants have been muted.");
  });
}
