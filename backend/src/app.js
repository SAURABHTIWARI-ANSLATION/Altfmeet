// src/app.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./route.js";

dotenv.config();

const app = express();

// Allow common development ports
app.use(cors({
  origin: [
    "http://localhost:5173", 
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:5500"
  ],
  credentials: true
}));

app.use(express.json());

// All API routes
app.use("/api", routes);

export default app;
