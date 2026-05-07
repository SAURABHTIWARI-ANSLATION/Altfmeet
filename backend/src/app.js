// src/app.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { corsOptions } from "./config/cors.js";
import routes from "./route.js";

dotenv.config();

const app = express();

app.use(cors(corsOptions));

app.use(express.json());

// All API routes
app.use("/api", routes);

app.use((err, req, res, _next) => {
  console.error("API error:", err);
  const status = Number.isInteger(err?.status) ? err.status : 500;
  res.status(status).json({
    success: false,
    error: status === 500 ? "Internal server error" : err.message,
    details: process.env.NODE_ENV === "production" ? undefined : err?.message,
  });
});

export default app;
