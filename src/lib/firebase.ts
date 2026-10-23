import { initializeApp, getApps, getApp } from "@firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "@firebase/auth";

// User's exact Firebase configuration for Splity
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAzhgYeXYMFZ-YfMN0TcX4CII3CJb6NlP4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "splity-expense-tracker.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "splity-expense-tracker",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "splity-expense-tracker.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "77088684946",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:77088684946:web:b2e1e97f10b730f07f1f4b",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-6V302TY07H"
};

// Initialize Firebase app singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Initiates the authentic Google Sign-In popup with Firebase Auth.
 */
export async function loginWithGooglePopup() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}
