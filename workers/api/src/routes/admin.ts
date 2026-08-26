import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAdmin } from "../middleware/auth";
import { Database } from "../lib/database";

export const adminRoutes = [
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
        const result = await db.query(
          `SELECT u.*, COALESCE(r.score, 100) as trust_score
           FROM users u
           LEFT JOIN reputation_accounts r ON u.id = r.user_id
           WHERE ${status === "deleted" ? "u.deleted_at IS NOT NULL" : "u.deleted_at IS NULL"}
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
];
