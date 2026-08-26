const requiredFrontendEnvVars = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

/**
 * Validates that required frontend env vars are present.
 *
 * Never throws: crashing SSR would take down the whole app (including public
 * pages) for what is a client-only concern. When Firebase is not configured:
 * - in dev, the built-in dev-auth session takes over so the app runs against
 *   the local worker without a Firebase project;
 * - in production, Google sign-in is unavailable and a warning is logged.
 */
export function validateFrontendEnv(): void {
  const missing = requiredFrontendEnvVars.filter((key) => !import.meta.env[key]);
  if (missing.length === 0) return;

  if (import.meta.env.DEV) {
    console.warn(
      `Missing Firebase env vars (${missing.join(", ")}). ` +
        "Dev auth is active — the app runs against the API without Google sign-in. " +
        "Set the VITE_FIREBASE_* vars to test real sign-in.",
    );
    return;
  }
  console.warn(
    `Missing environment variables (Google sign-in will be unavailable): ${missing.join(", ")}`,
  );
}
