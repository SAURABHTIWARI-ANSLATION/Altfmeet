// src/meetings/meeting.model.js
import db from "../config/db.js"; // Your PostgreSQL client

export async function createMeetingRecord(hostId, title) {
  const result = await db.query(
    "INSERT INTO meetings (host_id, title) VALUES ($1, $2) RETURNING id, title",
    [hostId, title]
  );
  return result.rows[0]; // returns inserted meeting info
}

export async function addParticipant(meetingId, userId) {
  const result = await db.query(
    "INSERT INTO meeting_participants (meeting_id, user_id, joined_at) VALUES ($1, $2, NOW()) RETURNING *",
    [meetingId, userId]
  );
  return result.rows[0];
}

export async function getMeetingById(meetingId) {
  const result = await db.query(
    "SELECT * FROM meetings WHERE id = $1",
    [meetingId]
  );
  return result.rows[0];
}

