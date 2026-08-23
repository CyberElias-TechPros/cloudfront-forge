/// <reference types="@cloudflare/workers-types" />
import type { Env, ApiResponse } from "./types";
import { errorHandler, createResponse, createErrorResponse } from "./middleware/errorHandler";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { authMiddleware } from "./middleware/auth";
import { authRoutes } from "./routes/auth";
import { userRoutes } from "./routes/users";
import { communityRoutes } from "./routes/communities";
import { videoRoutes, reviewRoutes } from "./routes/videos";
import { missionRoutes } from "./routes/missions";
import { gamificationRoutes } from "./routes/gamification";
import { adminRoutes } from "./routes/admin";
import { notificationRoutes } from "./routes/notifications";
import { feedRoutes } from "./routes/feed";
import { watchRoutes } from "./routes/watch";
import { aiRoutes } from "./routes/ai";
import { youtubeRoutes } from "./routes/youtube";
import { searchRoutes } from "./routes/search";
import { runAllJobs } from "./jobs";

const SECURITY_HEADERS = new Headers({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
});

function applySecurityHeaders(headers: Headers): Headers {
  SECURITY_HEADERS.forEach((value, key) => {
    headers.set(key, value);
  });
  return headers;
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
    try {
      validateEnv(env);
      const corsOrigins = (env.CORS_ORIGINS || "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      const origin = request.headers.get("Origin") || "";
      const isAllowedOrigin = corsOrigins.includes(origin);
      const corsOrigin = isAllowedOrigin ? origin : corsOrigins[0] || "*";

      const corsHeaders = new Headers({
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
      });

      applySecurityHeaders(corsHeaders);

      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      const url = new URL(request.url);
      const path = url.pathname;

      const isAuthEndpoint = path.startsWith("/api/v1/auth/");
      const rateLimited = await rateLimitMiddleware(request, env, {
        maxRequests: isAuthEndpoint
          ? parseInt(env.AUTH_RATE_LIMIT_MAX_REQUESTS || "30", 10)
          : parseInt(env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
        windowSeconds: isAuthEndpoint
          ? parseInt(env.AUTH_RATE_LIMIT_WINDOW || "60", 10)
          : parseInt(env.RATE_LIMIT_WINDOW || "60", 10),
        failClosed: isAuthEndpoint || path.startsWith("/api/v1/admin/"),
        keyPrefix: isAuthEndpoint ? "auth" : "general",
      });
      if (!rateLimited) {
        return createErrorResponse("RATE_LIMITED", "Too many requests", 429, corsHeaders);
      }

      const auth = await authMiddleware(request, env);
      const method = request.method;

      if (path === "/health" || path === "/health/") {
        const headers = applySecurityHeaders(new Headers({
          "Content-Type": "application/json",
        }));
        return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
          status: 200,
          headers,
        });
      }

      const allRoutes = [
        ...authRoutes,
        ...userRoutes,
        ...communityRoutes,
        ...videoRoutes,
        ...reviewRoutes,
        ...missionRoutes,
        ...gamificationRoutes,
        ...adminRoutes,
        ...notificationRoutes,
        ...feedRoutes,
        ...watchRoutes,
        ...aiRoutes,
        ...youtubeRoutes,
        ...searchRoutes,
      ];

      const route = allRoutes.find(
        (r) =>
          r.method === method &&
          (path === r.path || ("pattern" in r && path.match(new RegExp(r.pattern ?? ""))?.length)),
      );

      if (!route) {
        return createErrorResponse("NOT_FOUND", "Route not found", 404, corsHeaders);
      }

      (request as any).__auth = auth;
      (request as any).__env = env;
      (request as any).__ctx = ctx;

      const response = await route.handler(request, env);

      if (response instanceof Response) {
        const responseHeaders = applySecurityHeaders(new Headers(corsHeaders));
        response.headers.forEach((value, key) => {
          responseHeaders.set(key, value);
        });
        return new Response(response.body, {
          status: response.status,
          headers: responseHeaders,
        });
      }

      return createResponse(response);
    } catch (error) {
      const corsOrigins = (env.CORS_ORIGINS || "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      const origin = request.headers.get("Origin") || "";
      const isAllowedOrigin = corsOrigins.includes(origin);
      const corsOrigin = isAllowedOrigin ? origin : corsOrigins[0] || "*";
      const corsHeaders = applySecurityHeaders(new Headers({
        "Access-Control-Allow-Origin": corsOrigin,
        Vary: "Origin",
      }));
      return errorHandler(error as Error, request, corsHeaders);
    }
  },
};
