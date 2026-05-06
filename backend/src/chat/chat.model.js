// src/chat/chat.model.js
import db from "../config/db.js";

export async function saveMessage(meetingId, userId, message, time) {
  const result = await db.query(
    `INSERT INTO chat_messages (meeting_id, user_id, message, created_at)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [meetingId, userId, message, time]
  );
  return result.rows[0];
}



export async function fetchMessages(meetingId, limit = 50) {
  const result = await db.query(
    "SELECT * FROM chat_messages WHERE meeting_id = $1 ORDER BY created_at ASC LIMIT $2",
    [meetingId, limit]
  );
  return result.rows;
}
