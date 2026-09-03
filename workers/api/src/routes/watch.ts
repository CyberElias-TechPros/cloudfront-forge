import type { Env, RouteDefinition } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { YouTubeService } from "../services/youtube";
import { z } from "zod";
import { createLogger } from "../lib/logger";
import { progressQuest } from "../lib/quests";
import { trackEvent } from "../lib/analytics";
import { getRewardSplit } from "../lib/rewards";
import { resolveRequiredWatchSeconds } from "../lib/utils";
import { awardXp, getXpState, type XpAccountState } from "../lib/xp";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyYouTubeSubscription(
  watcherId: string,
  videoChannelId: string,
  videoId: string,
  env: Env,
  requiredWatchSec?: number,
): Promise<{
  connected: boolean;
  subscribed: boolean | null;
  watchVerified: boolean;
  watchSeconds: number;
  reason: string;
}> {
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

  // Per spec, API verification applies only when the watcher has connected
  // YouTube. Otherwise `subscribed` is reported as "unknown" (null) and the
  // claim falls back to the self-reported engagement flags.
  if (!accessToken) {
    return {
      connected: false,
      subscribed: null,
      watchVerified: false,
      watchSeconds: 0,
      reason: "YouTube not connected — claiming on self-reported engagement",
    };
  }

  if (!videoChannelId) {
    return { connected: true, subscribed: null, watchVerified, watchSeconds, reason: "Video channel ID missing" };
  }

  try {
    const subscribed = await youtube.isSubscribedTo(accessToken, videoChannelId);
    return {
      connected: true,
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
    return { connected: true, subscribed: null, watchVerified, watchSeconds, reason: "YouTube verification failed" };
  }
}

async function notifyUser(db: Database, userId: string, type: string, title: string, message: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
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

/**
 * Signing key for watch-session tokens.
 *
 * A predictable fallback in production would let anyone forge session tokens,
 * so the secret is mandatory there (`MISSING_ENV` → 503 from the error
 * handler). Reusing `AI_API_KEY` was removed too: one credential should not
 * double as another subsystem's signing key.
 */
export function watchSessionSecret(env: Env): string {
  if (env.WATCH_SESSION_SECRET) return env.WATCH_SESSION_SECRET;
  if (env.ENVIRONMENT === "production") {
    throw new Error("MISSING_ENV: WATCH_SESSION_SECRET");
  }
  return "watch-session-secret-development-only";
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

export const watchRoutes: RouteDefinition[] = [
  // POST /watch/challenge - issue an attention check (mid-watch overlay)
  {
    method: "POST",
    path: "/api/v1/watch/challenge",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as { videoId?: string };
        if (!body.videoId) {
          return createErrorResponse("VALIDATION_ERROR", "videoId is required", 400);
        }
        const db = new Database(env);
        const now = new Date().toISOString();

        // Generate simple arithmetic challenge; store SHA-256 of answer
        const a = 2 + Math.floor(Math.random() * 9);
        const b = 2 + Math.floor(Math.random() * 9);
        const question = `What is ${a} + ${b}?`;
        const answerHash = await sha256Hex(String(a + b));

        const id = crypto.randomUUID();
        await db.execute(
          `INSERT INTO attention_challenges (id, user_id, video_id, question, answer_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, userId, body.videoId, question, answerHash, now],
        );
        return createResponse({ challengeId: id, question, ttlSec: 120 });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to create challenge", 500);
      }
    },
  },

  // POST /watch/challenge/:id/answer - grade an attention check
  {
    method: "POST",
    pattern: "^\\/api\\/v1/watch/challenge/([^/]+)/answer$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const challengeId = new URL(request.url).pathname.split("/")[5] ?? "";
        const body = (await request.json().catch(() => ({}))) as { answer?: string | number };
        if (body.answer === undefined || body.answer === null) {
          return createErrorResponse("VALIDATION_ERROR", "answer is required", 400);
        }

        const db = new Database(env);
        const row = await db.querySingle(
          "SELECT * FROM attention_challenges WHERE id = ? AND user_id = ? AND status = 'active'",
          [challengeId, userId],
        );
        const challenge = row as Record<string, unknown> | null;
        if (!challenge) {
          return createErrorResponse("NOT_FOUND", "Challenge not found or already resolved", 404);
        }

        const attempts = ((challenge.attempts as number) ?? 0) + 1;
        const correct = (await sha256Hex(String(body.answer).trim())) === challenge.answer_hash;

        if (correct) {
          await db.execute(
            "UPDATE attention_challenges SET status = 'passed', attempts = ?, resolved_at = ? WHERE id = ?",
            [attempts, new Date().toISOString(), challengeId],
          );
          // Small trust bonus for passing first try
          if (attempts === 1) {
            await db.execute(
              "UPDATE reputation_accounts SET score = MIN(100, score + 1), updated_at = ? WHERE user_id = ?",
              [new Date().toISOString(), userId],
            );
          }
          return createResponse({ passed: true, attempts });
        }

        if (attempts >= ((challenge.max_attempts as number) ?? 2)) {
          await db.execute(
            "UPDATE attention_challenges SET status = 'failed', attempts = ?, resolved_at = ? WHERE id = ?",
            [attempts, new Date().toISOString(), challengeId],
          );
          await db.execute(
            "UPDATE reputation_accounts SET score = MAX(0, score - 5), updated_at = ? WHERE user_id = ?",
            [new Date().toISOString(), userId],
          );
          return createResponse({ passed: false, voided: true, attempts });
        }

        await db.execute("UPDATE attention_challenges SET attempts = ? WHERE id = ?", [
          attempts,
          challengeId,
        ]);
        return createResponse({ passed: false, voided: false, attempts });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to submit answer", 500);
      }
    },
  },

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

        const secret = watchSessionSecret(env);
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

        // Block watching your own video
        if (video.user_id === watcherId) {
          return createErrorResponse("FORBIDDEN", "You cannot watch your own video", 403);
        }

        // Short videos: require at most the full length, capped at REQUIRED_WATCH_SEC.
        // The target is a deterministic per-video value so requirements vary
        // naturally across videos instead of being uniformly 180s.
        const videoDuration =
          typeof video.duration_seconds === "number" && video.duration_seconds > 0
            ? video.duration_seconds
            : null;
        const requiredWatchSec = resolveRequiredWatchSeconds(videoId, videoDuration, REQUIRED_WATCH_SEC);

        const existing = await db.querySingle(
          "SELECT * FROM watch_sessions WHERE video_id = ? AND watcher_id = ?",
          [videoId, watcherId],
        );

        const now = new Date().toISOString();

        const {
          connected: youtubeConnected,
          subscribed: verifiedSubscribed,
          watchVerified,
          watchSeconds: verifiedWatchSeconds,
          reason: subReason,
        } = await verifyYouTubeSubscription(
          watcherId,
          video.channel_id ?? "",
          videoId,
          env,
          requiredWatchSec,
        );

        // Magic-word comment verification: if the creator set a word, verify the
        // comment via the API — but only when the watcher connected YouTube
        // (per spec, verification is conditional on an OAuth connection).
        let verifiedCommented = commented;
        const magicWord = video.magic_word as string | null;
        if (magicWord && commented && youtubeConnected) {
          try {
            const svc = new YouTubeService(env);
            const accessToken = await svc.getValidAccessToken(watcherId);
            if (accessToken) {
              verifiedCommented = await svc.verifyMagicWordComment(
                accessToken,
                videoId,
                magicWord,
              );
            }
          } catch {
            verifiedCommented = false;
          }
        }

        const effectiveWatchSeconds = watchVerified ? verifiedWatchSeconds : watchSeconds;

        // Attention check gate: a failed challenge voids this claim
        const failedChallenge = await db.querySingle(
          "SELECT id FROM attention_challenges WHERE user_id = ? AND video_id = ? AND status = 'failed' AND created_at > datetime('now', '-1 day')",
          [watcherId, videoId],
        );
        const attentionBlocked = !!failedChallenge;

        // API-verified subscription when connected; self-reported flag otherwise
        const effectiveSubscribed =
          verifiedSubscribed === null ? subscribed : verifiedSubscribed && subscribed;

        // Rewards: watch and genuine feedback (comment) each pay independently,
        // and nothing is compulsory. Subscribing is tracked as an optional,
        // unpaid trust signal — it never gates earning and never pays points.
        const rewards = getRewardSplit(env);
        const watchDone = effectiveWatchSeconds >= requiredWatchSec;
        const subDone = effectiveSubscribed;
        const commentDone = verifiedCommented;
        const status = watchDone && commentDone ? "claimed" : watchDone ? "verified" : "started";

        if (existing) {
          await db.execute(
            `UPDATE watch_sessions SET watch_seconds = ?, subscribed = ?, commented = ?,
             status = ?, verified_at = ?, updated_at = ? WHERE id = ?`,
            [
              watchSeconds,
              subDone ? 1 : 0,
              commentDone ? 1 : 0,
              status,
              watchDone ? now : existing.verified_at,
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
              status,
              subDone ? 1 : 0,
              commentDone ? 1 : 0,
              watchDone ? now : null,
              now,
              now,
            ],
          );
        }

        let xpAwarded = 0;
        let creditsAwarded = 0;
        // Idempotent + self-healing: recompute the target reward from the
        // components completed so far and pay only the difference. A previous
        // attempt can have marked the row claimed before its reward batch
        // failed; the delta below makes retries safe.
        const alreadyXp = existing ? ((existing.xp_awarded as number) ?? 0) : 0;
        const alreadyCredits = existing ? ((existing.credits_awarded as number) ?? 0) : 0;
        const watchNewlyPaid = watchDone && alreadyXp < rewards.watch.xp;
        const newlySubscribed = subDone && ((existing?.subscribed as number) ?? 0) !== 1;
        const targetXp =
          (watchDone ? rewards.watch.xp : 0) +
          (subDone ? rewards.subscribe.xp : 0) +
          (commentDone ? rewards.comment.xp : 0);
        const targetCredits =
          (watchDone ? rewards.watch.credits : 0) +
          (subDone ? rewards.subscribe.credits : 0) +
          (commentDone ? rewards.comment.credits : 0);
        const xpDelta = Math.max(0, targetXp - alreadyXp);
        const creditsDelta = Math.max(0, targetCredits - alreadyCredits);

        // Daily watch-reward ceiling: a real viewer doesn't watch dozens of
        // videos a day. This flattens the burst pattern without blocking the
        // community (the watch is still recorded; only the reward pauses).
        if (watchNewlyPaid) {
          const DAILY_CLAIM_LIMIT = parseInt(env.DAILY_CLAIM_LIMIT || "10", 10);
          const todayStart = new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";
          const dailyCount = await db.querySingle(
            "SELECT COUNT(*) AS count FROM watch_sessions WHERE watcher_id = ? AND xp_awarded > 0 AND updated_at >= ?",
            [watcherId, todayStart],
          );
          if (Number(dailyCount?.count ?? 0) >= DAILY_CLAIM_LIMIT) {
            return createErrorResponse(
              "DAILY_LIMIT",
              `Daily watch limit reached (${DAILY_CLAIM_LIMIT}/day). Come back tomorrow.`,
              429,
            );
          }
        }

        // Optional subscription support: recorded as a trust signal only — no
        // points, no gating. Runs even when the daily reward ceiling is hit.
        if (newlySubscribed) {
          const subBatch: Array<{ sql: string; params: unknown[] }> = [];
          subBatch.push({
            sql: `INSERT INTO reputation_accounts (id, user_id, score, last_calculated, created_at, updated_at)
                 VALUES (?, ?, 100, ?, ?, ?)
                 ON CONFLICT(user_id) DO NOTHING`,
            params: [db.uuid(), watcherId, now, now, now],
          });
          subBatch.push({
            sql: `UPDATE reputation_accounts
                 SET subscriptions_given = subscriptions_given + 1, updated_at = ?
           WHERE user_id = ?`,
            params: [now, watcherId],
          });
          subBatch.push({
            sql: `INSERT INTO reputation_events (id, user_id, event_type, points_change, description, created_at)
                 VALUES (?, ?, 'subscription_support', 0, 'Optional support: subscribed to a member channel', ?)`,
            params: [db.uuid(), watcherId, now],
          });
          if (video.user_id && video.user_id !== watcherId) {
            subBatch.push({
              sql: `INSERT INTO reputation_accounts (id, user_id, score, last_calculated, created_at, updated_at)
                   VALUES (?, ?, 100, ?, ?, ?)
                   ON CONFLICT(user_id) DO NOTHING`,
              params: [db.uuid(), video.user_id, now, now, now],
            });
            subBatch.push({
              sql: `UPDATE reputation_accounts
                 SET subscriptions_received = subscriptions_received + 1, updated_at = ?
               WHERE user_id = ?`,
              params: [now, video.user_id],
            });
            subBatch.push({
              sql: `INSERT INTO reputation_events (id, user_id, event_type, points_change, description, created_at)
                   VALUES (?, ?, 'subscription_support_received', 0, 'Received optional support from a member', ?)`,
              params: [db.uuid(), video.user_id, now],
            });
          }
          await db.batch(subBatch);
        }

        let xpState: XpAccountState | null = null;

        if ((xpDelta > 0 || creditsDelta > 0) && !attentionBlocked) {
          xpAwarded = xpDelta;
          creditsAwarded = creditsDelta;

          const batchStatements: Array<{ sql: string; params: unknown[] }> = [];

          // XP is written by the shared awarder so the level always matches the
          // curve every other reward path uses (and self-heals stale rows).
          xpState = await awardXp(db, watcherId, xpAwarded, now);

          // Credit account & transaction
          const creditAccount = await db.querySingle(
            "SELECT balance FROM credit_accounts WHERE user_id = ?",
            [watcherId],
          );
          const balanceAfter = (creditAccount?.balance as number ?? 0) + creditsAwarded;
          batchStatements.push({
            sql: `INSERT INTO credit_accounts (id, user_id, balance, created_at, updated_at)
                 VALUES (?, ?, 0, ?, ?)
                 ON CONFLICT(user_id) DO NOTHING`,
            params: [db.uuid(), watcherId, now, now],
          });
          batchStatements.push({
            sql: "UPDATE credit_accounts SET balance = balance + ?, updated_at = ? WHERE user_id = ?",
            params: [creditsAwarded, now, watcherId],
          });
          batchStatements.push({
            sql: `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, created_at)
                 VALUES (?, ?, 'earned', ?, ?, 'watch_claim', ?)`,
            params: [db.uuid(), watcherId, creditsAwarded, balanceAfter, now],
          });

          batchStatements.push({
            sql: `INSERT INTO reputation_accounts (id, user_id, score, last_calculated, created_at, updated_at)
                 VALUES (?, ?, 100, ?, ?, ?)
                 ON CONFLICT(user_id) DO NOTHING`,
            params: [db.uuid(), watcherId, now, now, now],
          });

          // Watch reputation: score + watch minutes are applied only when the
          // watch component is newly paid, so a member who claims watch then
          // feedback in separate visits doesn't double-count watch minutes.
          batchStatements.push({
            sql: `UPDATE reputation_accounts
             SET score = MIN(100, score + ?),
                 watch_minutes = watch_minutes + ?,
                 updated_at = ?
           WHERE user_id = ?`,
            params: [
              watchNewlyPaid ? 1 : 0,
              watchNewlyPaid ? Math.round(effectiveWatchSeconds / 60) : 0,
              now,
              watcherId,
            ],
          });

          if (watchNewlyPaid) {
            batchStatements.push({
              sql: `INSERT INTO reputation_events (id, user_id, event_type, points_change, description, created_at)
                   VALUES (?, ?, 'watch_claim', 1, 'Verified watch claim completed', ?)`,
              params: [db.uuid(), watcherId, now],
            });
          }

          const batchResult = await db.batch(batchStatements);
          if (!batchResult) {
            throw new Error("Failed to process rewards transaction");
          }

          // Record the cumulative awarded amounts so retries don't double-pay
          await db.execute(
            "UPDATE watch_sessions SET xp_awarded = ?, credits_awarded = ?, updated_at = ? WHERE video_id = ? AND watcher_id = ?",
            [targetXp, targetCredits, now, videoId, watcherId],
          );

          // Daily quest progress, analytics and owner notification fire once,
          // when the watch component itself is first paid.
          if (watchNewlyPaid) {
            await progressQuest(env, watcherId, "watch_videos");
            await trackEvent(env, "watch_claimed", watcherId, "video", videoId);

            if (video.user_id && video.user_id !== watcherId) {
              await notifyUser(
                db,
                video.user_id,
                "WATCH_SESSION_CLAIMED",
                "Your video was watched",
                "Someone completed watching your video and earned rewards.",
              );
            }
          }
        }

        const finalXpState = xpState ?? (await getXpState(db, watcherId));

        return createResponse({
          status,
          claimable: watchDone && !attentionBlocked,
          attentionBlocked,
          xpAwarded,
          creditsAwarded,
          watchVerified: watchDone,
          subscribed: subDone,
          commented: commentDone,
          rewardBreakdown: {
            watch: rewards.watch,
            subscribe: rewards.subscribe,
            comment: rewards.comment,
          },
          subReason,
          level: finalXpState.level,
          totalXp: finalXpState.totalXp,
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
