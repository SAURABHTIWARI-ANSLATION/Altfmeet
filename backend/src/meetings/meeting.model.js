// src/meetings/meeting.model.js
import { adminDb, firebaseAdmin } from "../auth/firebase-admin.js";

export async function createMeetingRecord(hostId, title) {
  try {
    const docRef = await adminDb.collection("meetings").add({
      hostId,
      title,
      createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    });
    
    return { id: docRef.id, hostId, title };
  } catch (err) {
    console.error("Firestore creation error:", err);
    throw err;
  }
}

export async function addParticipant(meetingId, userId) {
  try {
    await adminDb.collection("participants").add({
      meetingId,
      userId,
      joinedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, meetingId, userId };
  } catch (err) {
    console.error("Firestore participant error:", err);
    throw err;
  }
}

export async function getMeetingById(meetingId) {
  try {
    const docSnap = await adminDb.collection("meetings").doc(meetingId).get();
    
    if (docSnap.exists) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (err) {
    console.error("Firestore retrieval error:", err);
    return null;
  }
}
