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

export default app;
