import { auth, signInWithGoogle } from "@/lib/firebase";
import { api } from "@/lib/api";
import { onAuthStateChanged, User } from "firebase/auth";

export interface AuthError {
  code: string;
  message: string;
  details?: string;
}

export interface SignInResult {
  success: boolean;
  user?: User;
  error?: AuthError;
}

/**
 * Diagnose authentication and configuration issues
 */
export function diagnoseAuth(): {
  firebaseConfigured: boolean;
  firebaseErrors: string[];
  authAvailable: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const firebaseErrors: string[] = [];

  // Check Firebase configuration
  const requiredEnvVars = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
  ];

  const missing = requiredEnvVars.filter((key) => {
    const value = import.meta.env[key];
    return !value || value.includes("placeholder") || value.includes("your-");
  });

  const firebaseConfigured = missing.length === 0;

  if (!firebaseConfigured) {
    firebaseErrors.push(
      `Missing or placeholder Firebase config: ${missing.join(", ")}. See .env.example and docs/DEPLOYMENT.md`,
    );
    issues.push("Firebase is not properly configured");
  }

  // Check if auth is available
  const authAvailable = auth !== null;
  if (!authAvailable) {
    issues.push("Firebase Auth is not initialized");
  }

  return {
    firebaseConfigured,
    firebaseErrors,
    authAvailable,
    issues,
  };
}

/**
 * Attempt Google sign-in with detailed error handling
 */
export async function attemptGoogleSignIn(): Promise<SignInResult> {
  const diagnosis = diagnoseAuth();

  if (diagnosis.issues.length > 0) {
    console.error("Auth diagnosis issues:", diagnosis);
    return {
      success: false,
      error: {
        code: "AUTH_CONFIG_ERROR",
        message: "Authentication is not properly configured",
        details: diagnosis.issues.join("; "),
      },
    };
  }

  try {
    console.debug("Attempting Google sign-in...");
    const result = await signInWithGoogle();
    console.debug("Google sign-in successful", { uid: result.user.uid });
    return { success: true, user: result.user };
  } catch (error) {
    const err = error as Error & { code?: string };
    console.error("Google sign-in failed:", err);

    let userMessage = "Sign-in failed. Please try again.";
    let details = err.message;

    if (err.code === "auth/popup-closed-by-user") {
      userMessage = "Sign-in was cancelled";
      details = "User closed the sign-in popup";
    } else if (err.code === "auth/operation-not-allowed") {
      userMessage = "Google sign-in is not available";
      details = "Google Sign-In is not enabled in Firebase Console";
    } else if (err.code === "auth/unauthorized-domain") {
      userMessage = "This domain is not authorized";
      details = `Current domain is not in Firebase's authorized domains list`;
    } else if (err.message?.includes("API key")) {
      userMessage = "Firebase API key is invalid";
      details = "Check FIREBASE_SETUP.md for configuration instructions";
    }

    return {
      success: false,
      error: {
        code: err.code || "UNKNOWN_ERROR",
        message: userMessage,
        details,
      },
    };
  }
}

/**
 * Register user with backend after Firebase authentication
 */
export async function registerWithBackend(user: User): Promise<void> {
  try {
    console.debug("Registering user with backend...", { uid: user.uid, email: user.email });
    await api.post("/api/v1/auth/register", {
      firebaseUid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoURL,
    });
    console.debug("Backend registration successful");
  } catch (error) {
    const err = error as Error;
    console.error("Backend registration failed:", err.message);
    throw new Error(`Failed to register with backend: ${err.message}`);
  }
}

/**
 * Watch authentication state and handle sign-in flow
 */
export function watchAuthState(
  onSignedIn: (user: User) => void,
  onError: (error: Error) => void,
): () => void {
  if (!auth) {
    const err = new Error("Firebase Auth is not initialized");
    onError(err);
    return () => {};
  }

  const unsubscribe = onAuthStateChanged(
    auth,
    async (user) => {
      if (user) {
        try {
          console.debug("User authenticated, registering with backend...");
          await registerWithBackend(user);
          onSignedIn(user);
        } catch (error) {
          console.error("Failed to complete authentication flow:", error);
          onError(error as Error);
        }
      }
    },
    (error) => {
      console.error("Auth state change error:", error);
      onError(error as Error);
    },
  );

  return unsubscribe;
}

/**
 * Get detailed authentication status
 */
export async function getAuthStatus(): Promise<{
  isAuthenticated: boolean;
  user?: User | null;
  hasToken: boolean;
  canCallAPI: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  const user = auth?.currentUser || null;
  let hasToken = false;
  let canCallAPI = false;

  if (user) {
    try {
      const token = await user.getIdToken();
      hasToken = !!token;
      canCallAPI = hasToken;
    } catch (error) {
      issues.push("Failed to get authentication token");
    }
  } else {
    issues.push("User is not signed in");
  }

  const diagnosis = diagnoseAuth();
  if (diagnosis.issues.length > 0) {
    issues.push(...diagnosis.issues);
    canCallAPI = false;
  }

  return {
    isAuthenticated: !!user,
    user,
    hasToken,
    canCallAPI,
    issues,
  };
}
