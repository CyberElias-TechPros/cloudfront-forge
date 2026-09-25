import type { Env, RouteDefinition } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth, requireModerator } from "../middleware/auth";
import { Database } from "../lib/database";
import { notifyUserPush } from "../lib/push";
import { notify } from "../lib/notify";
import { z } from "zod";
import { sanitize } from "../lib/sanitize";

const createReportSchema = z.object({
  reportedUserId: z.string().uuid().optional(),
  resourceType: z.enum(["video", "review", "comment", "user", "community"]),
  resourceId: z.string().min(1),
  reason: z.enum(["spam", "inappropriate", "harassment", "cheating", "misleading", "other"]),
  description: z.string().max(1000).optional(),
});

const appealSchema = z.object({
  reason: z.string().min(10).max(2000),
});

/** Apply a trust-score penalty on report (soft enforcement, capped at 0). */
async function applyTrustPenalty(db: Database, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    "INSERT INTO reputation_events (id, user_id, event_type, points_change, description, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [crypto.randomUUID(), userId, "report_filed", -10, "Report filed against this user", now],
  );
  const acct = await db.querySingle("SELECT score FROM reputation_accounts WHERE user_id = ?", [userId]);
  if (acct) {
    await db.execute(
      "UPDATE reputation_accounts SET score = MAX(0, score - 10), updated_at = ? WHERE user_id = ?",
      [now, userId],
    );
  } else {
    await db.execute(
      "INSERT INTO reputation_accounts (id, user_id, score, created_at, updated_at) VALUES (?, ?, 90, ?, ?)",
      [crypto.randomUUID(), userId, now, now],
    );
  }
}

const appealReviewSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  note: z.string().max(2000).optional(),
});

