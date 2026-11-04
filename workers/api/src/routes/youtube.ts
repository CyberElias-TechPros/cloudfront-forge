import type { Env, RouteDefinition } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { YouTubeService } from "../services/youtube";

const youtubeService = (env: Env) => new YouTubeService(env);

const STATE_TTL_SEC = 600; // 10 minutes

// First allowed CORS origin doubles as the canonical frontend origin for OAuth redirects.
function frontendOrigin(env: Env): string {
  const first = (env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
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
  } catch {
    // channel resolution is best-effort; the OAuth connection itself already succeeded
  }
}

export const youtubeRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/v1/youtube/oauth/authorize",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const state = crypto.randomUUID();
        const authUrl = youtubeService(env).getAuthUrl(state);
        const isAndroid = new URL(request.url).searchParams.get("client") === "android";
        const db = new Database(env);
        if (isAndroid) await env.KV_CACHE.put(`youtube:android:${state}`, "1", { expirationTtl: STATE_TTL_SEC });
        const nowEpoch = Math.floor(Date.now() / 1000);

        // Opportunistic cleanup of expired states
        await db.execute(
          "DELETE FROM youtube_oauth_states WHERE expires_at IS NOT NULL AND expires_at < ?",
          [nowEpoch],
        );

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
      let androidResult: ((result: string) => Response) | null = null;
      try {
        const url = new URL(request.url);
        const code = url.searchParams.get("code") || undefined;
        const state = url.searchParams.get("state") || undefined;

        const db = new Database(env);
        const nowEpoch = Math.floor(Date.now() / 1000);
        // Consume state atomically: two simultaneous callbacks cannot link twice.
        const stateRow = state ? await db.querySingle(
          "DELETE FROM youtube_oauth_states WHERE state = ? AND expires_at > ? RETURNING user_id",
          [state, nowEpoch],
        ) : null;
        const isAndroid = state ? await env.KV_CACHE.get(`youtube:android:${state}`) === "1" : false;
        if (isAndroid) androidResult = (result) => Response.redirect(`${env.ANDROID_OAUTH_REDIRECT_URI ?? "creatorloop://youtube"}?result=${result}`, 302);
        const nativeResult = (result: string) => Response.redirect(
          `${env.ANDROID_OAUTH_REDIRECT_URI ?? "creatorloop://youtube"}?result=${result}`, 302);
        if (!stateRow) return isAndroid ? nativeResult("expired") :
          createErrorResponse("VALIDATION_ERROR", "Invalid or expired state", 400);
        // Keep the non-secret client marker until TTL so a replay can receive
        // the same native "expired" result. The database state is already consumed.
        if (url.searchParams.get("error")) return isAndroid ? nativeResult("cancelled") :
          Response.redirect(`${frontendOrigin(env)}/settings?youtube=cancelled`, 302);
        if (!code) return isAndroid ? nativeResult("error") :
          createErrorResponse("VALIDATION_ERROR", "Authorization code is required", 400);
        const tokens = await youtubeService(env).exchangeCodeForTokens(code);
        await youtubeService(env).saveTokens(stateRow.user_id, tokens);
        await enrichWithChannel(env, stateRow.user_id);

        await db.execute("DELETE FROM youtube_oauth_states WHERE state = ?", [state]);

        if (isAndroid) return nativeResult("connected");
        // Redirect to frontend settings with success - for Google OAuth popup flow
        const frontendUrl = `${frontendOrigin(env)}/settings?youtube=connected`;
        return Response.redirect(frontendUrl, 302);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (androidResult) return androidResult("error");
        const frontendErrorUrl = `${frontendOrigin(env)}/settings?youtube=error`;
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
              "DELETE FROM youtube_oauth_states WHERE state = ? AND expires_at > ? RETURNING user_id",
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
          return createErrorResponse("BAD_REQUEST", "Failed to exchange authorization code", 400);
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
