import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const requiredConfigKeys = ["apiKey", "authDomain", "projectId", "appId"];
const hasFirebaseConfig = requiredConfigKeys.every((key) => Boolean(firebaseConfig[key]));

if (!hasFirebaseConfig) {
  console.warn("Firebase client config is incomplete. Firebase features are disabled.");
}

const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
const analytics = app && typeof window !== 'undefined' && firebaseConfig.measurementId
  ? getAnalytics(app)
  : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

export { app, analytics, auth, db, hasFirebaseConfig };
