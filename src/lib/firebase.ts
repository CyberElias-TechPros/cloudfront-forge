import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"],
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"],
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"],
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"],
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"],
  appId: import.meta.env["VITE_FIREBASE_APP_ID"],
  measurementId: import.meta.env["VITE_FIREBASE_MEASUREMENT_ID"],
};

const REQUIRED_FIREBASE_ENV_VARS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let configError: string | null = null;

function initFirebase(): void {
  if (app) return;
  // Never initialize Firebase during SSR (Node). Auth is browser-only.
  if (typeof window === "undefined") return;
  const missing = REQUIRED_FIREBASE_ENV_VARS.filter((key) => !import.meta.env[key]);
  if (missing.length > 0) {
    configError = `Firebase is not configured. Missing env vars: ${missing.join(", ")}`;
    console.warn(configError);
    return;
  }
  try {
    app = initializeApp(firebaseConfig);
    authInstance = getAuth(app);
  } catch (error) {
    configError =
      "Firebase initialization failed: " + (error instanceof Error ? error.message : String(error));
    console.error(configError);
  }
}

initFirebase();

export const auth: Auth | null = authInstance;
export const googleProvider: GoogleAuthProvider | null = authInstance
  ? new GoogleAuthProvider()
  : null;

function assertAuthConfigured(): Auth {
  if (!authInstance || !googleProvider) {
    throw new Error(configError ?? "Firebase auth is not available");
  }
  return authInstance;
}

export const signInWithGoogle = async () => {
  const firebaseAuth = assertAuthConfigured();
  if (!googleProvider) {
    throw new Error("Google sign-in is not available: Firebase is not configured");
  }
  const provider = googleProvider;
  try {
    return await signInWithPopup(firebaseAuth, provider);
  } catch (error) {
    console.error("Sign in error:", error);
    throw error;
  }
};

export const signOutUser = async () => {
  const firebaseAuth = assertAuthConfigured();
  try {
    await signOut(firebaseAuth);
  } catch (error) {
    console.error("Sign out error:", error);
    throw error;
  }
};

import type { User } from "firebase/auth";
import { getDevSession, mintDevToken, devEnabled } from "./dev-auth";

export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve, reject) => {
    if (!authInstance) {
      resolve(null);
      return;
    }
    const unsubscribe = onAuthStateChanged(
      authInstance,
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
    const user = authInstance?.currentUser;
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