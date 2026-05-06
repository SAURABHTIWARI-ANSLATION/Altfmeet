// src/chat/chat.service.js
import { saveMessage, fetchMessages } from "./chat.model.js";

export async function sendMessage({ meetingId, userId, message, time }) {
  if (!meetingId || !userId || !message) {
    throw new Error("Missing required fields");
  }
  return await saveMessage(meetingId, userId, message, time);
}

export async function getMessages(meetingId, limit = 50) {
  return await fetchMessages(meetingId, limit);
}
