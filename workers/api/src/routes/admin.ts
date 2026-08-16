import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { Database } from "../lib/database";
import { z } from "zod";

const createReportSchema = z.object({
  reportedUserId: z.string().uuid(),
  resourceType: z.enum(["video", "review", "comment", "user", "community"]),
  resourceId: z.string().uuid().optional(),
  reason: z.enum(["spam", "inappropriate", "harassment", "cheating", "misleading", "other"]),
  description: z.string().max(500),
});

export const adminRoutes = [
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
           WHERE u.deleted_at IS NULL AND u.email_verified = ?
           ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
          [status === "active", limit, offset],
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
    method: "POST",
    path: "/api/v1/admin/reports",
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

        const db = new Database(env);
        const now = new Date().toISOString();

        await db.execute(
          `INSERT INTO reports (id, reporter_id, reported_user_id, resource_type, resource_id, reason, description, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            userId,
            body.reportedUserId,
            body.resourceType,
            body.resourceId ?? null,
            body.reason,
            body.description,
            "pending",
            now,
          ],
        );

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
