import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { YouTubeService } from "../services/youtube";
import { z } from "zod";
import { createLogger } from "../lib/logger";

function levelForXp(totalXp: number): number {
  return Math.max(1, Math.floor(totalXp / 250) + 1);
}

async function ensureReputation(db: Database, userId: string, now: string): Promise<void> {
  const existing = await db.querySingle("SELECT id FROM reputation_accounts WHERE user_id = ?", [
    userId,
  ]);
  if (!existing) {
    await db.execute(
      `INSERT INTO reputation_accounts (id, user_id, score, last_calculated, created_at, updated_at)
       VALUES (?, ?, 100, ?, ?, ?)`,
      [db.uuid(), userId, now, now, now],
    );
  }
}

async function verifyYouTubeSubscription(
  db: Database,
  watcherId: string,
  videoChannelId: string,
  videoId: string,
  env: Env,
  requiredWatchSec?: number,
): Promise<{ subscribed: boolean; watchVerified: boolean; watchSeconds: number; reason: string }> {
  const logger = createLogger(env);
  const youtube = new YouTubeService(env);
  const accessToken = await youtube.getValidAccessToken(watcherId);
  const REQUIRED_WATCH_SEC =
    requiredWatchSec ?? parseInt(env.REQUIRED_WATCH_SEC || "180", 10);
  let watchVerified = false;
  let watchSeconds = 0;

  if (accessToken) {
    try {
      watchSeconds = await youtube.getWatchTime(accessToken, videoId);
      watchVerified = watchSeconds >= REQUIRED_WATCH_SEC;
    } catch (error) {
      logger.error("YouTube watch time verification error", error);
    }
  }

  if (!accessToken) {
    return { subscribed: false, watchVerified: false, watchSeconds: 0, reason: "YouTube account not connected" };
  }

  if (!videoChannelId) {
    return { subscribed: false, watchVerified, watchSeconds, reason: "Video channel ID missing" };
  }

  try {
    const subscribed = await youtube.isSubscribedTo(accessToken, videoChannelId);
    return {
      subscribed,
      watchVerified,
      watchSeconds,
      reason: subscribed
        ? watchVerified
          ? "YouTube subscription and watch time verified"
          : `Watch time not yet verified (${Math.round(watchSeconds)}s / ${REQUIRED_WATCH_SEC}s)`
        : "Not subscribed to channel",
    };
  } catch (error) {
    logger.error("YouTube subscription verification error", error);
    return { subscribed: false, watchVerified, watchSeconds, reason: "YouTube verification failed" };
  }
}

async function notifyUser(db: Database, userId: string, type: string, title: string, message: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [db.uuid(), userId, type, title, message, now],
  );
}

const watchSchema = z.object({
  videoId: z.string().min(1),
  watchSeconds: z.number().min(0).max(86400),
  subscribed: z.boolean().default(false),
  commented: z.boolean().default(false),
  sessionToken: z.string().optional(),
});

