import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { z } from "zod";

const REQUIRED_WATCH_SEC = 180;
const REWARD_XP = 30;
const REWARD_CREDITS = 10;

function levelForXp(totalXp: number): number {
  return Math.max(1, Math.floor(totalXp / 250) + 1);
}

async function ensureReputation(db: Database, userId: string, now: string): Promise<void> {
  const existing = await db.querySingle(
    "SELECT id FROM reputation_accounts WHERE user_id = ?",
    [userId],
  );
  if (!existing) {
    await db.execute(
      `INSERT INTO reputation_accounts (id, user_id, score, last_calculated, created_at, updated_at)
       VALUES (?, ?, 100, ?, ?, ?)`,
      [db.uuid(), userId, now, now, now],
    );
  }
}

const watchSchema = z.object({
  videoId: z.string().min(1),
  watchSeconds: z.number().min(0).max(86400),
  subscribed: z.boolean().default(false),
  commented: z.boolean().default(false),
});

export const watchRoutes = [
  {
    method: "POST",
    path: "/api/v1/watch",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const watcherId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;

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

        const video = await db.querySingle("SELECT id, user_id FROM videos WHERE id = ?", [
          videoId,
        ]);
        if (!video) {
          return createErrorResponse("NOT_FOUND", "Video not found", 404);
        }

        const existing = await db.querySingle(
          "SELECT * FROM watch_sessions WHERE video_id = ? AND watcher_id = ?",
          [videoId, watcherId],
        );

        const now = new Date().toISOString();
        const claimable = watchSeconds >= REQUIRED_WATCH_SEC && subscribed && commented;

        if (existing) {
          await db.execute(
            `UPDATE watch_sessions SET watch_seconds = ?, subscribed = ?, commented = ?,
             status = ?, verified_at = ?, updated_at = ? WHERE id = ?`,
            [
              watchSeconds,
              subscribed ? 1 : 0,
              commented ? 1 : 0,
              claimable ? "claimed" : watchSeconds >= REQUIRED_WATCH_SEC ? "verified" : "started",
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
              claimable ? "claimed" : watchSeconds >= REQUIRED_WATCH_SEC ? "verified" : "started",
              subscribed ? 1 : 0,
              commented ? 1 : 0,
              claimable ? now : null,
              now,
              now,
            ],
          );
        }

        // Award once: only when newly claimable and not already claimed.
        let xpAwarded = 0;
        let creditsAwarded = 0;
        const alreadyClaimed = existing?.status === "claimed";

        if (claimable && !alreadyClaimed) {
          xpAwarded = REWARD_XP;
          creditsAwarded = REWARD_CREDITS;

          const xp = await db.querySingle("SELECT * FROM xp_accounts WHERE user_id = ?", [
            watcherId,
          ]);
          if (xp) {
            const totalXp = (xp.total_xp ?? 0) + xpAwarded;
            await db.execute(
              "UPDATE xp_accounts SET total_xp = ?, level = ?, updated_at = ? WHERE user_id = ?",
              [totalXp, levelForXp(totalXp), now, watcherId],
            );
          } else {
            await db.execute(
              `INSERT INTO xp_accounts (id, user_id, total_xp, level, xp_to_next_level, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [db.uuid(), watcherId, xpAwarded, levelForXp(xpAwarded), 250, now, now],
            );
          }

          await ensureReputation(db, watcherId, now);
          await db.execute(
            `UPDATE reputation_accounts
             SET score = MIN(100, score + 1),
                 watch_minutes = watch_minutes + ?,
                 subscriptions_given = subscriptions_given + ?,
                 updated_at = ?
             WHERE user_id = ?`,
            [Math.round(watchSeconds / 60), subscribed ? 1 : 0, now, watcherId],
          );

          // Credit the submitter with a received subscription + watch.
          if (video.user_id && video.user_id !== watcherId) {
            await ensureReputation(db, video.user_id, now);
            await db.execute(
              `UPDATE reputation_accounts
               SET score = MIN(100, score + 1),
                   subscriptions_received = subscriptions_received + ?,
                   updated_at = ?
               WHERE user_id = ?`,
              [subscribed ? 1 : 0, now, video.user_id],
            );
          }
        }

        return createResponse({
          status: claimable ? "claimed" : watchSeconds >= REQUIRED_WATCH_SEC ? "verified" : "started",
          claimable,
          xpAwarded,
          creditsAwarded,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        console.error("Watch submit error:", error);
        return createErrorResponse("INTERNAL_ERROR", "Failed to record watch", 500);
      }
    },
  },
];
