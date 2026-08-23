import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function hueFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return hash;
}

function getPagination(request: Request): { limit: number; offset: number } {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  return { limit, offset };
}

function extractVideoId(url: string | null): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export const feedRoutes = [
  {
    method: "GET",
    path: "/api/v1/queue",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const { limit, offset } = getPagination(request);

        const totalResult = await db.query(
          `SELECT COUNT(*) as count FROM videos v
            WHERE v.status = 'active' AND v.user_id != ?
           `,
          [userId],
        );

        const result = await db.query(
          `SELECT v.id, v.title, v.duration_seconds, v.status, v.created_at, v.user_id,
                  v.youtube_video_id, v.youtube_url, v.channel_id,
                  u.display_name, u.photo_url,
                  ws.status AS watch_status
           FROM videos v
           LEFT JOIN users u ON v.user_id = u.id
           LEFT JOIN watch_sessions ws ON ws.video_id = v.id AND ws.watcher_id = ?
           WHERE v.status = 'active' AND v.user_id != ?
           ORDER BY v.created_at DESC
           LIMIT ? OFFSET ?`,
          [userId, userId, limit, offset],
        );

        const items = result.results.map((v: any) => {
          const owner = v.display_name ?? "Creator";
          const status: "pending" | "watching" | "verified" | "expired" =
            v.watch_status === "claimed"
              ? "verified"
              : v.watch_status === "verified"
                ? "watching"
                : "pending";
          const REQUIRED_WATCH_SEC = parseInt(env.REQUIRED_WATCH_SEC || "180", 10);
          const duration = typeof v.duration_seconds === "number" && v.duration_seconds > 0 ? v.duration_seconds : null;
          return {
            id: v.id,
            owner,
            handle: `@${owner.toLowerCase().replace(/[^a-z0-9]+/g, "")}`,
            avatar: v.photo_url ?? owner.charAt(0).toUpperCase(),
            title: v.title ?? "Untitled video",
            niche: "Creator",
            durationSec: v.duration_seconds ?? 0,
            requiredSec: duration ? Math.min(REQUIRED_WATCH_SEC, duration) : REQUIRED_WATCH_SEC,
            reward: 30,
            status,
            postedAgo: timeAgo(v.created_at),
            thumbHue: hueFromId(v.id),
            youtubeVideoId: v.youtube_video_id ?? extractVideoId(v.youtube_url) ?? "",
            youtubeUrl: v.youtube_url ?? "",
            creatorChannelId: v.channel_id ?? null,
          };
        });

        return createResponse({
          items,
          total: totalResult.results[0]?.count ?? 0,
          limit,
          offset,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch queue", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/submissions",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const { limit, offset } = getPagination(request);

        const totalResult = await db.query(
          `SELECT COUNT(*) as count FROM videos v WHERE v.user_id = ?`,
          [userId],
        );

        const result = await db.query(
          `SELECT v.id, v.title, v.status, v.created_at,
                  (SELECT COUNT(*) FROM reviews r WHERE r.video_id = v.id) AS comment_count,
                  (SELECT COUNT(*) FROM watch_sessions w WHERE w.video_id = v.id AND w.status = 'claimed') AS watcher_count
           FROM videos v
           WHERE v.user_id = ?
           ORDER BY v.created_at DESC
           LIMIT ? OFFSET ?`,
          [userId, limit, offset],
        );

        const items = result.results.map((v: any) => {
          const status =
            v.status === "completed" ? "completed" : v.status === "pending" ? "queued" : "active";
          return {
            id: v.id,
            title: v.title ?? "Untitled video",
            postedAgo: timeAgo(v.created_at),
            watchers: v.watcher_count ?? 0,
            target: 20,
            subs: 0,
            comments: v.comment_count ?? 0,
            status,
          };
        });

        return createResponse({
          items,
          total: totalResult.results[0]?.count ?? 0,
          limit,
          offset,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch submissions", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/activity",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const { limit, offset } = getPagination(request);

        const totalResult = await db.query(
          `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
          [userId],
        );

        const result = await db.query(
          `SELECT id, type, title, message, created_at
           FROM notifications
           WHERE user_id = ? AND is_read = 0
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
          [userId, limit, offset],
        );

        const items = result.results.map((n: any) => ({
          id: n.id,
          who: "You",
          what: n.title ?? n.message ?? "New activity",
          when: timeAgo(n.created_at),
          points: "",
        }));

        return createResponse({
          items,
          total: totalResult.results[0]?.count ?? 0,
          limit,
          offset,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch activity", 500);
      }
    },
  },
];
