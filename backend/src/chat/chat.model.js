// src/chat/chat.model.js
import { adminDb, firebaseAdmin } from "../auth/firebase-admin.js";

export async function saveMessage(meetingId, userId, message, time) {
  try {
    const docRef = await adminDb.collection("messages").add({
      meetingId,
      userId,
      message,
      time,
      timestamp: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: docRef.id, meetingId, userId, message };
  } catch (err) {
    console.error("Firestore message save error:", err);
    return null;
  }
}

export async function fetchMessages(meetingId, messageLimit = 50) {
  try {
    const querySnapshot = await adminDb
      .collection("messages")
      .where("meetingId", "==", meetingId)
      .orderBy("timestamp", "asc")
      .limit(messageLimit)
      .get();

    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error("Firestore fetch error:", err);
    return [];
  }
}
