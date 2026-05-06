// src/meetings/meeting.service.js
import { createMeetingRecord, addParticipant, getMeetingById } from "./meeting.model.js";

export async function createMeeting(hostId, title) {
  const meeting = await createMeetingRecord(hostId, title); // no custom ID
  return {
    meetingId: meeting.id, // use auto-generated integer ID
    title: meeting.title,
  };
}
export async function joinMeeting(meetingId, userId) {
  const result = await addParticipant(meetingId, userId);
  return result;
}

export async function getMeetingDetails(meetingId) {
  const meeting = await getMeetingById(meetingId);
  return meeting;
}
