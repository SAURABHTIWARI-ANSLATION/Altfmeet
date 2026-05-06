// turn.routes.js
import express from "express";
import turnConfig from "./turn.config.js";
const router = express.Router();

router.get("/ice-servers", (req, res) => {
  res.json(turnConfig);
});

export default router;