// --- HMAC watch-session helpers (env-flagged, legacy fallback when disabled) ---
function sessionsEnabled(env: Env): boolean {
  return env.WATCH_SESSIONS_ENABLED === "1" || env.WATCH_SESSIONS_ENABLED === "true";
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function extractUserId(request: Request): string | null {
  const auth = (request as any).__auth;
  return auth?.userId ?? null;
}

export const watchRoutes = [
  // POST /watch/start - issue a signed session token for server-verified playback
  {
    method: "POST",
    path: "/api/v1/watch/start",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        if (!sessionsEnabled(env)) {
          return createResponse({ sessionToken: null, enabled: false });
        }
        const userId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;
        const videoId = body.videoId as string | undefined;
        if (!videoId) return createErrorResponse("VALIDATION_ERROR", "videoId required", 400);

        const secret = env.WATCH_SESSION_SECRET || env.AI_API_KEY || "fallback-dev-secret";
        const startTs = Math.floor(Date.now() / 1000);
        const payload = `${userId}:${videoId}:${startTs}`;
        const signature = await hmacSign(secret, payload);
        const token = `${payload}:${signature}`;
        const expiresAt = startTs + 3600; // 1 hour

        const db = new Database(env);
        const dbToken = db.uuid();
        await db.execute(
          "INSERT INTO watch_session_tokens (id, user_id, video_id, token, start_ts, expires_at, created_at) VALUES (?,?,?,?,?,?,?)",
          [dbToken, userId, videoId, token, startTs, expiresAt, new Date().toISOString()],
        );

        return createResponse({ sessionToken: token, enabled: true, startTs });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to start session", 500);
      }
    },
  },
  // POST /watch/heartbeat - record a periodic player-time sample for slope verification
  {
    method: "POST",
    path: "/api/v1/watch/heartbeat",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        if (!sessionsEnabled(env)) {
          return createResponse({ ok: true, enabled: false });
        }
        const userId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;
        const { sessionToken, playerTime } = body as { sessionToken?: string; playerTime?: number };
        if (!sessionToken || typeof playerTime !== "number") {
          return createErrorResponse("VALIDATION_ERROR", "sessionToken and playerTime required", 400);
        }

        const db = new Database(env);
        const row = await db.querySingle(
          "SELECT id FROM watch_session_tokens WHERE token = ? AND user_id = ? AND expires_at > ?",
          [sessionToken, userId, Math.floor(Date.now() / 1000)],
        );
        if (!row) return createErrorResponse("UNAUTHORIZED", "Invalid or expired session token", 401);

        await db.execute(
          "INSERT INTO watch_heartbeats (id, session_token_id, player_time, received_at) VALUES (?,?,?,?)",
          [crypto.randomUUID(), row.id, playerTime, Math.floor(Date.now() / 1000)],
        );

        return createResponse({ ok: true, enabled: true });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to record heartbeat", 500);
      }
    },
  },
  {
    method: "POST",
    path: "/api/v1/watch",
    handler: async (request: Request, env: Env): Promise<Response> => {
      const logger = createLogger(env);
      try {
        const REQUIRED_WATCH_SEC = parseInt(env.REQUIRED_WATCH_SEC || "180", 10);
        const REWARD_XP = parseInt(env.REWARD_XP || "30", 10);
        const REWARD_CREDITS = parseInt(env.REWARD_CREDITS || "10", 10);
        const watcherId = await requireAuth(request, env);
        const body = await request.json().catch(() => ({}));
        const validation = watchSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }
        const { videoId, watchSeconds, subscribed, commented } = validation.data;

        const db = new Database(env);

        const video = await db.querySingle(
          "SELECT id, user_id, channel_id, duration_seconds, magic_word FROM videos WHERE id = ?",
          [videoId],
        );
        if (!video) {
          return createErrorResponse("NOT_FOUND", "Video not found", 404);
        }

        // Short videos: require at most the full length, capped at REQUIRED_WATCH_SEC
        const videoDuration =
          typeof video.duration_seconds === "number" && video.duration_seconds > 0
            ? video.duration_seconds
            : null;
        const requiredWatchSec = videoDuration
          ? Math.min(REQUIRED_WATCH_SEC, videoDuration)
          : REQUIRED_WATCH_SEC;

        const existing = await db.querySingle(
          "SELECT * FROM watch_sessions WHERE video_id = ? AND watcher_id = ?",
          [videoId, watcherId],
        );

        const now = new Date().toISOString();

        const {
          subscribed: verifiedSubscribed,
          watchVerified,
          watchSeconds: verifiedWatchSeconds,
          reason: subReason,
        } = await verifyYouTubeSubscription(
          db,
          watcherId,
          video.channel_id ?? "",
          videoId,
          env,
          requiredWatchSec,
        );

        // Magic-word comment verification: if creator set a word, verify comment via API
        let verifiedCommented = commented;
        const magicWord = video.magic_word as string | null;
        if (magicWord && commented) {
          try {
            const svc = new YouTubeService(env);
            const accessToken = await svc.getValidAccessToken(watcherId);
            if (accessToken) {
              verifiedCommented = await svc.verifyMagicWordComment(
                accessToken,
                videoId,
                magicWord,
              );
            } else {
              verifiedCommented = false;
            }
          } catch {
            verifiedCommented = false;
          }
        }

        const effectiveWatchSeconds = watchVerified ? verifiedWatchSeconds : watchSeconds;
        const watchClaimable = effectiveWatchSeconds >= requiredWatchSec && verifiedSubscribed && verifiedCommented;
        const claimable = watchClaimable;

        if (existing) {
          await db.execute(
            `UPDATE watch_sessions SET watch_seconds = ?, subscribed = ?, commented = ?,
             status = ?, verified_at = ?, updated_at = ? WHERE id = ?`,
            [
              watchSeconds,
              verifiedSubscribed ? 1 : 0,
              verifiedCommented ? 1 : 0,
              claimable ? "claimed" : effectiveWatchSeconds >= requiredWatchSec ? "verified" : "started",
              claimable ? now : existing.verified_at,
              now,
              existing.id,
            ],
          );
        } else {
          await db.execute(
            `INSERT INTO watch_sessions (id, video_id, watcher_id, watch_seconds, status,
             subscribed, commented, verified_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              db.uuid(),
              videoId,
              watcherId,
              watchSeconds,
              claimable ? "claimed" : effectiveWatchSeconds >= requiredWatchSec ? "verified" : "started",
              verifiedSubscribed ? 1 : 0,
              verifiedCommented ? 1 : 0,
              claimable ? now : null,
              now,
              now,
            ],
          );
        }

        let xpAwarded = 0;
        let creditsAwarded = 0;
        const alreadyClaimed = existing?.status === "claimed";

        const effectiveSubscribed = verifiedSubscribed && subscribed;

        if (claimable && !alreadyClaimed && effectiveSubscribed) {
          xpAwarded = REWARD_XP;
          creditsAwarded = REWARD_CREDITS;

          const batchStatements: Array<{ sql: string; params: unknown[] }> = [];

          const xp = await db.querySingle("SELECT * FROM xp_accounts WHERE user_id = ?", [
            watcherId,
          ]);

          if (xp) {
            const totalXp = (xp.total_xp ?? 0) + xpAwarded;
            batchStatements.push({
              sql: "UPDATE xp_accounts SET total_xp = ?, level = ?, updated_at = ? WHERE user_id = ?",
              params: [totalXp, levelForXp(totalXp), now, watcherId],
            });
          } else {
            batchStatements.push({
              sql: `INSERT INTO xp_accounts (id, user_id, total_xp, level, xp_to_next_level, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              params: [db.uuid(), watcherId, xpAwarded, levelForXp(xpAwarded), 250, now, now],
            });
          }

          batchStatements.push({
            sql: `INSERT INTO reputation_accounts (id, user_id, score, last_calculated, created_at, updated_at)
                 VALUES (?, ?, 100, ?, ?, ?)
                 ON CONFLICT(user_id) DO NOTHING`,
            params: [db.uuid(), watcherId, now, now, now],
          });

          batchStatements.push({
            sql: `UPDATE reputation_accounts
             SET score = MIN(100, score + 1),
                 watch_minutes = watch_minutes + ?,
                 subscriptions_given = subscriptions_given + ?,
                 updated_at = ?
           WHERE user_id = ?`,
            params: [Math.round(effectiveWatchSeconds / 60), effectiveSubscribed ? 1 : 0, now, watcherId],
          });

          if (video.user_id && video.user_id !== watcherId) {
            batchStatements.push({
              sql: `INSERT INTO reputation_accounts (id, user_id, score, last_calculated, created_at, updated_at)
                   VALUES (?, ?, 100, ?, ?, ?)
                   ON CONFLICT(user_id) DO NOTHING`,
              params: [db.uuid(), video.user_id, now, now, now],
            });

            batchStatements.push({
              sql: `UPDATE reputation_accounts
               SET score = MIN(100, score + 1),
                   subscriptions_received = subscriptions_received + ?,
                   updated_at = ?
             WHERE user_id = ?`,
              params: [effectiveSubscribed ? 1 : 0, now, video.user_id],
            });
          }

          const batchResult = await db.batch(batchStatements);
          if (!batchResult) {
            throw new Error("Failed to process rewards transaction");
          }

          if (video.user_id && video.user_id !== watcherId) {
            await notifyUser(
              db,
              video.user_id,
              "WATCH_SESSION_CLAIMED",
              "Your video was watched",
              `Someone completed watching your video and earned rewards.`,
            );
          }
        }

        const status =
          claimable && effectiveSubscribed
            ? "claimed"
            : effectiveWatchSeconds >= requiredWatchSec
              ? "verified"
              : "started";

        return createResponse({
          status,
          claimable: effectiveSubscribed && effectiveWatchSeconds >= requiredWatchSec,
          xpAwarded,
          creditsAwarded,
          subReason,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message === "AUTH_required" || message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        logger.error("Watch submit error", error);
        return createErrorResponse("INTERNAL_ERROR", "Failed to record watch", 500);
      }
    },
  },
];
