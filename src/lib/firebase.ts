import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  inMemoryPersistence,
  indexedDBLocalPersistence,
  setPersistence,
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
let authReadyPromise: Promise<void> | null = null;
let authReadyResolve: (() => void) | null = null;

function validateFirebaseConfig(): string | null {
  const missing = REQUIRED_FIREBASE_ENV_VARS.filter((key) => {
    const value = import.meta.env[key];
    return !value || value.includes("placeholder") || value.includes("your-");
  });

  if (missing.length > 0) {
    return `Firebase is not properly configured. Missing or placeholder env vars: ${missing.join(", ")}. See .env.example and docs/DEPLOYMENT.md for configuration instructions.`;
  }
  return null;
}

async function initFirebase(): Promise<void> {
  if (app) return;
  // Never initialize Firebase during SSR (Node). Auth is browser-only.
  if (typeof window === "undefined") return;

  const validationError = validateFirebaseConfig();
  if (validationError) {
    configError = validationError;
    console.warn(configError);
    return;
  }

  try {
    app = initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    // Full persistence fallback chain: IndexedDB → LocalStorage → In-Memory
    if (authInstance) {
      await setPersistence(authInstance, indexedDBLocalPersistence).catch(() => {
        console.warn("[Firebase] IndexedDB persistence failed, falling back to localStorage");
        return setPersistence(authInstance!, browserLocalPersistence).catch(() => {
          console.warn("[Firebase] localStorage persistence failed, falling back to inMemory");
          return setPersistence(authInstance!, inMemoryPersistence);
        });
      });
    }
    console.debug("Firebase initialized successfully");

    // Set up auth ready promise - resolves when auth state is settled (user loaded or timeout)
    authReadyPromise = new Promise<void>((resolve) => {
      authReadyResolve = resolve;
      if (authInstance) {
        let resolved = false;
        const unsubscribe = onAuthStateChanged(authInstance, (user) => {
          if (!resolved && user !== null) {
            // User is actually loaded (non-null)
            resolved = true;
            unsubscribe();
            if (authReadyResolve) {
              authReadyResolve();
              authReadyResolve = null;
            }
          } else if (user === null && authReadyResolve) {
            // User is null (not logged in) - wait a bit more for potential sign-in
            // but don't wait forever - give it 3 seconds max
            setTimeout(() => {
              if (!resolved && authReadyResolve) {
                resolved = true;
                unsubscribe();
                authReadyResolve();
                authReadyResolve = null;
              }
            }, 3000);
          }
        });
      }
    });
  } catch (error) {
    configError =
      "Firebase initialization failed: " + (error instanceof Error ? error.message : String(error));
    console.error(configError, error);
  }
}

initFirebase().catch((err) => {
  console.error("[Firebase] Initialization failed:", err);
});

export const auth: Auth | null = authInstance;
export const googleProvider: GoogleAuthProvider | null = authInstance
  ? new GoogleAuthProvider()
  : null;

// Wait for auth state to be initially loaded (resolves once on first auth state change)
export const waitForAuthReady = (): Promise<void> => {
  if (authReadyPromise) return authReadyPromise;
  // If authInstance exists but no promise, create a fallback
  return Promise.resolve();
};

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Sign in error:", errorMessage);
    // Re-throw with more context for user-facing error handling
    if (errorMessage.includes("popup-closed-by-user")) {
      throw new Error("Sign-in cancelled");
    }
    if (errorMessage.includes("operation-not-allowed")) {
      throw new Error("Google sign-in is not enabled. Check Firebase Console configuration.");
    }
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
    // Wait for auth state to be initially loaded
    await waitForAuthReady();

    const user = authInstance?.currentUser;
    if (user) {
      // Force token refresh if token is stale (>5 min old)
      return await user.getIdToken(/* forceRefresh */ false);
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
