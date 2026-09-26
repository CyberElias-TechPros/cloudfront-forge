/// <reference types="@cloudflare/workers-types" />
import type { Env } from "./types";
import {
  errorHandler,
  createResponse,
  createErrorResponse,
  isSchemaDriftError,
  SECURITY_HEADERS,
} from "./middleware/errorHandler";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { authMiddleware } from "./middleware/auth";
import { routes } from "./routes";
import { findRoute } from "./lib/router";
import { runAllJobs } from "./jobs";
import { Database } from "./lib/database";
import { createLogger } from "./lib/logger";

/**
 * Resolve the CORS response for an incoming origin.
 *
 * `CORS_ORIGINS` is a comma-separated allow-list. Entries may start with `*.`
 * to allow every subdomain of a host (e.g. `*.vercel.app` for preview
 * deployments). When the origin is not allow-listed we return nothing at all
 * rather than echoing the first configured origin — echoing made the allow-list
 * meaningless for credentialed browser requests.
 */
function resolveCorsOrigin(origin: string, env: Env): string | null {
  if (!origin) return null;
  const allowed = (env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  for (const entry of allowed) {
    if (entry === origin) return origin;
    if (entry.startsWith("*.") && origin.endsWith(entry.slice(1))) return origin;
  }

  // Local development: the Vite dev server proxies /api/*, but `wrangler dev`
  // is also reachable directly from the browser during debugging.
  if (
    env.ENVIRONMENT !== "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    return origin;
  }

  return null;
}

let envValidated = false;

function validateEnv(env: Env): void {
  if (envValidated) return;

  const required = ["FIREBASE_PROJECT_ID", "ENVIRONMENT"] as const;
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`MISSING_ENV: ${missing.join(", ")}`);
  }
  envValidated = true;
}

/**
 * Exercise columns/tables introduced by the newest production migrations.
 * Preparing this query fails even when the tables are empty, making /ready a
 * deployment gate for the exact schema drift that would otherwise turn every
 * authenticated request into a 500.
 */
async function assertSchemaReady(env: Env): Promise<void> {
  await new Database(env).querySingle(
    `SELECT
       (SELECT status FROM users LIMIT 1) AS user_status,
       (SELECT status FROM communities LIMIT 1) AS community_status,
       (SELECT overdue_notified FROM reviews LIMIT 1) AS review_overdue_flag,
       (SELECT id FROM join_requests LIMIT 1) AS join_request_id,
       (SELECT id FROM support_requests LIMIT 1) AS support_request_id,
       (SELECT welcome_sent_at FROM users LIMIT 1) AS user_welcome_sent_at,
       (SELECT rules FROM communities LIMIT 1) AS community_rules`,
  );
}

/**
 * Moderation state for the entry-point account gate.
 *
 * `users.status` arrives with migration 031. If the Worker is deployed ahead
 * of that migration, the gate used to throw on *every* authenticated request —
 * sign-in included — turning a pending migration into a total outage. Without
 * the column no member can have been suspended or banned, so falling back to
 * the soft-delete check is equivalent; the drift is logged loudly and `/ready`
 * keeps failing until the migration is applied.
 */
