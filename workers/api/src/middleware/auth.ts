import type { Env } from "../types";
import { Database } from "../lib/database";
import { verifyFirebaseToken } from "../services/firebase";
import { createLogger } from "../lib/logger";

interface AuthResult {
  userId: string;
  email: string | null;
  emailVerified: boolean;
  isAuthenticated: boolean;
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
  const auth = await authMiddleware(request, env);

  if (!auth.isAuthenticated) {
    throw new Error("AUTH_required");
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
  } else {
    await db.execute("UPDATE users SET last_active = ? WHERE firebase_uid = ?", [
      new Date().toISOString(),
      auth.userId,
    ]);
  }

  return user.id;
}

export async function optionalAuth(request: Request, env: Env): Promise<string | null> {
  const auth = await authMiddleware(request, env);
  return auth.isAuthenticated ? auth.userId : null;
}

export async function requireAdmin(request: Request, env: Env): Promise<string> {
  const userId = await requireAuth(request, env);
  const db = new Database(env);

  const result = await db.querySingle("SELECT role FROM admin_users WHERE user_id = ?", [userId]);

  if (!result || !["super_admin", "admin"].includes(result.role)) {
    throw new Error("FORBIDDEN");
  }

  return userId;
}
