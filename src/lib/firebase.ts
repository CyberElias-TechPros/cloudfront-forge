import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] || "AIzaSyAqcPLTHaIujDMj_lXUxM9bang2AGW6AVA",
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] || "creator-loop-ring.firebaseapp.com",
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] || "creator-loop-ring",
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] || "creator-loop-ring.firebasestorage.app",
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] || "365634472671",
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] || "1:365634472671:web:cfbd912ccc8563edf7b76a",
  measurementId: import.meta.env["VITE_FIREBASE_MEASUREMENT_ID"] || "G-DB32W6M1R8",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error) {
    console.error("Sign in error:", error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign out error:", error);
    throw error;
  }
};

import type { User } from "firebase/auth";
import { getDevSession, mintDevToken, devEnabled } from "./dev-auth";

export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      reject,
    );
  });
};

export const getIdToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch {
    // fall through to dev token
  }
  if (devEnabled() && typeof window !== "undefined") {
    const session = getDevSession();
    if (session) return mintDevToken(session);
  }
  return null;
};
