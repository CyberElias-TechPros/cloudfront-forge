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
 * - In dev: throws so misconfiguration is caught immediately.
 * - In production: logs a warning instead of crashing SSR for every page.
 */
export function validateFrontendEnv(): void {
  const missing = requiredFrontendEnvVars.filter((key) => !import.meta.env[key]);
  if (missing.length === 0) return;
  if (import.meta.env.DEV) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  console.warn(`Missing environment variables (auth features will be degraded): ${missing.join(", ")}`);
}