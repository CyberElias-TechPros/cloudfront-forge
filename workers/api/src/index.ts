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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // CORS headers
      const headers = new Headers({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json",
      });

      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, { headers });
      }

      // Apply rate limiting
      const rateLimited = await rateLimitMiddleware(request, env);
      if (!rateLimited) {
        return createErrorResponse("RATE_LIMITED", "Too many requests", 429);
      }

      // Apply authentication middleware
      const auth = await authMiddleware(request, env);

      // Get URL path
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // Health check
      if (path === "/health" || path === "/health/") {
        return createResponse({ status: "ok", timestamp: new Date().toISOString() });
      }

      // Combine all routes
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
      ];

      // Find matching route
      const route = allRoutes.find(
        (r) =>
          r.method === method &&
          (path === r.path ||
            ("pattern" in r && path.match(new RegExp(r.pattern ?? ""))?.length)),
      );

      if (!route) {
        return createErrorResponse("NOT_FOUND", "Route not found", 404);
      }

      // Attach auth info to request context
      (request as any).__auth = auth;
      (request as any).__env = env;
      (request as any).__ctx = ctx;

      // Execute route handler
      const response = await route.handler(request, env);

      // Merge headers
      if (response instanceof Response) {
        const responseHeaders = new Headers(headers);
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
      return errorHandler(error as Error, request);
    }
  },
};
