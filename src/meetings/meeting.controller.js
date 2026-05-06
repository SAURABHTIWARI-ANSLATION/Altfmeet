// src/meetings/meeting.controller.js
import * as MeetingService from "./meeting.service.js";
import { initRoomMedia } from "../media/sfu.service.js";


export async function createMeeting(req, res, next) {
  try {
    const hostId = req.body.hostId || `user_${Date.now()}`;
    const title = req.body.title || "Untitled Meeting";

    const meeting = await MeetingService.createMeeting(hostId, title);
    res.json({
      meetingLink: `http://localhost:5500/frontend/?room=${meeting.meetingId}`,
      meetingId: meeting.meetingId,
      title: meeting.title,
    });
  } catch (err) {
    next(err);
  }
}

export async function joinMeeting(req, res, next) {
  try {
    const { meetingId } = req.params;
    const { userId } = req.body;
    initRoomMedia(meetingId);
    const result = await MeetingService.joinMeeting(meetingId, userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getMeetingDetails(req, res, next) {
  try {
    const { meetingId } = req.params;
    const meeting = await MeetingService.getMeetingDetails(meetingId);
    res.json({ success: true, data: meeting });
  } catch (err) {
    next(err);
  }
}

