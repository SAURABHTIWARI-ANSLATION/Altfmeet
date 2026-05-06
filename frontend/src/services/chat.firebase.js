import { db } from "./firebase";
import { collection, addDoc, query, where, onSnapshot, serverTimestamp } from "firebase/firestore";

export const chatService = {
  sendMessage: async (meetingId, userId, message) => {
    try {
      await addDoc(collection(db, "messages"), {
        meetingId,
        userId,
        message,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  },

  subscribeToMessages: (meetingId, callback) => {
    // Removed orderBy to avoid mandatory Composite Index requirement
    const q = query(
      collection(db, "messages"),
      where("meetingId", "==", meetingId)
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Sort in memory to avoid index issues
      const sortedMessages = messages.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeA - timeB;
      });
      
      callback(sortedMessages);
    });
  },
};
