import { initSignaling } from "./signaling.js";
import { initMedia, startScreenShare, startRecording } from "./media.js";
import { initChat } from "./chat.js";
import { setupHostControls } from "./host.js";
//import * as mediasoupClient from "mediasoup-client";

const SIGNALING_EVENTS = {
  JOIN_MEETING: "JOIN_MEETING",
  USER_JOINED: "USER_JOINED",
  OFFER: "OFFER",
  ANSWER: "ANSWER",
  ICE_CANDIDATE: "ICE_CANDIDATE",
  JOIN_CHAT: "JOIN_CHAT",
  CHAT_MESSAGE: "CHAT_MESSAGE",
  CHAT_HISTORY: "CHAT_HISTORY",
  LEAVE_CHAT: "LEAVE_CHAT",
};

const socket = io("http://localhost:5000");
console.log("Full URL:", window.location.href);
console.log("Search string:", window.location.search);
const urlParams = new URLSearchParams(window.location.search);
console.log("meetingId:", urlParams.get("meetingId"));
console.log("room:", urlParams.get("room"));
//const urlParams = new URLSearchParams(window.location.search);
const meetingId = urlParams.get("meetingId") || urlParams.get("room");
console.log("Parsed meetingId from URL:", meetingId);
const userId = `user_${Math.floor(Math.random() * 1000)}`;
console.log("Joining meeting:", meetingId);

// If meetingId exists in URL, auto-join and initialize modules
if (meetingId) {
  socket.on("connect", () => {
    socket.emit(SIGNALING_EVENTS.JOIN_MEETING, { meetingId, userId });
    socket.emit(SIGNALING_EVENTS.JOIN_CHAT, { meetingId, userId });

    initSignaling(socket, meetingId, userId);
    initMedia(socket, meetingId, userId);
    initChat(socket, meetingId, userId);
    setupHostControls(socket, meetingId);
  });

  socket.on("PARTICIPANT_LIST", renderParticipantList);
}

// Create Meeting
document
  .getElementById("createMeetingBtn")
  .addEventListener("click", async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/meetings/create-meeting",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostId: 1, title: "Team Sync" }),
        }
      );

      const data = await response.json();
      const link = `http://localhost:5500/frontend/?meetingId=${data.meetingId}`;

      document.getElementById("meetingLinkDisplay").innerHTML = `
      <p>Meeting Created!</p>
      <a href="${link}" target="_blank">${link}</a>
    `;
    } catch (err) {
      console.error("Error creating meeting:", err);
    }
  });

// Join Meeting via pasted link
document.getElementById("joinMeetingBtn").addEventListener("click", () => {
  const link = document.getElementById("meetingLinkInput").value;
  try {
    const url = new URL(link);
    const meetingId = new URLSearchParams(url.search).get("room");
    window.location.href = `/?room=${meetingId}`;
    if (meetingId) {
      window.location.href = `/?room=${meetingId}`;
    } else {
      alert("Invalid meeting link");
    }
  } catch (err) {
    alert("Please enter a valid URL");
  }
});

//  Render participant list
function renderParticipantList(list) {
  const ul = document.getElementById("participants");
  ul.innerHTML = "";
  list.forEach((user) => {
    const li = document.createElement("li");
    li.textContent = user;
    ul.appendChild(li);
  });
}

document.getElementById("screenShareBtn").onclick = () =>
  startScreenShare(sendTransport, socket, meetingId);

document.getElementById("recordBtn").onclick = () => {
  startRecording();
  document.getElementById("recordBtn").disabled = true;
  setTimeout(() => {
    document.getElementById("recordBtn").disabled = false;
  }, 10000);
};

// Chat toggle
document.getElementById("chatToggleBtn").addEventListener("click", () => {
  document.getElementById("chatBox").classList.toggle("hidden");
});

// Mic toggle
let micEnabled = true;
document.getElementById("micToggleBtn").onclick = () => {
  const stream = localVideo.srcObject;
  stream.getAudioTracks().forEach((track) => (track.enabled = micEnabled));
  micEnabled = !micEnabled;
};

// Video toggle
let videoEnabled = true;
document.getElementById("videoToggleBtn").onclick = () => {
  const stream = localVideo.srcObject;
  stream.getVideoTracks().forEach((track) => (track.enabled = videoEnabled));
  videoEnabled = !videoEnabled;
};
