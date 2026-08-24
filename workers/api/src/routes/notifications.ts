import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { sanitize } from "../lib/sanitize";
import { z } from "zod";
import { createLogger } from "../lib/logger";
import { notifyUserPush } from "../lib/push";

function getPagination(request: Request): { limit: number; offset: number } {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  return { limit, offset };
}

const createNotificationSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  data: z.record(z.any()).optional(),
});

const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  missionReminders: z.boolean().optional(),
  reviewRequests: z.boolean().optional(),
  communityUpdates: z.boolean().optional(),
});

export const notificationRoutes = [
  {
    method: "GET",
    path: "/api/v1/notifications",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const { searchParams } = new URL(request.url);
        const isRead = searchParams.get("isRead");
        const { limit, offset } = getPagination(request);

        const db = new Database(env);

        const countQuery = `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? ${isRead === "false" ? "AND is_read = 0" : ""}`;
        const countResult = await db.query(countQuery, [userId]);

        let result;
        if (isRead === "false") {
          result = await db.query(
            "SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?",
            [userId, limit, offset],
          );
        } else {
          result = await db.query(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
            [userId, limit, offset],
          );
        }

        return createResponse({
          items: result.results,
          total: countResult.results[0]?.count ?? 0,
          limit,
          offset,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch notifications", 500);
      }
    },
  },

  {
    method: "POST",
    path: "/api/v1/notifications",
    handler: async (request: Request, env: Env): Promise<Response> => {
      const logger = createLogger(env);
      try {
        const userId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;

        const validation = createNotificationSchema.safeParse(body);
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
          `INSERT INTO notifications (id, user_id, type, title, message, data, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            userId,
            sanitize(body.type),
            sanitize(body.title),
            sanitize(body.message),
            body.data ? JSON.stringify(body.data) : null,
            now,
          ],
        );

        // Fire-and-forget web push
        await notifyUserPush(env, userId, sanitize(body.title), sanitize(body.message));

        return createResponse({ message: "Notification created" }, 201);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to create notification", 500);
      }
    },
  },

  {
    method: "POST",
    pattern: "^\\/api\\/v1/notifications/([^/]+)/read$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const url = new URL(request.url);
        const notificationId = url.pathname.split("/")[4];

        const db = new Database(env);
        const now = new Date().toISOString();

        await db.execute(
          "UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ? AND user_id = ?",
          [now, notificationId, userId],
        );

        return createResponse({ message: "Notification marked as read" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to mark notification as read", 500);
      }
    },
  },

  {
    method: "DELETE",
    pattern: "^\\/api\\/v1/notifications/([^/]+)$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const url = new URL(request.url);
        const notificationId = url.pathname.split("/").pop();

        const db = new Database(env);

        await db.execute("DELETE FROM notifications WHERE id = ? AND user_id = ?", [
          notificationId,
          userId,
        ]);

        return createResponse({ message: "Notification deleted" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to delete notification", 500);
      }
    },
  },

  {
    method: "PUT",
    path: "/api/v1/notifications/preferences",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;

        const validation = updatePreferencesSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const db = new Database(env);
        const now = new Date().toISOString();

        const existing = await db.querySingle(
          "SELECT * FROM notification_preferences WHERE user_id = ?",
          [userId],
        );

        if (existing) {
          await db.execute(
            `UPDATE notification_preferences SET 
             email_enabled = COALESCE(?, email_enabled),
             push_enabled = COALESCE(?, push_enabled),
             whatsapp_enabled = COALESCE(?, whatsapp_enabled),
             in_app_enabled = COALESCE(?, in_app_enabled),
             mission_reminders = COALESCE(?, mission_reminders),
             review_requests = COALESCE(?, review_requests),
             community_updates = COALESCE(?, community_updates),
             updated_at = ?
             WHERE user_id = ?`,
            [
              body.emailEnabled ?? null,
              body.pushEnabled ?? null,
              body.whatsappEnabled ?? null,
              body.inAppEnabled ?? null,
              body.missionReminders ?? null,
              body.reviewRequests ?? null,
              body.communityUpdates ?? null,
              now,
              userId,
            ],
          );
        } else {
          await db.execute(
            `INSERT INTO notification_preferences 
             (id, user_id, email_enabled, push_enabled, whatsapp_enabled, in_app_enabled, 
              mission_reminders, review_requests, community_updates, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              crypto.randomUUID(),
              userId,
              body.emailEnabled ?? true,
              body.pushEnabled ?? true,
              body.whatsappEnabled ?? false,
              body.inAppEnabled ?? true,
              body.missionReminders ?? true,
              body.reviewRequests ?? true,
              body.communityUpdates ?? true,
              now,
              now,
            ],
          );
        }

        return createResponse({ message: "Preferences updated" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to update preferences", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/notifications/preferences",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);

        const preferences = await db.querySingle(
          "SELECT * FROM notification_preferences WHERE user_id = ?",
          [userId],
        );

        if (!preferences) {
          return createResponse({
            emailEnabled: true,
            pushEnabled: true,
            whatsappEnabled: false,
            inAppEnabled: true,
            missionReminders: true,
            reviewRequests: true,
            communityUpdates: true,
          });
        }

        return createResponse({
          emailEnabled: preferences.email_enabled === 1,
          pushEnabled: preferences.push_enabled === 1,
          whatsappEnabled: preferences.whatsapp_enabled === 1,
          inAppEnabled: preferences.in_app_enabled === 1,
          missionReminders: preferences.mission_reminders === 1,
          reviewRequests: preferences.review_requests === 1,
          communityUpdates: preferences.community_updates === 1,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch preferences", 500);
      }
    },
  },
  // ---- Web Push subscription management ----
  {
    method: "POST",
    path: "/api/v1/notifications/push/subscribe",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;
        const endpoint = body.endpoint as string | undefined;
        const p256dh = body.keys?.p256dh as string | undefined;
        const auth = body.keys?.auth as string | undefined;
        if (!endpoint || !p256dh || !auth) {
          return createErrorResponse("VALIDATION_ERROR", "Missing push subscription fields", 400);
        }
        const db = new Database(env);
        const now = new Date().toISOString();
        await db.execute(
          `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
          [crypto.randomUUID(), userId, endpoint, p256dh, auth, now],
        );
        return createResponse({ message: "Push subscription saved" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to save push subscription", 500);
      }
    },
  },
  {
    method: "POST",
    path: "/api/v1/notifications/push/unsubscribe",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;
        const endpoint = body.endpoint as string | undefined;
        if (!endpoint) {
          return createErrorResponse("VALIDATION_ERROR", "Missing endpoint", 400);
        }
        const db = new Database(env);
        await db.execute(
          "DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
          [userId, endpoint],
        );
        return createResponse({ message: "Push subscription removed" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to remove push subscription", 500);
      }
    },
  },
];

export default notificationRoutes;
