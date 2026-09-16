import type { Env, RouteDefinition } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAdmin } from "../middleware/auth";
import { Database } from "../lib/database";
import { recordAudit } from "../lib/audit";
import { z } from "zod";

const suspendSchema = z.object({
  reason: z.string().max(500).optional(),
});

const roleChangeSchema = z.object({
  role: z.enum(["moderator", "admin"]).nullable(),
});

function adminCatch(error: any, what: string): Response {
  if (error.message === "AUTH_REQUIRED" || error.message === "AUTH_TOKEN_INVALID") {
    return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
  }
  if (error.message === "FORBIDDEN") {
    return createErrorResponse("FORBIDDEN", "Admin access required", 403);
  }
  return createErrorResponse("INTERNAL_ERROR", what, 500);
}

export const adminRoutes: RouteDefinition[] = [
  // Analytics funnel: submit → watch → claim conversion rates
  {
    method: "GET",
    path: "/api/v1/admin/analytics",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAdmin(request, env);
        const { searchParams } = new URL(request.url);
        const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") ?? "30", 10)));
        const db = new Database(env);
        const since = new Date(Date.now() - days * 86_400_000).toISOString();

        const counts = await db.query(
          `SELECT event_type, COUNT(*) as count FROM analytics_events
           WHERE created_at > ? GROUP BY event_type ORDER BY count DESC`,
          [since],
        );

        const submits = counts.results.find((r: any) => r.event_type === "video_submitted")?.count ?? 0;
        const claims = counts.results.find((r: any) => r.event_type === "watch_claimed")?.count ?? 0;
        const reviews = counts.results.find((r: any) => r.event_type === "review_completed")?.count ?? 0;

        const dailyTrend = await db.query(
          `SELECT date(created_at) as day, event_type, COUNT(*) as count
           FROM analytics_events WHERE created_at > ?
           GROUP BY day, event_type ORDER BY day DESC`,
          [since],
        );

        return createResponse({
          period: `last ${days} days`,
          totals: {
            submits,
            claims,
            reviews,
            claimRate: submits > 0 ? Math.round((claims / submits) * 100) : 0,
          },
          events: counts.results,
          dailyTrend: dailyTrend.results,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch analytics", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/admin/users",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAdmin(request, env);
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") ?? "active";
        const limit = parseInt(searchParams.get("limit") ?? "50", 10);
        const offset = parseInt(searchParams.get("offset") ?? "0", 10);

        const db = new Database(env);
        // status=active (default) / suspended / deleted
        const where =
          status === "deleted"
            ? "u.deleted_at IS NOT NULL"
            : status === "suspended"
              ? "u.deleted_at IS NULL AND u.status = 'suspended'"
              : "u.deleted_at IS NULL AND COALESCE(u.status, 'active') = 'active'";
        const result = await db.query(
          `SELECT u.*, COALESCE(r.score, 100) as trust_score, au.role as platform_role
           FROM users u
           LEFT JOIN reputation_accounts r ON u.id = r.user_id
           LEFT JOIN admin_users au ON au.user_id = u.id
           WHERE ${where}
           ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
          [limit, offset],
        );

        const users = result.results.map((u: any) => ({
          id: u.id,
          firebaseUid: u.firebase_uid,
          email: u.email,
          emailVerified: Boolean(u.email_verified),
          displayName: u.display_name,
          photoUrl: u.photo_url,
          createdAt: u.created_at,
          updatedAt: u.updated_at,
          deletedAt: u.deleted_at,
          lastActive: u.last_active,
          trustScore: u.trust_score ?? 100,
          status: u.status ?? "active",
          platformRole: u.platform_role ?? null,
        }));

        return createResponse(users);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch users", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/admin/communities",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAdmin(request, env);
        const db = new Database(env);

        const result = await db.query(
          `SELECT c.*, u.display_name as owner_name 
           FROM communities c 
           LEFT JOIN users u ON c.owner_id = u.id 
           WHERE c.created_at >= datetime('now', '-30 days')
           ORDER BY c.created_at DESC`,
        );

        return createResponse(result.results);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch communities", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/admin/reports",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAdmin(request, env);
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") ?? "pending";

        const db = new Database(env);
        const result = await db.query(
          `SELECT r.*, 
             u1.display_name as reporter_name,
             u2.display_name as reported_user_name
           FROM reports r
           LEFT JOIN users u1 ON r.reporter_id = u1.id
           LEFT JOIN users u2 ON r.reported_user_id = u2.id
           WHERE r.status = ?
           ORDER BY r.created_at DESC
           LIMIT 50`,
          [status],
        );

        return createResponse(result.results);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch reports", 500);
      }
    },
  },

  {
    method: "POST",
    pattern: "^\\/api\\/v1/admin/reports/([^/]+)/resolve$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const adminId = await requireAdmin(request, env);
        const url = new URL(request.url);
        const reportId = url.pathname.split("/")[5];
        const body = await request.json().catch(() => ({}));
        const status = (body as Record<string, unknown>).status as string | undefined;
        const resolutionNotes = (body as Record<string, unknown>).resolutionNotes as
          string | undefined;

        if (!status || !["resolved", "dismissed"].includes(status)) {
          return createErrorResponse("VALIDATION_ERROR", "Invalid status", 400);
        }

        const db = new Database(env);
        const now = new Date().toISOString();

        await db.execute(
          "UPDATE reports SET status = ?, resolved_by = ?, resolution_notes = ?, updated_at = ? WHERE id = ?",
          [status, adminId, resolutionNotes ?? null, now, reportId],
        );

        return createResponse({ message: "Report resolved" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to resolve report", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/admin/metrics",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAdmin(request, env);
        const db = new Database(env);

        const usersCount = await db.querySingle(
          "SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL",
        );
        const communitiesCount = await db.querySingle("SELECT COUNT(*) as count FROM communities");
        const videosCount = await db.querySingle(
          "SELECT COUNT(*) as count FROM videos WHERE status = 'active'",
        );
        const reviewsCount = await db.querySingle(
          "SELECT COUNT(*) as count FROM reviews WHERE status = 'completed'",
        );
        const pendingReports = await db.querySingle(
          "SELECT COUNT(*) as count FROM reports WHERE status = 'pending'",
        );

        return createResponse({
          users: usersCount?.count ?? 0,
          communities: communitiesCount?.count ?? 0,
          videos: videosCount?.count ?? 0,
          reviews: reviewsCount?.count ?? 0,
          pendingReports: pendingReports?.count ?? 0,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch metrics", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/admin/retention",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAdmin(request, env);
        const database = new Database(env);

        // Cohort retention: % of users active in week 1 and week 4 after signup
        const cohorts = await database.query(
          `SELECT
             DATE(u.created_at) as cohort_date,
             COUNT(DISTINCT u.id) as total_users,
             COUNT(DISTINCT CASE WHEN ws.watcher_id IS NOT NULL THEN u.id END) as week1_active,
             COUNT(DISTINCT CASE WHEN ws4.watcher_id IS NOT NULL THEN u.id END) as week4_active
           FROM users u
           LEFT JOIN watch_sessions ws
             ON ws.watcher_id = u.id
             AND ws.verified_at >= u.created_at
             AND ws.verified_at < datetime(u.created_at, '+7 days')
           LEFT JOIN watch_sessions ws4
             ON ws4.watcher_id = u.id
             AND ws4.verified_at >= datetime(u.created_at, '+7 days')
             AND ws4.verified_at < datetime(u.created_at, '+28 days')
           WHERE u.deleted_at IS NULL
             AND u.created_at < datetime('now', '-28 days')
           GROUP BY DATE(u.created_at)
           ORDER BY cohort_date DESC
           LIMIT 30`,
          [],
        );

        return createResponse({
          cohorts: (cohorts.results ?? []).map((c: any) => ({
            date: c.cohort_date,
            total: c.total_users,
            week1Retention: c.total_users > 0 ? Math.round((c.week1_active / c.total_users) * 100) : 0,
            week4Retention: c.total_users > 0 ? Math.round((c.week4_active / c.total_users) * 100) : 0,
          })),
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch retention", 500);
      }
    },
  },

  // Appeals queue for the admin console.
  {
    method: "GET",
    path: "/api/v1/admin/appeals",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAdmin(request, env);
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") ?? "pending";
        if (!["pending", "accepted", "rejected"].includes(status)) {
          return createErrorResponse("VALIDATION_ERROR", "Invalid status", 400);
        }
        const db = new Database(env);
        const result = await db.query(
          `SELECT a.id, a.reason, a.status, a.created_at as createdAt, a.reviewed_at as reviewedAt, a.note,
                  r.id as reportId, r.reason as reportReason, r.resource_type as resourceType,
                  r.resource_id as resourceId, r.status as reportStatus,
                  reported.display_name as reportedName, reporter.display_name as reporterName
           FROM appeals a
           JOIN reports r ON a.report_id = r.id
           LEFT JOIN users reported ON r.reported_user_id = reported.id
           LEFT JOIN users reporter ON r.reporter_id = reporter.id
           WHERE a.status = ?
           ORDER BY a.created_at ASC`,
          [status],
        );
        return createResponse({ items: result.results });
      } catch (error: any) {
        return adminCatch(error, "Failed to fetch appeals");
      }
    },
  },

  // Suspend a member: they keep their data but lose access until reinstated.
  {
    method: "POST",
    pattern: "^\\/api\\/v1/admin/users/([^/]+)/suspend$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const adminId = await requireAdmin(request, env);
        const targetId = new URL(request.url).pathname.split("/")[4];
        if (!targetId) return createErrorResponse("VALIDATION_ERROR", "User ID is required", 400);

        const parsed = suspendSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            parsed.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const db = new Database(env);
        if (targetId === adminId) {
          return createErrorResponse("BAD_REQUEST", "You cannot suspend yourself", 400);
        }
        const target = await db.querySingle("SELECT id, status, deleted_at FROM users WHERE id = ?", [
          targetId,
        ]);
        if (!target || target.deleted_at) {
          return createErrorResponse("NOT_FOUND", "User not found", 404);
        }
        const targetRole = await db.querySingle("SELECT role FROM admin_users WHERE user_id = ?", [
          targetId,
        ]);
        if (targetRole?.role === "super_admin") {
          return createErrorResponse("FORBIDDEN", "Super admins cannot be suspended", 403);
        }

        const now = db.now();
        const result = await db.execute(
          "UPDATE users SET status = 'suspended', updated_at = ? WHERE id = ? AND deleted_at IS NULL",
          [now, targetId],
        );
        if ((result.meta?.changes ?? 0) === 0) {
          return createErrorResponse("CONFLICT", "User can no longer be suspended", 409);
        }

        await db.execute(
          "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, 'ACCOUNT_SUSPENDED', 'Account suspended', ?, ?)",
          [
            db.uuid(),
            targetId,
            parsed.data.reason
              ? `Your account was suspended: ${parsed.data.reason}`
              : "Your account was suspended by a moderator",
            now,
          ],
        );
        await recordAudit(
          db,
          {
            actorId: adminId,
            action: "user.suspend",
            resourceType: "user",
            resourceId: targetId,
            metadata: parsed.data.reason ? { reason: parsed.data.reason } : null,
            request,
          },
          env,
        );
        return createResponse({ message: "User suspended" });
      } catch (error: any) {
        return adminCatch(error, "Failed to suspend user");
      }
    },
  },

  // Reinstate a suspended member.
  {
    method: "POST",
    pattern: "^\\/api\\/v1/admin/users/([^/]+)/reinstate$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const adminId = await requireAdmin(request, env);
        const targetId = new URL(request.url).pathname.split("/")[4];
        if (!targetId) return createErrorResponse("VALIDATION_ERROR", "User ID is required", 400);

        const db = new Database(env);
        const now = db.now();
        const result = await db.execute(
          "UPDATE users SET status = 'active', updated_at = ? WHERE id = ? AND status = 'suspended' AND deleted_at IS NULL",
          [now, targetId],
        );
        if ((result.meta?.changes ?? 0) === 0) {
          return createErrorResponse("CONFLICT", "User is not suspended", 409);
        }

        await db.execute(
          "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, 'ACCOUNT_REINSTATED', 'Account reinstated', 'Your account has been reinstated. Welcome back.', ?)",
          [db.uuid(), targetId, now],
        );
        await recordAudit(
          db,
          { actorId: adminId, action: "user.reinstate", resourceType: "user", resourceId: targetId, request },
          env,
        );
        return createResponse({ message: "User reinstated" });
      } catch (error: any) {
        return adminCatch(error, "Failed to reinstate user");
      }
    },
  },

  // Grant or revoke platform roles (moderator/admin). Super admins are managed
  // out-of-band and cannot be changed through the API.
  {
    method: "POST",
    pattern: "^\\/api\\/v1/admin/users/([^/]+)/role$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const adminId = await requireAdmin(request, env);
        const targetId = new URL(request.url).pathname.split("/")[4];
        if (!targetId) return createErrorResponse("VALIDATION_ERROR", "User ID is required", 400);

        const parsed = roleChangeSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            parsed.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const db = new Database(env);
        if (targetId === adminId) {
          return createErrorResponse("BAD_REQUEST", "You cannot change your own role", 400);
        }
        const target = await db.querySingle(
          "SELECT id FROM users WHERE id = ? AND deleted_at IS NULL",
          [targetId],
        );
        if (!target) return createErrorResponse("NOT_FOUND", "User not found", 404);

        const actorRole = await db.querySingle("SELECT role FROM admin_users WHERE user_id = ?", [
          adminId,
        ]);
        const targetRole = await db.querySingle("SELECT role FROM admin_users WHERE user_id = ?", [
          targetId,
        ]);

        if (targetRole?.role === "super_admin") {
          return createErrorResponse("FORBIDDEN", "Super admin roles cannot be changed", 403);
        }
        // Only super admins may manage the admin tier itself.
        const touchesAdminTier = parsed.data.role === "admin" || targetRole?.role === "admin";
        if (touchesAdminTier && actorRole?.role !== "super_admin") {
          return createErrorResponse("FORBIDDEN", "Only super admins can manage admin roles", 403);
        }

        const now = db.now();
        if (parsed.data.role === null) {
          await db.execute("DELETE FROM admin_users WHERE user_id = ? AND role != 'super_admin'", [
            targetId,
          ]);
        } else {
          await db.execute(
            `INSERT INTO admin_users (id, user_id, role, created_at) VALUES (?, ?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET role = excluded.role`,
            [db.uuid(), targetId, parsed.data.role, now],
          );
        }

        await recordAudit(
          db,
          {
            actorId: adminId,
            action: "user.role",
            resourceType: "user",
            resourceId: targetId,
            metadata: { role: parsed.data.role },
            request,
          },
          env,
        );
        return createResponse({
          message: parsed.data.role ? `Role set to ${parsed.data.role}` : "Platform role removed",
        });
      } catch (error: any) {
        return adminCatch(error, "Failed to update role");
      }
    },
  },

  // Restore a removed/archived video (used after successful moderation appeals).
  {
    method: "POST",
    pattern: "^\\/api\\/v1/admin/videos/([^/]+)/restore$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const adminId = await requireAdmin(request, env);
        const videoId = new URL(request.url).pathname.split("/")[4];
        if (!videoId) return createErrorResponse("VALIDATION_ERROR", "Video ID is required", 400);

        const db = new Database(env);
        const video = await db.querySingle("SELECT id, status FROM videos WHERE id = ?", [videoId]);
        if (!video) return createErrorResponse("NOT_FOUND", "Video not found", 404);
        if (video.status === "active") {
          return createErrorResponse("CONFLICT", "Video is already active", 409);
        }

        const now = db.now();
        await db.execute(
          "UPDATE videos SET status = 'active', updated_at = ? WHERE id = ? AND status IN ('removed', 'archived')",
          [now, videoId],
        );
        await recordAudit(
          db,
          {
            actorId: adminId,
            action: "video.restore",
            resourceType: "video",
            resourceId: videoId,
            metadata: { previousStatus: video.status },
            request,
          },
          env,
        );
        return createResponse({ message: "Video restored to the queue" });
      } catch (error: any) {
        return adminCatch(error, "Failed to restore video");
      }
    },
  },
];
