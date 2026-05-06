// src/app.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./route.js";
import "./config/redis.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(cors({
  origin: "http://127.0.0.1:5500", 
  credentials: true
}));

app.use(express.json())
// All API routes
app.use("/api", routes);
export default app;
