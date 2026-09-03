/// <reference types="@cloudflare/workers-types" />
import type { Env } from "./types";
import {
  errorHandler,
  createResponse,
  createErrorResponse,
  SECURITY_HEADERS,
} from "./middleware/errorHandler";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { authMiddleware } from "./middleware/auth";
import { routes } from "./routes";
import { findRoute } from "./lib/router";
import { runAllJobs } from "./jobs";

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
  if (env.ENVIRONMENT !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return origin;
  }

  return null;
}

let envValidated = false;

function validateEnv(env: Env): void {
  if (envValidated) return;
  envValidated = true;

  const required = ["FIREBASE_PROJECT_ID", "ENVIRONMENT"] as const;
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`MISSING_ENV: ${missing.join(", ")}`);
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
      (request as unknown as { __auth: unknown }).__auth = auth;

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
