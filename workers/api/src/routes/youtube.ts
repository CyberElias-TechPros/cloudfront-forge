import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { YouTubeService } from "../services/youtube";

const youtubeService = (env: Env) => new YouTubeService(env);

export const youtubeRoutes = [
  {
    method: "GET",
    path: "/api/v1/youtube/oauth/authorize",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const state = crypto.randomUUID();
        const authUrl = youtubeService(env).getAuthUrl(state);

        const db = new Database(env);
        await db.execute(
          "INSERT OR REPLACE INTO youtube_oauth_states (id, user_id, state, created_at) VALUES (?, ?, ?, ?)",
          [crypto.randomUUID(), userId, state, new Date().toISOString()],
        );

        return createResponse({ authUrl });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message === "AUTH_required" || message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (message === "YOUTUBE_OAUTH_NOT_CONFIGURED") {
          return createErrorResponse("SERVICE_UNAVAILABLE", "YouTube OAuth is not configured", 503);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to start OAuth flow", 500);
      }
    },
  },
  {
    method: "POST",
    path: "/api/v1/youtube/oauth/callback",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const rawBody = await request.json().catch(() => ({}));
        const body = rawBody as Record<string, unknown>;
        const code = typeof body.code === "string" ? body.code : undefined;
        const state = typeof body.state === "string" ? body.state : undefined;

        if (!code) {
          return createErrorResponse("VALIDATION_ERROR", "Authorization code is required", 400);
        }

        const db = new Database(env);
        const stateRow = state
          ? await db.querySingle(
              "SELECT user_id FROM youtube_oauth_states WHERE state = ? AND created_at >= datetime('now', '-10 minutes')",
              [state],
            )
          : null;

        if (!stateRow) {
          return createErrorResponse("VALIDATION_ERROR", "Invalid or expired state", 400);
        }

        const tokens = await youtubeService(env).exchangeCodeForTokens(code);
        await youtubeService(env).saveTokens(stateRow.user_id, tokens);

        await db.execute("DELETE FROM youtube_oauth_states WHERE state = ?", [state]);

        return createResponse({ message: "YouTube account connected successfully" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message === "YOUTUBE_OAUTH_NOT_CONFIGURED") {
          return createErrorResponse("SERVICE_UNAVAILABLE", "YouTube OAuth is not configured", 503);
        }
        if (message.includes("YOUTUBE_TOKEN_EXCHANGE_FAILED")) {
          return createErrorResponse("AUTH_ERROR", "Failed to exchange authorization code", 400);
        }
        return createErrorResponse("INTERNAL_ERROR", "OAuth callback failed", 500);
      }
    },
  },
  {
    method: "GET",
    path: "/api/v1/youtube/status",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const tokenRow = await db.querySingle(
          "SELECT * FROM youtube_oauth_tokens WHERE user_id = ?",
          [userId],
        );

        if (!tokenRow) {
          return createResponse({ connected: false });
        }

        const accessToken = await youtubeService(env).getValidAccessToken(userId);
        return createResponse({
          connected: !!accessToken,
          channelId: tokenRow.channel_id || null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message === "AUTH_required" || message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to check YouTube status", 500);
      }
    },
  },
  {
    method: "POST",
    path: "/api/v1/youtube/disconnect",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        await db.execute("DELETE FROM youtube_oauth_tokens WHERE user_id = ?", [userId]);
        return createResponse({ message: "YouTube account disconnected" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message === "AUTH_required" || message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to disconnect YouTube", 500);
      }
    },
  },
];
