import type { Env, RouteDefinition } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { recordAudit } from "../lib/audit";

/**
 * Account deletion (right to be forgotten).
 *
 * The delete is soft so ledgers, audit trails and moderation history remain
 * intact, but the account is closed everywhere it matters:
 *
 * - `users.deleted_at` is set; the entry-point gate then rejects every request
 *   from this Firebase uid with `ACCOUNT_DELETED` (and `requireAuth` never
 *   resurrects the row).
 * - Community memberships become `left`.
 * - Active videos are archived so they leave the queue and rotation.
 * - Open review assignments are skipped and the submitter is informed.
 * - Pending join requests are cancelled, pending top-ups rejected.
 * - Push subscriptions are removed so no further notifications are sent.
 */
export const accountRoutes: RouteDefinition[] = [
  {
    method: "DELETE",
    path: "/api/v1/users/me",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const now = db.now();

        const user = await db.querySingle("SELECT id, email FROM users WHERE id = ?", [userId]);
        if (!user) {
          return createErrorResponse("NOT_FOUND", "Account not found", 404);
        }

        // Inform submitters about reviews this member will no longer complete.
        const openReviews = await db.query(
          "SELECT id, submitter_id FROM reviews WHERE reviewer_id = ? AND status IN ('assigned', 'in_progress')",
          [userId],
        );

        await db.batch([
          {
            sql: "UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ?",
            params: [now, now, userId],
          },
          {
            sql: "UPDATE community_members SET status = 'left' WHERE user_id = ? AND status = 'active'",
            params: [userId],
          },
          {
            sql: "UPDATE videos SET status = 'archived', updated_at = ? WHERE user_id = ? AND status IN ('active', 'pending')",
            params: [now, userId],
          },
          {
            sql: "UPDATE reviews SET status = 'skipped', updated_at = ? WHERE reviewer_id = ? AND status IN ('assigned', 'in_progress')",
            params: [now, userId],
          },
          {
            sql: "UPDATE mission_assignments SET status = 'skipped' WHERE user_id = ? AND status IN ('assigned', 'in_progress')",
            params: [userId],
          },
          {
            sql: "UPDATE join_requests SET status = 'cancelled', updated_at = ? WHERE user_id = ? AND status = 'pending'",
            params: [now, userId],
          },
          {
            sql: "UPDATE topup_requests SET status = 'rejected', reject_reason = 'Account deleted', reviewed_at = ?, reviewed_by = ?, updated_at = ? WHERE status = 'pending'",
            params: [now, userId, now],
          },
          {
            sql: "DELETE FROM push_subscriptions WHERE user_id = ?",
            params: [userId],
          },
          {
            sql: "UPDATE watch_sessions SET status = 'expired', updated_at = ? WHERE watcher_id = ? AND status = 'started'",
            params: [now, userId],
          },
        ]);

        for (const review of openReviews.results as Array<{ id: string; submitter_id: string }>) {
          if (!review.submitter_id || review.submitter_id === userId) continue;
          await db.execute(
            "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, 'REVIEW_UNAVAILABLE', 'Review unavailable', ?, ?)",
            [
              db.uuid(),
              review.submitter_id,
              "A reviewer assigned to your video is no longer available; a new reviewer will be assigned.",
              now,
            ],
          );
        }

        await recordAudit(
          db,
          {
            actorId: userId,
            action: "account.delete",
            resourceType: "user",
            resourceId: userId,
            metadata: { softDelete: true },
            request,
          },
          env,
        );

        return createResponse({ message: "Account deleted" });
      } catch (error: any) {
        if (error.message === "AUTH_REQUIRED" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to delete account", 500);
      }
    },
  },
];
