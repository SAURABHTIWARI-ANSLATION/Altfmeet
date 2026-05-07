// src/routes.js
import express from "express";
import { requireAuth } from "./auth/auth.middleware.js";
import meetingRoutes from "./meetings/meeting.route.js";
import turnRoutes from "./config/turn.routes.js";

const router = express.Router();

router.use(requireAuth);
router.use("/meetings", meetingRoutes);
router.use("/", turnRoutes);

export default router;
