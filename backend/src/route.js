// src/routes.js
import express from "express";
import meetingRoutes from "./meetings/meeting.route.js";
import turnRoutes from "./config/turn.routes.js";

const router = express.Router();

router.use("/meetings", meetingRoutes);
router.use("/", turnRoutes);

export default router;
