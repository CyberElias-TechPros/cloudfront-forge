import type { Env, RouteDefinition } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database, sqlBool } from "../lib/database";
import { sanitize } from "../lib/sanitize";
import { z } from "zod";
import { createLogger } from "../lib/logger";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  country: z.string().max(100).optional(),
  language: z.string().max(50).optional(),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  niche: z.string().max(100).optional(),
  contentCategories: z.string().max(500).optional(),
  goals: z.string().max(500).optional(),
  lookingFor: z.enum(["collaboration", "feedback", "support", "mentorship"]).optional(),
  publicProfile: z.boolean().optional(),
});

const updateYouTubeChannelSchema = z.object({
  channelId: z.string().min(1),
  channelName: z.string().optional(),
});

export const userRoutes: RouteDefinition[] = [
  {
    method: "GET",
    pattern: "^\\/api\\/v1/users/([^/]+)$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        // Signed-in members only: this returns display name, photo and the
        // creator profile (niche, goals, country, ...).
        await requireAuth(request, env);
        const url = new URL(request.url);
        const path = url.pathname;
        const userIdParam = path.split("/").pop();

        if (!userIdParam) {
          return createErrorResponse("VALIDATION_ERROR", "User ID is required", 400);
        }

        const db = new Database(env);
        const user = await db.querySingle(
          "SELECT * FROM users WHERE id = ? AND deleted_at IS NULL",
          [userIdParam],
        );

        if (!user) {
          return createErrorResponse("NOT_FOUND", "User not found", 404);
        }

        const profile = await db.querySingle("SELECT * FROM creator_profiles WHERE user_id = ?", [
          userIdParam,
        ]);

        return createResponse({
          id: user.id,
          displayName: user.display_name,
          photoUrl: user.photo_url,
          profile: profile,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        createLogger(env).error("Get user error", error);
        return createErrorResponse("INTERNAL_ERROR", "Failed to get user", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/users/me/profile",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);

        const user = await db.querySingle(
          "SELECT * FROM users WHERE id = ? AND deleted_at IS NULL",
          [userId],
        );

        if (!user) {
          return createErrorResponse("NOT_FOUND", "User not found", 404);
        }

        const profile = await db.querySingle("SELECT * FROM creator_profiles WHERE user_id = ?", [
          userId,
        ]);

        const channels = await db.query("SELECT * FROM youtube_channels WHERE user_id = ?", [
          userId,
        ]);

        // Unified view: OAuth-connected channel takes priority over manual entries
        const oauthToken = await db.querySingle(
          "SELECT channel_id FROM youtube_oauth_tokens WHERE user_id = ?",
          [userId],
        );
        const allChannels: any[] = [...(channels.results as any[])];
        if (oauthToken?.channel_id && !allChannels.some((c) => c.channel_id === oauthToken.channel_id)) {
          allChannels.unshift({
            id: "__oauth_connected",
            channel_id: oauthToken.channel_id,
            channel_name: null,
            source: "youtube_oauth",
          });
        }

        return createResponse({
          id: user.id,
          firebaseUid: user.firebase_uid,
          email: user.email,
          emailVerified: Boolean(user.email_verified),
          displayName: user.display_name,
          photoUrl: user.photo_url,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          deletedAt: user.deleted_at,
          lastActive: user.last_active,
          profile: profile,
          channels: allChannels,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch profile", 500);
      }
    },
  },

  {
    method: "PUT",
    path: "/api/v1/users/me/profile",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;

        const validation = updateProfileSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }
        const input = validation.data;

        const db = new Database(env);

        // Check if profile exists
        const existingProfile = await db.querySingle(
          "SELECT * FROM creator_profiles WHERE user_id = ?",
          [userId],
        );

        const now = new Date().toISOString();

        // The display name lives on `users` (it is shown next to reviews,
        // leaderboard rows and notifications); it used to be validated, then
        // silently dropped.
        if (input.displayName !== undefined) {
          await db.execute("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?", [
            sanitize(input.displayName),
            now,
            userId,
          ]);
        }

        const clean = (value: string | undefined): string | null =>
          value === undefined ? null : sanitize(value);

        if (existingProfile) {
          await db.execute(
            `UPDATE creator_profiles SET bio = ?, country = ?, language = ?, 
             experience_level = ?, niche = ?, content_categories = ?, goals = ?, 
             looking_for = ?, public_profile = ?, updated_at = ?
             WHERE user_id = ?`,
            [
              clean(input.bio) ?? existingProfile.bio,
              clean(input.country) ?? existingProfile.country,
              clean(input.language) ?? existingProfile.language,
              input.experienceLevel ?? existingProfile.experience_level,
              clean(input.niche) ?? existingProfile.niche,
              clean(input.contentCategories) ?? existingProfile.content_categories,
              clean(input.goals) ?? existingProfile.goals,
              input.lookingFor ?? existingProfile.looking_for,
              sqlBool(input.publicProfile) ?? existingProfile.public_profile,
              now,
              userId,
            ],
          );
        } else {
          await db.execute(
            `INSERT INTO creator_profiles (id, user_id, bio, country, language, 
             experience_level, niche, content_categories, goals, looking_for, 
             public_profile, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              crypto.randomUUID(),
              userId,
              clean(input.bio),
              clean(input.country),
              clean(input.language),
              input.experienceLevel ?? null,
              clean(input.niche),
              clean(input.contentCategories),
              clean(input.goals),
              input.lookingFor ?? null,
              sqlBool(input.publicProfile) ?? 1,
              now,
              now,
            ],
          );
        }

        return createResponse({ message: "Profile updated successfully" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to update profile", 500);
      }
    },
  },

  {
    method: "POST",
    path: "/api/v1/users/me/youtube-channel",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;

        const validation = updateYouTubeChannelSchema.safeParse(body);
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
          `INSERT OR REPLACE INTO youtube_channels (id, user_id, channel_id, channel_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), userId, body.channelId, body.channelName ?? null, now, now],
        );

        // Award XP for connecting channel
        // This would be handled by the gamification service

        return createResponse({ message: "YouTube channel connected" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to connect channel", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/users/me/member",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);

        const user = await db.querySingle(
          "SELECT * FROM users WHERE id = ? AND deleted_at IS NULL",
          [userId],
        );
        if (!user) {
          return createErrorResponse("NOT_FOUND", "User not found", 404);
        }

        const profile = await db.querySingle("SELECT * FROM creator_profiles WHERE user_id = ?", [
          userId,
        ]);
        const channel = await db.querySingle(
          "SELECT * FROM youtube_channels WHERE user_id = ? ORDER BY created_at DESC",
          [userId],
        );
        // Fallback: OAuth channel_id is the authoritative source
        let channelId = channel?.channel_id ?? null;
        if (!channelId) {
          const oauthRow = await db.querySingle(
            "SELECT channel_id FROM youtube_oauth_tokens WHERE user_id = ?",
            [userId],
          );
          channelId = oauthRow?.channel_id ?? null;
        }
        const xp = await db.querySingle("SELECT * FROM xp_accounts WHERE user_id = ?", [userId]);
        const reputation = await db.querySingle(
          "SELECT * FROM reputation_accounts WHERE user_id = ?",
          [userId],
        );
        const adminRow = await db.querySingle("SELECT role FROM admin_users WHERE user_id = ?", [
          userId,
        ]);
        const isAdmin = !!(adminRow && ["super_admin", "admin"].includes(adminRow.role));
        const streaks = await db.query("SELECT current_streak FROM streaks WHERE user_id = ?", [
          userId,
        ]);

        const maxStreak = streaks.results.reduce(
          (max: number, s: any) => Math.max(max, s.current_streak ?? 0),
          0,
        );

        const name = user.display_name ?? "Creator";
        const handle = channel?.channel_name
          ? `@${channel.channel_name.replace(/^@/, "")}`
          : `@${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;

        const leaderboard = await db.query(
          `SELECT u.id FROM users u
           LEFT JOIN xp_accounts x ON u.id = x.user_id
           LEFT JOIN reputation_accounts r ON u.id = r.user_id
           WHERE u.deleted_at IS NULL
           ORDER BY ((x.total_xp * 1.0) + (COALESCE(r.score,0) * 2)) DESC`,
          [],
        );
        const rank = leaderboard.results.findIndex((row: any) => row.id === userId) + 1;

        return createResponse({
          id: user.id,
          name,
          handle,
          avatar: user.photo_url ?? name.charAt(0).toUpperCase(),
          points: xp?.total_xp ?? 0,
          streak: maxStreak,
          level: xp?.level ?? 1,
          rank: rank > 0 ? rank : 0,
          niche: profile?.niche ?? "Creator",
          subsGiven: reputation?.subscriptions_given ?? 0,
          subsReceived: reputation?.subscriptions_received ?? 0,
          watchMinutes: reputation?.watch_minutes ?? 0,
          trustScore: reputation?.score ?? 0,
          isAdmin,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch member", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/users/me/youtube-channels",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const result = await db.query(
          "SELECT * FROM youtube_channels WHERE user_id = ? ORDER BY created_at DESC",
          [userId],
        );

        return createResponse(result.results);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch channels", 500);
      }
    },
  },

  // GET /users/me/insights — the caller's own channel performance on LoopSquad.
  // Creator-facing analytics: how their videos are performing (watches, subs,
  // comments, watch time received) plus their own earning/review activity.
  {
    method: "GET",
    path: "/api/v1/users/me/insights",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);

        const videosResult = await db.query(
          `SELECT id, title, youtube_video_id, status, created_at, boosted_until, watch_target
           FROM videos WHERE user_id = ? AND status != 'removed' ORDER BY created_at DESC`,
          [userId],
        );
        const videos = videosResult.results as any[];

        const statsResult = await db.query(
          `SELECT video_id,
                  COUNT(*) AS watches,
                  SUM(CASE WHEN subscribed = 1 THEN 1 ELSE 0 END) AS subs,
                  SUM(CASE WHEN commented = 1 THEN 1 ELSE 0 END) AS comments,
                  COALESCE(SUM(watch_seconds), 0) AS watch_seconds
           FROM watch_sessions
           WHERE video_id IN (SELECT id FROM videos WHERE user_id = ?)
           GROUP BY video_id`,
          [userId],
        );
        const statsByVideo = new Map<string, any>();
        for (const s of statsResult.results) {
          statsByVideo.set(s.video_id, s);
        }

        const reviewsGiven = await db.querySingle(
          "SELECT COUNT(*) AS count FROM reviews WHERE reviewer_id = ? AND status = 'completed'",
          [userId],
        );
        const reviewsReceived = await db.querySingle(
          "SELECT COUNT(*) AS count, AVG(score) AS avg_score FROM reviews WHERE submitter_id = ? AND status = 'completed'",
          [userId],
        );
        const helpfulGiven = await db.querySingle(
          "SELECT COUNT(*) AS count FROM reviews WHERE reviewer_id = ? AND helpful = 1",
          [userId],
        );
        const xp = await db.querySingle(
          "SELECT total_xp, level FROM xp_accounts WHERE user_id = ?",
          [userId],
        );
        const credits = await db.querySingle(
          "SELECT balance FROM credit_accounts WHERE user_id = ?",
          [userId],
        );

        // Daily trend of watches received over the last 14 days.
        const trendSince = new Date(Date.now() - 14 * 86_400_000).toISOString();
        const trendResult = await db.query(
          `SELECT date(ws.created_at) AS day,
                  COUNT(*) AS watches,
                  COALESCE(SUM(ws.watch_seconds), 0) AS watch_seconds
           FROM watch_sessions ws
           JOIN videos v ON v.id = ws.video_id
           WHERE v.user_id = ? AND ws.created_at >= ?
           GROUP BY date(ws.created_at)
           ORDER BY day ASC`,
          [userId, trendSince],
        );

        let watchesReceived = 0;
        let subsReceived = 0;
        let commentsReceived = 0;
        let watchSecondsReceived = 0;

        const perVideo = videos.map((v) => {
          const s = statsByVideo.get(v.id) ?? { watches: 0, subs: 0, comments: 0, watch_seconds: 0 };
          const watches = Number(s.watches ?? 0);
          const subs = Number(s.subs ?? 0);
          const comments = Number(s.comments ?? 0);
          const watchSeconds = Number(s.watch_seconds ?? 0);
          watchesReceived += watches;
          subsReceived += subs;
          commentsReceived += comments;
          watchSecondsReceived += watchSeconds;
          return {
            id: v.id,
            title: v.title ?? "Untitled video",
            status: v.status,
            youtubeVideoId: v.youtube_video_id ?? null,
            postedAt: v.created_at,
            boosted: !!(v.boosted_until && v.boosted_until > new Date().toISOString()),
            watchTarget: Number(v.watch_target ?? 0),
            watches,
            subs,
            comments,
            watchSeconds,
          };
        });

        return createResponse({
          totals: {
            videos: videos.length,
            watchesReceived,
            subsReceived,
            commentsReceived,
            watchMinutesReceived: Math.round(watchSecondsReceived / 60),
          },
          videos: perVideo,
          trend: trendResult.results.map((r: any) => ({
            day: r.day,
            watches: Number(r.watches ?? 0),
            watchSeconds: Number(r.watch_seconds ?? 0),
          })),
          reviews: {
            received: Number(reviewsReceived?.count ?? 0),
            averageScore:
              reviewsReceived?.avg_score != null
                ? Math.round(Number(reviewsReceived.avg_score) * 10) / 10
                : null,
            helpfulGiven: Number(helpfulGiven?.count ?? 0),
          },
          earnings: {
            xp: Number(xp?.total_xp ?? 0),
            level: Number(xp?.level ?? 1),
            credits: Number(credits?.balance ?? 0),
            reviewsGiven: Number(reviewsGiven?.count ?? 0),
          },
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch insights", 500);
      }
    },
  },
];
