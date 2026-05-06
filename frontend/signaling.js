// signaling.js
export function initSignaling(socket, meetingId, userId) {
  socket.emit("JOIN_MEETING", { meetingId, userId });

  socket.on("USER_JOINED", ({ userId: remoteUserId, socketId }) => {
    console.log(`User ${remoteUserId} joined with socket ${socketId}`);
  
  });

  socket.on("OFFER", ({ sdp, from }) => {
    console.log("Received offer from", from);
    
  });

  socket.on("ANSWER", ({ sdp, from }) => {
    console.log("Received answer from", from);
    
  });

  socket.on("ICE_CANDIDATE", ({ candidate, from }) => {
    console.log("Received ICE candidate from", from);
    
  });

  // 🔽 Place this with other socket event listeners
  socket.on("SCREEN_SHARE_STARTED", async ({ producerId }) => {
    console.log("Received SCREEN_SHARE_STARTED:", producerId);
    const screenConsumer = await recvTransport.consume({
      id: producerId,
      producerId,
      kind: "video",
      rtpCapabilities: device.rtpCapabilities,
    });

    const screenStream = new MediaStream([screenConsumer.track]);

    const video = document.createElement("video");
    video.id = "sharedScreen";
    video.srcObject = screenStream;
    video.autoplay = true;
    video.playsInline = true;
    video.style.width = "100%";
    document.getElementById("videos").appendChild(video);
  });

  socket.on("SCREEN_SHARE_STOPPED", () => {
    const screenVideo = document.getElementById("sharedScreen");
    if (screenVideo) screenVideo.remove();
  });
}