export const reportRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/v1/reports",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;
        const validation = createReportSchema.safeParse(body);

        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const { reportedUserId, resourceType, resourceId, reason, description } = validation.data;
        const db = new Database(env);
        const now = new Date().toISOString();

        // Prevent duplicate pending reports for the same resource
        const duplicate = await db.querySingle(
          "SELECT id FROM reports WHERE reporter_id = ? AND resource_type = ? AND resource_id = ? AND status = 'pending'",
          [userId, resourceType, resourceId],
        );
        if (duplicate) {
          return createErrorResponse("CONFLICT", "You already reported this item", 409);
        }

        const reportId = crypto.randomUUID();
        await db.execute(
          `INSERT INTO reports (id, reporter_id, reported_user_id, resource_type, resource_id, reason, description, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
          [reportId, userId, reportedUserId ?? null, resourceType, resourceId, reason, description ?? null, now, now],
        );

        // Apply trust penalty to the reported user if provided
        if (reportedUserId && reportedUserId !== userId) {
          await applyTrustPenalty(db, reportedUserId);
        }

        // Auto-pull video from rotation on 3+ distinct "misleading" reports
        if (resourceType === "video" && reason === "misleading") {
          const reportCount = await db.querySingle(
            `SELECT COUNT(DISTINCT reporter_id) as cnt FROM reports
             WHERE resource_type = 'video' AND resource_id = ? AND reason = 'misleading'`,
            [resourceId],
          );
          if ((reportCount?.cnt ?? 0) >= 3) {
            await db.execute(
              "UPDATE videos SET status = 'removed', updated_at = ? WHERE id = ? AND status = 'active'",
              [now, resourceId],
            );
          }
        }

        // Notify admins
        const admins = await db.query("SELECT user_id FROM admin_users WHERE role IN ('super_admin', 'admin')");
        for (const admin of admins.results) {
          const adminId = (admin as any).user_id;
          await db.execute(
            "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, 'REPORT_FILED', 'Report Filed', ?, ?)",
            [crypto.randomUUID(), adminId, `New ${reason} report on ${resourceType}`, now],
          );
          await notifyUserPush(env, adminId, "Report Filed", `New ${reason} report on ${resourceType}`);
        }

        return createResponse({ message: "Report submitted", reportId }, 201);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to submit report", 500);
      }
    },
  },

  // Reports filed against the caller — needed so members can appeal them.
  {
    method: "GET",
    path: "/api/v1/reports/mine",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const result = await db.query(
          `SELECT r.id, r.reason, r.resource_type, r.resource_id, r.status, r.created_at,
                  r.resolution_notes,
                  EXISTS (SELECT 1 FROM appeals a WHERE a.report_id = r.id AND a.user_id = ?) AS appealed
           FROM reports r
           WHERE r.reported_user_id = ?
           ORDER BY r.created_at DESC
           LIMIT 20`,
          [userId, userId],
        );
        return createResponse({ items: result.results });
      } catch (error: any) {
        if (error.message === "AUTH_REQUIRED" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch your reports", 500);
      }
    },
  },

  // Submit appeal for a report you were named in
  {
    method: "POST",
    pattern: "^\\/api\\/v1/reports/([^/]+)/appeal$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const reportId = new URL(request.url).pathname.split("/")[4] ?? "";
        const body = (await request.json().catch(() => ({}))) as { reason?: string };
        const validation = appealSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }
        const db = new Database(env);
        const now = new Date().toISOString();

        const report = await db.querySingle(
          "SELECT id, reported_user_id, status FROM reports WHERE id = ?",
          [reportId],
        );
        const r = report as Record<string, unknown> | null;
        if (!r) return createErrorResponse("NOT_FOUND", "Report not found", 404);
        if (r.reported_user_id !== userId) {
          return createErrorResponse("FORBIDDEN", "You can only appeal reports filed against you", 403);
        }
        if (r.status === "dismissed") {
          return createErrorResponse("BAD_REQUEST", "This report has already been dismissed", 400);
        }

        const existing = await db.querySingle(
          "SELECT id FROM appeals WHERE report_id = ? AND user_id = ?",
          [reportId, userId],
        );
        if (existing) {
          return createErrorResponse("CONFLICT", "Appeal already submitted for this report", 409);
        }

        await db.execute(
          "INSERT INTO appeals (id, report_id, user_id, reason, created_at) VALUES (?, ?, ?, ?, ?)",
          [crypto.randomUUID(), reportId, userId, validation.data.reason, now],
        );

        // Notify admins
        const admins = await db.query(
          "SELECT user_id FROM admin_users WHERE role IN ('super_admin', 'admin')",
        );
        for (const admin of admins.results) {
          const adminId = (admin as any).user_id as string;
          await db.execute(
            "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, 'APPEAL_FILED', 'Report Appeal', ?, ?)",
            [crypto.randomUUID(), adminId, `User filed an appeal on report ${reportId}`, now],
          );
          await notifyUserPush(env, adminId, "Report Appeal", `User filed an appeal on report ${reportId}`);
        }

        return createResponse({ message: "Appeal submitted" }, 201);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to submit appeal", 500);
      }
    },
  },

  // Admin: review an appeal
  {
    method: "POST",
    pattern: "^\\/api\\/v1/admin/appeals/([^/]+)$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        // Single source of truth for admin checks: the hand-rolled role check
        // here drifted from `requireAdmin` (moderators were rejected in one
        // place and accepted in another). Appeal review is part of the
        // `moderate` permission, so the moderator tier is allowed too.
        const adminId = await requireModerator(request, env);
        const db = new Database(env);

        const appealId = new URL(request.url).pathname.split("/")[5] ?? "";
        const parsed = appealReviewSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            parsed.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const appeal = await db.querySingle(
          "SELECT id, report_id, user_id FROM appeals WHERE id = ?",
          [appealId],
        );
        if (!appeal) return createErrorResponse("NOT_FOUND", "Appeal not found", 404);

        // Status-locked update: an appeal can only be reviewed once.
        const now = new Date().toISOString();
        const claimed = await db.execute(
          "UPDATE appeals SET status = ?, reviewed_by = ?, reviewed_at = ?, note = ? WHERE id = ? AND status = 'pending'",
          [
            parsed.data.status,
            adminId,
            now,
            parsed.data.note ? sanitize(parsed.data.note) : null,
            appealId,
          ],
        );
        if ((claimed.meta?.changes ?? 0) === 0) {
          return createErrorResponse("CONFLICT", "Appeal was already reviewed", 409);
        }

        // Accepting an appeal must make the member whole: dismiss the report,
        // restore the trust-score penalty the report applied, and put an
        // auto-removed video back into rotation.
        if (parsed.data.status === "accepted") {
          const report = await db.querySingle(
            "SELECT id, reported_user_id, resource_type, resource_id FROM reports WHERE id = ?",
            [(appeal as any).report_id],
          );

          await db.execute("UPDATE reports SET status = 'dismissed', updated_at = ? WHERE id = ?", [
            now,
            (appeal as any).report_id,
          ]);

          if (report?.reported_user_id) {
            const acct = await db.querySingle(
              "SELECT score FROM reputation_accounts WHERE user_id = ?",
              [report.reported_user_id],
            );
            if (acct) {
              await db.execute(
                "INSERT INTO reputation_events (id, user_id, event_type, points_change, description, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                [crypto.randomUUID(), report.reported_user_id, "appeal_accepted", 10, "Appeal accepted — penalty restored", now],
              );
              await db.execute(
                "UPDATE reputation_accounts SET score = MIN(100, score + 10), updated_at = ? WHERE user_id = ?",
                [now, report.reported_user_id],
              );
            }
          }

          if (report?.resource_type === "video" && report.resource_id) {
            await db.execute(
              "UPDATE videos SET status = 'active', updated_at = ? WHERE id = ? AND status = 'removed'",
              [now, report.resource_id],
            );
          }

          await notify(env, (appeal as any).user_id, {
            type: "APPEAL_ACCEPTED",
            title: "Appeal accepted",
            message: "Your appeal was accepted. Any penalty from the report has been reversed.",
            category: "moderation",
            url: "/profile",
          });
        } else {
          await notify(env, (appeal as any).user_id, {
            type: "APPEAL_REJECTED",
            title: "Appeal declined",
            message: parsed.data.note
              ? `Your appeal was declined: ${sanitize(parsed.data.note)}`
              : "Your appeal was declined",
            category: "moderation",
            url: "/profile",
          });
        }

        return createResponse({ message: `Appeal ${parsed.data.status}` });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to review appeal", 500);
      }
    },
  },
];