async function loadAccountState(
  env: Env,
  firebaseUid: string,
): Promise<{ status?: string | null; deleted_at?: string | null } | null> {
  const db = new Database(env);
  try {
    return await db.querySingle("SELECT status, deleted_at FROM users WHERE firebase_uid = ?", [
      firebaseUid,
    ]);
  } catch (error) {
    if (!isSchemaDriftError(error)) throw error;
    createLogger(env).error(
      "SCHEMA_DRIFT: users.status is missing — apply D1 migrations (npm run db:migrate)",
      error,
    );
    return await db.querySingle("SELECT deleted_at FROM users WHERE firebase_uid = ?", [
      firebaseUid,
    ]);
  }
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await runAllJobs(env);
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health checks must answer even when the environment is incomplete —
    // otherwise a misconfigured deploy is indistinguishable from a dead one.
    if (path === "/health" || path === "/health/") {
      const headers = new Headers({ "Content-Type": "application/json" });
      SECURITY_HEADERS.forEach((value, key) => headers.set(key, value));
      return new Response(
        JSON.stringify({
          status: "ok",
          environment: env.ENVIRONMENT ?? "unknown",
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers },
      );
    }

    const origin = request.headers.get("Origin") || "";
    const corsOrigin = resolveCorsOrigin(origin, env);
    const corsHeaders = new Headers({
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      Vary: "Origin",
    });
    if (corsOrigin) {
      corsHeaders.set("Access-Control-Allow-Origin", corsOrigin);
      corsHeaders.set("Access-Control-Allow-Credentials", "true");
    }
    SECURITY_HEADERS.forEach((value, key) => corsHeaders.set(key, value));

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      validateEnv(env);

      if (path === "/ready" || path === "/ready/") {
        try {
          await assertSchemaReady(env);
          return createResponse(
            {
              status: "ready",
              environment: env.ENVIRONMENT,
              schemaVersion: "037",
              timestamp: new Date().toISOString(),
            },
            200,
            corsHeaders,
          );
        } catch (error) {
          createLogger(env).error("Readiness check failed", error);
          return createErrorResponse(
            "NOT_READY",
            "Service dependencies are not ready",
            503,
            corsHeaders,
          );
        }
      }

      const isAuthEndpoint = path.startsWith("/api/v1/auth/");
      const isExpensiveEndpoint =
        path.startsWith("/api/v1/ai/") ||
        (path === "/api/v1/videos" && request.method === "POST") ||
        (path === "/api/v1/watch" && request.method === "POST");
      const isWriteEndpoint =
        request.method === "POST" ||
        request.method === "PUT" ||
        request.method === "PATCH" ||
        request.method === "DELETE";

      const rateLimited = await rateLimitMiddleware(request, env, {
        maxRequests: isAuthEndpoint
          ? parseInt(env.AUTH_RATE_LIMIT_MAX_REQUESTS || "30", 10)
          : isExpensiveEndpoint
            ? 20
            : parseInt(env.RATE_LIMIT_MAX_REQUESTS || (isWriteEndpoint ? "100" : "200"), 10),
        windowSeconds: isAuthEndpoint
          ? parseInt(env.AUTH_RATE_LIMIT_WINDOW || "60", 10)
          : isExpensiveEndpoint
            ? 60
            : parseInt(env.RATE_LIMIT_WINDOW || "60", 10),
        failClosed: isAuthEndpoint || isExpensiveEndpoint || path.startsWith("/api/v1/admin/"),
        keyPrefix: isAuthEndpoint
          ? "auth"
          : isExpensiveEndpoint
            ? "expensive"
            : isWriteEndpoint
              ? "write"
              : "read",
      });
      if (!rateLimited) {
        return createErrorResponse("RATE_LIMITED", "Too many requests", 429, corsHeaders);
      }

      const route = findRoute(routes, request.method, path);
      if (!route) {
        return createErrorResponse("NOT_FOUND", "Route not found", 404, corsHeaders);
      }

      const auth = await authMiddleware(request, env);
      (request as unknown as { __auth: typeof auth }).__auth = auth;

      // Moderated or deleted accounts may not use any route. Enforced once at
      // the entry point (not per handler) so every endpoint rejects with the
      // same distinguishable 403 — the frontend maps the codes to a useful
      // screen instead of a generic failure.
      if (auth.isAuthenticated) {
        const account = await loadAccountState(env, auth.userId);
        if (account) {
          if (account.deleted_at) {
            return createErrorResponse(
              "ACCOUNT_DELETED",
              "This account has been deleted",
              403,
              corsHeaders,
            );
          }
          if (account.status === "suspended") {
            return createErrorResponse(
              "ACCOUNT_SUSPENDED",
              "This account is suspended. Contact support for details.",
              403,
              corsHeaders,
            );
          }
          if (account.status === "banned") {
            return createErrorResponse(
              "ACCOUNT_BANNED",
              "This account has been banned from the platform",
              403,
              corsHeaders,
            );
          }
        }
      }

      const response = await route.handler(request, env);

      const responseHeaders = new Headers(corsHeaders);
      response.headers.forEach((value, key) => responseHeaders.set(key, value));
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return errorHandler(error as Error, request, corsHeaders, env, ctx);
    }
  },
};

// Re-exported so the routing table can be exercised without going through fetch.
export { routes };
export { createResponse };
