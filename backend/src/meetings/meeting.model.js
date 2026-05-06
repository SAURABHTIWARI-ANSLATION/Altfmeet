// src/meetings/meeting.model.js
import { db as firebaseDb } from "../config/firebase.js";
import { collection, addDoc, getDoc, doc, serverTimestamp } from "firebase/firestore";

export async function createMeetingRecord(hostId, title) {
  try {
    // Primary Storage: Firestore
    const docRef = await addDoc(collection(firebaseDb, "meetings"), {
      hostId,
      title,
      createdAt: serverTimestamp(),
    });
    
    return { id: docRef.id, title };
  } catch (err) {
    console.error("Firestore creation error:", err);
    throw err;
  }
}

export async function addParticipant(meetingId, userId) {
  try {
    await addDoc(collection(firebaseDb, "participants"), {
      meetingId,
      userId,
      joinedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (err) {
    console.error("Firestore participant error:", err);
    throw err;
  }
}

export async function getMeetingById(meetingId) {
  try {
    const docRef = doc(firebaseDb, "meetings", meetingId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (err) {
    console.error("Firestore retrieval error:", err);
    return null;
  }
}
