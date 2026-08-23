import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { YouTubeService } from "../services/youtube";

const youtubeService = (env: Env) => new YouTubeService(env);

const STATE_TTL_SEC = 600; // 10 minutes

// First allowed CORS origin doubles as the canonical frontend origin for OAuth redirects.
function frontendOrigin(env: Env): string {
  const first = (env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean)[0];
  return first || "https://loop.freegameplay.site";
}

// Best-effort enrichment: resolve and persist which YouTube channel the user connected.
async function enrichWithChannel(env: Env, userId: string): Promise<void> {
  try {
    const svc = youtubeService(env);
    const accessToken = await svc.getValidAccessToken(userId);
    if (!accessToken) return;
    const channelId = await svc.getChannelId(accessToken);
    if (channelId) {
      await new Database(env).execute(
        "UPDATE youtube_oauth_tokens SET channel_id = ?, updated_at = ? WHERE user_id = ?",
        [channelId, new Date().toISOString(), userId],
      );
    }
  } catch {}
}

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
        const nowEpoch = Math.floor(Date.now() / 1000);

        // Opportunistic cleanup of expired states
        await db.execute("DELETE FROM youtube_oauth_states WHERE expires_at IS NOT NULL AND expires_at < ?", [
          nowEpoch,
        ]);

        await db.execute(
          "INSERT INTO youtube_oauth_states (id, user_id, state, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
          [crypto.randomUUID(), userId, state, new Date().toISOString(), nowEpoch + STATE_TTL_SEC],
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
    method: "GET",
    path: "/api/v1/youtube/oauth/callback",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const url = new URL(request.url);
        const code = url.searchParams.get("code") || undefined;
        const state = url.searchParams.get("state") || undefined;

        if (!code) {
          return createErrorResponse("VALIDATION_ERROR", "Authorization code is required", 400);
        }

        const db = new Database(env);
        const nowEpoch = Math.floor(Date.now() / 1000);
        const stateRow = state
          ? await db.querySingle(
              "SELECT user_id FROM youtube_oauth_states WHERE state = ? AND expires_at > ?",
              [state, nowEpoch],
            )
          : null;

        if (!stateRow) {
          return createErrorResponse("VALIDATION_ERROR", "Invalid or expired state", 400);
        }

        const tokens = await youtubeService(env).exchangeCodeForTokens(code);
        await youtubeService(env).saveTokens(stateRow.user_id, tokens);
        await enrichWithChannel(env, stateRow.user_id);

        await db.execute("DELETE FROM youtube_oauth_states WHERE state = ?", [state]);

        // Redirect to frontend settings with success - for Google OAuth popup flow
        const frontendUrl = `${frontendOrigin(env)}/settings?youtube=connected`;
        return Response.redirect(frontendUrl, 302);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const frontendErrorUrl = `${frontendOrigin(env)}/settings?youtube=error&reason=${encodeURIComponent(message)}`;
        if (message === "YOUTUBE_OAUTH_NOT_CONFIGURED") {
          return Response.redirect(frontendErrorUrl, 302);
        }
        if (message.includes("YOUTUBE_TOKEN_EXCHANGE_FAILED")) {
          return Response.redirect(frontendErrorUrl, 302);
        }
        return Response.redirect(frontendErrorUrl, 302);
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
        const nowEpoch = Math.floor(Date.now() / 1000);
        const stateRow = state
          ? await db.querySingle(
              "SELECT user_id FROM youtube_oauth_states WHERE state = ? AND expires_at > ?",
              [state, nowEpoch],
            )
          : null;

        if (!stateRow) {
          return createErrorResponse("VALIDATION_ERROR", "Invalid or expired state", 400);
        }

        const tokens = await youtubeService(env).exchangeCodeForTokens(code);
        await youtubeService(env).saveTokens(stateRow.user_id, tokens);
        await enrichWithChannel(env, stateRow.user_id);

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
