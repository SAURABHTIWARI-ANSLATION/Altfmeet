import { signInAnonymously } from "firebase/auth";
import { auth } from "./firebase";

let signInPromise = null;

export async function getAuthToken() {
  if (!auth) {
    throw new Error("Firebase authentication is not configured");
  }

  if (!auth.currentUser) {
    signInPromise ||= signInAnonymously(auth).finally(() => {
      signInPromise = null;
    });
    await signInPromise;
  }

  return auth.currentUser.getIdToken();
}
