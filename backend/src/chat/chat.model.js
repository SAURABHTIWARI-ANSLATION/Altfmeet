// src/chat/chat.model.js
import { db as firebaseDb } from "../config/firebase.js";
import { collection, addDoc, query, where, getDocs, orderBy, limit, serverTimestamp } from "firebase/firestore";

export async function saveMessage(meetingId, userId, message, time) {
  try {
    const docRef = await addDoc(collection(firebaseDb, "messages"), {
      meetingId,
      userId,
      message,
      timestamp: serverTimestamp() || time,
    });
    return { id: docRef.id, meetingId, userId, message };
  } catch (err) {
    console.error("Firestore message save error:", err);
    return null;
  }
}

export async function fetchMessages(meetingId, messageLimit = 50) {
  try {
    const q = query(
      collection(firebaseDb, "messages"),
      where("meetingId", "==", meetingId),
      orderBy("timestamp", "asc"),
      limit(messageLimit)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error("Firestore fetch error:", err);
    return [];
  }
}
