import admin from 'firebase-admin';

/**
 * Initializes and returns the Firebase Admin SDK singleton.
 */
export function getFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    // Replace escaped newlines if present
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  // If credentials are provided, initialize with cert
  if (projectId && clientEmail && privateKey) {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  // Default app initialization (works with GOOGLE_APPLICATION_CREDENTIALS or Firebase Emulator)
  return admin.initializeApp();
}

export default admin;
