// src/config/redis.js
import redis from "redis"
import dotenv from "dotenv"
dotenv.config();

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
  },
});

client.on("connect", () => {
  console.log("Connected to Redis");
});

client.on("error", (err) => {
  console.error("Redis error:", err);
});

// (async () => {
//   try {
//     await client.connect();
//     // Test Redis connection
//     await client.set("ping", "pong");
//     const value = await client.get("ping");
//     console.log("Redis test value:", value); // should print "pong"
//   } catch (err) {
//     console.error("Redis connect failed:", err);
//   }
// })();

export default client;
