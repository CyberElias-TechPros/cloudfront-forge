import type { Env } from "../types";
import { Database } from "../lib/database";
import { verifyFirebaseToken } from "../services/firebase";
import { createLogger } from "../lib/logger";
import { maybeSendWelcomeEmail } from "../lib/notify";

/**
 * Authentication failure, thrown by `requireAuth` and friends.
 *
 * Handlers used to compare `error.message` against two *different* spellings
 * ("AUTH_required" and "AUTH_REQUIRED"); the uppercase checks never matched, so
 * an anonymous or expired-token request answered `500 INTERNAL_ERROR` on those
 * routes. Matching on a class (with the legacy message strings kept for
 * compatibility) removes the whole class of bug.
 */
export class AuthError extends Error {
  readonly code = "AUTH_REQUIRED";
  constructor(message = "AUTH_required") {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Authorisation failure, thrown by `requireAdmin` / `requireModerator`.
 *
 * A separate class from `AuthError` matters: the two produce different status
 * codes (401 vs 403), and conflating them is how a "you are not an admin"
 * request ends up looking like "you are not signed in".
 */
export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** True for authentication failures from `requireAuth`, however they were raised. */
export function isAuthError(error: unknown): boolean {
  if (error instanceof AuthError) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message === "AUTH_required" || message === "AUTH_REQUIRED" || message === "AUTH_TOKEN_INVALID";
}

/** True for `requireAdmin` / `requireModerator` refusals. */
export function isForbiddenError(error: unknown): boolean {
  if (error instanceof ForbiddenError) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message === "FORBIDDEN";
}

/** Delete the token cache between calls (tests only). */
export interface AuthResult {
  /** Verified Firebase uid. Resolve to users.id before using it as a data key. */
  userId: string;
  email: string | null;
  emailVerified: boolean;
  isAuthenticated: boolean;
}

type RequestWithAuth = Request & { __auth?: AuthResult };

function requestAuth(request: Request): AuthResult | undefined {
  return (request as RequestWithAuth).__auth;
}

export async function authMiddleware(request: Request, env: Env): Promise<AuthResult> {
  const logger = createLogger(env);
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { userId: "", email: null, emailVerified: false, isAuthenticated: false };
  }

  const token = authHeader.substring(7);

  try {
    const decodedToken = await verifyFirebaseToken(token, env);
    return {
      userId: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.emailVerified,
      isAuthenticated: true,
    };
  } catch (error) {
    logger.error("Auth middleware error", error);
    return { userId: "", email: null, emailVerified: false, isAuthenticated: false };
  }
}

export async function requireAuth(request: Request, env: Env): Promise<string> {
  // The Worker entry point has already verified the bearer token. Reuse that
  // result so every protected handler does not repeat JWT parsing, certificate
  // lookup and WebCrypto verification. Direct handler tests still fall back to
  // normal middleware verification because they bypass the entry point.
  const auth = requestAuth(request) ?? (await authMiddleware(request, env));

  if (!auth.isAuthenticated) {
    throw new AuthError();
  }

  // Resolve the Firebase uid to the internal user id (the data model keys by users.id).
  const db = new Database(env);
  let user = await db.querySingle(
    "SELECT id FROM users WHERE firebase_uid = ? AND deleted_at IS NULL",
    [auth.userId],
  );

  if (!user) {
    // `INSERT OR IGNORE` rather than `INSERT`: two devices signing in for the
    // first time at once must not turn the second one into a UNIQUE-constraint
    // 500 — whichever insert wins, both requests proceed with the row.
    const id = db.uuid();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT OR IGNORE INTO users (id, firebase_uid, email, email_verified, created_at, updated_at, last_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, auth.userId, auth.email, auth.emailVerified ? 1 : 0, now, now, now],
    );
    user = await db.querySingle(
      "SELECT id FROM users WHERE firebase_uid = ? AND deleted_at IS NULL",
      [auth.userId],
    );
    if (!user) {
      // The uid row exists but is soft-deleted: the account was removed. Do not
      // resurrect it silently — a banned member should not come back through a
      // new device login.
      throw new Error("FORBIDDEN");
    }
    // First login ever: the claim-then-send helper makes the welcome email
    // exactly-once even when two devices race the insert. Runs only on the
    // request that created the row, so nothing is paid on later sign-ins.
    await maybeSendWelcomeEmail(env, user.id);
  } else {
    await db.execute("UPDATE users SET last_active = ? WHERE firebase_uid = ?", [
      new Date().toISOString(),
      auth.userId,
    ]);
  }

  return user.id;
}

export async function optionalAuth(request: Request, env: Env): Promise<string | null> {
  const auth = requestAuth(request) ?? (await authMiddleware(request, env));
  return auth.isAuthenticated ? auth.userId : null;
}

export async function requireAdmin(request: Request, env: Env): Promise<string> {
  const userId = await requireAuth(request, env);
  const db = new Database(env);

  const result = await db.querySingle("SELECT role FROM admin_users WHERE user_id = ?", [userId]);

  if (!result || !["super_admin", "admin"].includes(result.role)) {
    throw new ForbiddenError();
  }

  return userId;
}

/**
 * Moderation tier: moderators plus admins and super admins.
 *
 * Matches `ROLE_PERMISSIONS.moderator` (`moderate`, `manage_videos`,
 * `manage_reviews`): reports, appeals, support and video restore. Analytics,
 * user management, top-ups and role changes stay `requireAdmin`.
 */
export async function requireModerator(request: Request, env: Env): Promise<string> {
  const userId = await requireAuth(request, env);
  const db = new Database(env);

  const result = await db.querySingle("SELECT role FROM admin_users WHERE user_id = ?", [userId]);

  if (!result || !["super_admin", "admin", "moderator"].includes(result.role)) {
    throw new ForbiddenError();
  }

  return userId;
}
