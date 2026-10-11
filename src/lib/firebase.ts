import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

// User's exact Firebase configuration for Splity
export const firebaseConfig = {
  apiKey: "AIzaSyAzhgYeXYMFZ-YfMN0TcX4CII3CJb6NlP4",
  authDomain: "splity-expense-tracker.firebaseapp.com",
  projectId: "splity-expense-tracker",
  storageBucket: "splity-expense-tracker.firebasestorage.app",
  messagingSenderId: "77088684946",
  appId: "1:77088684946:web:b2e1e97f10b730f07f1f4b",
  measurementId: "G-6V302TY07H"
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
