import { firebaseAdmin } from "./firebase-admin.js";

function extractBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return "";
  return token.trim();
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    req.auth = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      provider: decodedToken.firebase?.sign_in_provider || null,
    };
    return next();
  } catch (err) {
    console.warn("Auth verification failed:", err?.message || err);
    return res.status(401).json({ success: false, error: "Invalid or expired authentication token" });
  }
}

export async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    socket.data.auth = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      provider: decodedToken.firebase?.sign_in_provider || null,
    };
    return next();
  } catch (err) {
    console.warn("Socket auth failed:", err?.message || err);
    return next(new Error("Invalid or expired authentication token"));
  }
}
