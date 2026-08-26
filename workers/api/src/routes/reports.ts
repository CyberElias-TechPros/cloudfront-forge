import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { notifyUserPush } from "../lib/push";
import { z } from "zod";

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

export const reportRoutes = [
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
          `INSERT INTO appeals (id, report_id, user_id, reason, created_at) VALUES (?, ?, ?, ?, ?)`,
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
        const adminId = await requireAuth(request, env);
        const db = new Database(env);

        // Verify admin role
        const admin = await db.querySingle(
          "SELECT role FROM admin_users WHERE user_id = ?",
          [adminId],
        );
        const adminRole = (admin as { role?: string })?.role;
        if (adminRole !== "super_admin" && adminRole !== "admin") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }

        const appealId = new URL(request.url).pathname.split("/")[5] ?? "";
        const body = (await request.json().catch(() => ({}))) as { status?: string; note?: string };
        if (!body.status || !["accepted", "rejected"].includes(body.status)) {
          return createErrorResponse("VALIDATION_ERROR", "status must be 'accepted' or 'rejected'", 400);
        }

        const appeal = await db.querySingle("SELECT id, report_id FROM appeals WHERE id = ?", [appealId]);
        if (!appeal) return createErrorResponse("NOT_FOUND", "Appeal not found", 404);

        const now = new Date().toISOString();
        await db.execute(
          "UPDATE appeals SET status = ?, reviewed_by = ?, reviewed_at = ?, note = ? WHERE id = ?",
          [body.status, adminId, now, body.note ?? null, appealId],
        );

        // If accepted, dismiss the original report
        if (body.status === "accepted") {
          await db.execute("UPDATE reports SET status = 'dismissed', updated_at = ? WHERE id = ?", [
            now,
            (appeal as any).report_id,
          ]);
        }

        return createResponse({ message: `Appeal ${body.status}` });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to review appeal", 500);
      }
    },
  },
];
