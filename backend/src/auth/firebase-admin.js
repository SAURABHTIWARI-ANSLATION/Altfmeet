import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

function parseServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
    return JSON.parse(json);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  return null;
}

const serviceAccount = parseServiceAccount();

if (!admin.apps.length) {
  admin.initializeApp(
    serviceAccount
      ? {
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || serviceAccount.projectId || process.env.FIREBASE_PROJECT_ID,
        }
      : {
          projectId: process.env.FIREBASE_PROJECT_ID,
        }
  );
}

export const firebaseAdmin = admin;
export const adminDb = admin.firestore();
