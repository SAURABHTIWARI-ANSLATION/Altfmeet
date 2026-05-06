// turn.config.js
import dotenv from "dotenv";
dotenv.config();

const iceServers = [];

if (process.env.STUN_URL) {
  iceServers.push({ urls: process.env.STUN_URL });
} else {
  iceServers.push({ urls: "stun:stun.l.google.com:19302" });
}


if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_PASSWORD) {
  iceServers.push({
    urls: process.env.TURN_URL,
    username: process.env.TURN_USERNAME,
    credential: process.env.TURN_PASSWORD
  });
}

export default { iceServers };
