import type { Env, RouteDefinition } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { Database } from "../lib/database";
import { recordAudit } from "../lib/audit";
import { notifyUserPush } from "../lib/push";
import { sendEmail } from "../lib/email";
import { z } from "zod";
import { sanitize } from "../lib/sanitize";

const supportSchema = z.object({
  topic: z.enum(["account", "credits", "community", "video", "moderation", "bug", "other"]),
  message: z.string().min(10).max(2000),
});

/**
 * Member support channel.
 *
 * The product had no way for a member to reach the team (lost top-up, missing
 * reward, account problem). Requests are stored, admins see them in the
 * console, admins are notified in-app/push, and — when configured — the
 * operator receives an email copy.
 */
export const supportRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/v1/support",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const parsed = supportSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            parsed.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const db = new Database(env);
        const now = db.now();
        const id = db.uuid();
        await db.execute(
          `INSERT INTO support_requests (id, user_id, topic, message, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'open', ?, ?)`,
          [id, userId, parsed.data.topic, sanitize(parsed.data.message), now, now],
        );

        const requester = await db.querySingle("SELECT email, display_name FROM users WHERE id = ?", [
          userId,
        ]);

        const admins = await db.query(
          "SELECT user_id FROM admin_users WHERE role IN ('super_admin', 'admin')",
        );
        for (const admin of admins.results as Array<{ user_id: string }>) {
          await db.execute(
            "INSERT INTO notifications (id, user_id, type, title, message, data, created_at) VALUES (?, ?, 'SUPPORT_REQUEST', 'Support request', ?, ?, ?)",
            [
              db.uuid(),
              admin.user_id,
              `New ${parsed.data.topic} support request from ${requester?.display_name ?? "a member"}`,
              JSON.stringify({ supportId: id }),
              now,
            ],
          );
          await notifyUserPush(
            env,
            admin.user_id,
            "Support request",
            `New ${parsed.data.topic} request from ${requester?.display_name ?? "a member"}`,
          );
        }

        if (requester?.email) {
          await sendEmail(env, {
            to: requester.email,
            subject: "We received your LoopSquad request",
            html: `<p>Hi ${requester.display_name ?? "there"},</p><p>We received your support request about <strong>${parsed.data.topic}</strong>. The team will get back to you here or by email.</p>`,
          });
        }

        return createResponse({ message: "Support request submitted", supportId: id }, 201);
      } catch (error: any) {
        if (error.message === "AUTH_REQUIRED" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to submit support request", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/admin/support",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAdmin(request, env);
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") ?? "open";
        if (!["open", "resolved"].includes(status)) {
          return createErrorResponse("VALIDATION_ERROR", "Invalid status", 400);
        }
        const db = new Database(env);
        const result = await db.query(
          `SELECT s.id, s.topic, s.message, s.status, s.created_at as createdAt,
                  s.resolved_at as resolvedAt,
                  u.display_name as userName, u.email as userEmail
           FROM support_requests s JOIN users u ON s.user_id = u.id
           WHERE s.status = ?
           ORDER BY s.created_at ASC`,
          [status],
        );
        return createResponse({ items: result.results });
      } catch (error: any) {
        if (error.message === "AUTH_REQUIRED" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch support requests", 500);
      }
    },
  },

  {
    method: "POST",
    pattern: "^\\/api\\/v1/admin/support/([^/]+)/resolve$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const adminId = await requireAdmin(request, env);
        const supportId = new URL(request.url).pathname.split("/")[5];
        if (!supportId) return createErrorResponse("VALIDATION_ERROR", "Support ID is required", 400);

        const db = new Database(env);
        const now = db.now();
        const claimed = await db.execute(
          "UPDATE support_requests SET status = 'resolved', resolved_at = ?, resolved_by = ?, updated_at = ? WHERE id = ? AND status = 'open'",
          [now, adminId, now, supportId],
        );
        if ((claimed.meta?.changes ?? 0) === 0) {
          return createErrorResponse("CONFLICT", "Request was already resolved", 409);
        }

        const req = await db.querySingle("SELECT user_id FROM support_requests WHERE id = ?", [
          supportId,
        ]);
        if (req?.user_id) {
          await db.execute(
            "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, 'SUPPORT_RESOLVED', 'Support request resolved', 'Your support request has been resolved. Reply by submitting a new request if you still need help.', ?)",
            [db.uuid(), req.user_id, now],
          );
          await notifyUserPush(
            env,
            req.user_id,
            "Support request resolved",
            "Your support request has been resolved.",
          );
        }

        await recordAudit(
          db,
          { actorId: adminId, action: "support.resolve", resourceType: "support_request", resourceId: supportId, request },
          env,
        );
        return createResponse({ message: "Support request resolved" });
      } catch (error: any) {
        if (error.message === "AUTH_REQUIRED" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to resolve support request", 500);
      }
    },
  },
];
