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

        await db.execute(
          `INSERT INTO reports (id, reporter_id, reported_user_id, resource_type, resource_id, reason, description, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
          [crypto.randomUUID(), userId, reportedUserId ?? null, resourceType, resourceId, reason, description ?? null, now, now],
        );

        // Apply trust penalty to the reported user if provided
        if (reportedUserId && reportedUserId !== userId) {
          await applyTrustPenalty(db, reportedUserId);
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

        return createResponse({ message: "Report submitted" }, 201);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to submit report", 500);
      }
    },
  },
];
