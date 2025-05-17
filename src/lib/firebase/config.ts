
// src/lib/firebase/config.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Pre-initialization check for common placeholder API key patterns
if (firebaseConfig.apiKey && (firebaseConfig.apiKey.includes("YOUR_") || firebaseConfig.apiKey.includes("XXXX") || firebaseConfig.apiKey.length < 20)) {
  // Throw a more specific error if the API key looks like a placeholder or is unusually short.
  // The "auth/invalid-api-key" from Firebase means a key was provided, but was bad.
  // This custom error tries to catch obvious placeholder issues even before Firebase does.
  throw new Error(
    `Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) appears to be a placeholder or is invalid: "${firebaseConfig.apiKey}". ` +
    "Please ensure you have set the correct Firebase API key in your Netlify environment variables and re-deployed your site. " +
    "Verify the key in your Firebase project settings (Project settings > General > Web API key)."
  );
}

if (!firebaseConfig.apiKey) {
  // This case might be less likely if you're getting "auth/invalid-api-key",
  // which implies *some* key was passed to Firebase.
  // But it's a good safeguard.
  throw new Error(
    "Firebase API Key (NEXT_PUBLIC_FIREBASE_API_KEY) is missing. " +
    "Please set this environment variable in your Netlify site settings and re-deploy."
  );
}

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const googleAuthProvider = new GoogleAuthProvider();

export { app, auth, googleAuthProvider };
