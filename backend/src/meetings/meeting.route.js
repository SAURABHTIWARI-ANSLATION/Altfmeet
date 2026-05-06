// src/meetings/meeting.route.js
import express from "express";
import {
  createMeeting,
  joinMeeting,
  getMeetingDetails
} from "./meeting.controller.js";

const router = express.Router();
// Create a new meeting
router.post("/create-meeting", createMeeting);
// Join an existing meeting
router.post("/:meetingId/join", joinMeeting);
// Get meeting details
router.get("/:meetingId", getMeetingDetails);

export default router;
