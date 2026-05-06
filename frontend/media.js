// media.js
let localStream;
let peerConnections = {};
let mediaRecorder;
let recordedChunks = [];

export async function initMedia(socket, meetingId, userId) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    document.getElementById("localVideo").srcObject = localStream;

    socket.on("USER_JOINED", ({ socketId }) => {
      const pc = createPeerConnection(socket, socketId);
      localStream
        .getTracks()
        .forEach((track) => pc.addTrack(track, localStream));
      peerConnections[socketId] = pc;

      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer);
        socket.emit("OFFER", { target: socketId, sdp: offer, from: socket.id });
      });
    });

    socket.on("OFFER", async ({ sdp, from }) => {
      const pc = createPeerConnection(socket, from);
      peerConnections[from] = pc;

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      localStream
        .getTracks()
        .forEach((track) => pc.addTrack(track, localStream));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("ANSWER", { target: from, sdp: answer, from: socket.id });
    });

    socket.on("ANSWER", async ({ sdp, from }) => {
      const pc = peerConnections[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    socket.on("ICE_CANDIDATE", ({ candidate, from }) => {
      const pc = peerConnections[from];
      if (pc && candidate) pc.addIceCandidate(new RTCIceCandidate(candidate));
    });
  } catch (err) {
    console.error("Media init failed:", err);
  }
}

async function createPeerConnection(socket, remoteSocketId) {
  const res = await fetch("/ice-servers");
  const { iceServers } = await res.json();
  const pc = new RTCPeerConnection({ iceServers });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ICE_CANDIDATE", {
        target: remoteSocketId,
        candidate: event.candidate,
        from: socket.id,
      });
    }
  };

  pc.ontrack = (event) => {
    const remoteVideo = document.createElement("video");
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;
    remoteVideo.muted = false;
    remoteVideo.controls = false;
    remoteVideo.style.width = "300px";
    remoteVideo.style.margin = "10px";

    document.getElementById("remoteVideos").appendChild(remoteVideo);
  };
  return pc;
}
export async function startScreenShare(sendTransport, socket, roomId) {
  try {
    if (!sendTransport) {
      console.error("sendTransport is undefined. Cannot start screen share.");
      return;
    }

    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    });
    const screenTrack = screenStream.getVideoTracks()[0];

    const screenProducer = await sendTransport.produce({
      track: screenTrack,
      appData: { type: "screen" },
    });

    socket.emit("START_SCREEN_SHARE", {
      roomId,
      producerId: screenProducer.id,
    });

    screenTrack.onended = () => {
      screenProducer.close(); 
    };
  } catch (err) {
    console.error("Screen share failed:", err);
  }
}

export function startRecording() {
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(localStream);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recording.webm";
    a.click();
  };

  mediaRecorder.start();
  setTimeout(() => mediaRecorder.stop(), 10000); // Record for 10s
}


// media.js
// import io from "socket.io-client";
// import * as mediasoupClient from "mediasoup-client";

// let device;
// let sendTransport;
// let recvTransport;
// let localStream;
// let producers = new Map();
// let consumers = new Map();

// // ✅ Initialize mediasoup device + transports
// export async function initMediasoup(socket, meetingId) {
//   try {
//     // Step 1: Get router RTP Capabilities from server
//     const rtpCapabilities = await new Promise((resolve) => {
//       socket.emit("getRouterRtpCapabilities", { meetingId }, resolve);
//     });

//     device = new mediasoupClient.Device();
//     await device.load({ routerRtpCapabilities: rtpCapabilities });

//     // Step 2: Create Send Transport
//     const sendParams = await new Promise((resolve) => {
//       socket.emit("createWebRtcTransport", { meetingId, direction: "send" }, resolve);
//     });

//     sendTransport = device.createSendTransport(sendParams);

//     sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
//       socket.emit("connectTransport", {
//         transportId: sendTransport.id,
//         dtlsParameters,
//       }, callback);
//     });

//     sendTransport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
//       socket.emit("produce", {
//         transportId: sendTransport.id,
//         kind,
//         rtpParameters,
//         appData,
//         meetingId,
//       }, ({ id }) => {
//         callback({ id });
//       });
//     });

//     // Step 3: Create Recv Transport
//     const recvParams = await new Promise((resolve) => {
//       socket.emit("createWebRtcTransport", { meetingId, direction: "recv" }, resolve);
//     });

//     recvTransport = device.createRecvTransport(recvParams);

//     recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
//       socket.emit("connectTransport", {
//         transportId: recvTransport.id,
//         dtlsParameters,
//       }, callback);
//     });

//     console.log("✅ Mediasoup device + transports ready");

//   } catch (err) {
//     console.error("Mediasoup init failed:", err);
//   }
// }

// // ✅ Start camera/mic
// export async function startCamera(socket, meetingId) {
//   try {
//     localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//     document.getElementById("localVideo").srcObject = localStream;

//     for (const track of localStream.getTracks()) {
//       const producer = await sendTransport.produce({
//         track,
//         appData: { type: track.kind },
//       });
//       producers.set(track.kind, producer);
//     }

//     console.log("🎥 Camera + mic started");
//   } catch (err) {
//     console.error("Camera start failed:", err);
//   }
// }

// // ✅ Screen Share
// export async function startScreenShare(socket, meetingId) {
//   try {
//     if (!sendTransport) {
//       console.error("sendTransport not ready");
//       return;
//     }

//     const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
//     const screenTrack = screenStream.getVideoTracks()[0];

//     const screenProducer = await sendTransport.produce({
//       track: screenTrack,
//       appData: { type: "screen" },
//     });

//     producers.set("screen", screenProducer);

//     const video = document.createElement("video");
//     video.srcObject = screenStream;
//     video.autoplay = true;
//     video.playsInline = true;
//     video.style.width = "300px";
//     video.style.border = "2px solid red";
//     document.getElementById("remoteVideos").appendChild(video);

//     screenTrack.onended = () => {
//       screenProducer.close();
//       producers.delete("screen");
//       video.remove();
//       console.log("🛑 Screen sharing stopped");
//     };

//     console.log("🖥️ Screen sharing started");
//   } catch (err) {
//     console.error("Screen share failed:", err);
//   }
// }

// // ✅ Consume remote producer
// export async function consumeRemoteProducer(socket, meetingId, producerId) {
//   try {
//     const consumerParams = await new Promise((resolve) => {
//       socket.emit("consume", {
//         meetingId,
//         producerId,
//         rtpCapabilities: device.rtpCapabilities,
//         transportId: recvTransport.id,
//       }, resolve);
//     });

//     const consumer = await recvTransport.consume({
//       id: consumerParams.id,
//       producerId: consumerParams.producerId,
//       kind: consumerParams.kind,
//       rtpParameters: consumerParams.rtpParameters,
//     });

//     consumers.set(consumer.id, consumer);

//     const stream = new MediaStream();
//     stream.addTrack(consumer.track);

//     const video = document.createElement("video");
//     video.srcObject = stream;
//     video.autoplay = true;
//     video.playsInline = true;
//     video.style.width = "300px";
//     document.getElementById("remoteVideos").appendChild(video);

//     console.log("👀 Consuming remote producer:", producerId);

//   } catch (err) {
//     console.error("Consume failed:", err);
//   }
// }
