// src/routes.js
import express from "express";
import meetingRoutes from "./meetings/meeting.route.js";

const router = express.Router();

router.use("/meetings", meetingRoutes);

export default router;
