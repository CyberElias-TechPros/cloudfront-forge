import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { notifyUserPush } from "../lib/push";
import { progressQuest } from "../lib/quests";
import { trackEvent } from "../lib/analytics";
import { calculateLevel } from "../lib/utils";
import { z } from "zod";
import { createLogger } from "../lib/logger";

const db = (env: Env) => new Database(env);

function getPagination(request: Request): { limit: number; offset: number } {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  return { limit, offset };
}

const submitVideoSchema = z.object({
  youtubeUrl: z.string().url(),
  communityId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  magicWord: z.string().min(2).max(30).optional(),
  niche: z.string().max(50).optional(),
});

const reviewSchema = z.object({
  score: z.number().min(1).max(5).optional(),
  feedbackText: z.string().max(2000).optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string(),
        ratingValue: z.number().min(0).max(5).optional(),
        textAnswer: z.string().max(500).optional(),
      }),
    )
    .optional(),
});

async function notifyCommunityMembers(db: Database, communityId: string, type: string, title: string, message: string, excludeUserId: string): Promise<void> {
  const members = await db.query(
    `SELECT user_id FROM community_members WHERE community_id = ? AND user_id != ? AND status = 'active'`,
    [communityId, excludeUserId],
  );

  const now = new Date().toISOString();
  const statements = members.results.map((m: any) => ({
    sql: `INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    params: [db.uuid(), m.user_id, type, title, message, now],
  }));

  if (statements.length > 0) {
    await db.batch(statements);
  }
}

async function notifyUser(db: Database, userId: string, type: string, title: string, message: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [db.uuid(), userId, type, title, message, now],
  );
}

export const videoRoutes = [
  {
    method: "GET",
    path: "/api/v1/videos",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const { searchParams } = new URL(request.url);
        const communityId = searchParams.get("communityId");
        const { limit, offset } = getPagination(request);

        const db = new Database(env);

        let countQuery = "SELECT COUNT(*) as count FROM videos v WHERE v.status = 'active'";
        let dataQuery = `SELECT v.*, c.name as community_name FROM videos v LEFT JOIN communities c ON v.community_id = c.id WHERE v.status = 'active'`;
        const params: any[] = [];

        if (communityId) {
          countQuery += " AND v.community_id = ?";
          dataQuery += " AND v.community_id = ?";
          params.push(communityId);
        } else {
          countQuery += " AND v.user_id = ?";
          dataQuery += " AND v.user_id = ?";
          params.push(userId);
        }

        const totalResult = await db.query(countQuery, params);
        dataQuery += ` ORDER BY v.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const result = await db.query(dataQuery, params);

        return createResponse({
          items: result.results,
          total: totalResult.results[0]?.count ?? 0,
          limit,
          offset,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch videos", 500);
      }
    },
  },

  {
    method: "POST",
    path: "/api/v1/videos",
    handler: async (request: Request, env: Env): Promise<Response> => {
      const logger = createLogger(env);
      try {
        const userId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;

        const validation = submitVideoSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const db = new Database(env);
        const now = new Date().toISOString();

        const youtubeVideoId = extractYouTubeId(body.youtubeUrl);
        if (!youtubeVideoId) {
          return createErrorResponse("VALIDATION_ERROR", "Invalid YouTube URL", 400);
        }

        // Block duplicate active submissions of the same video
        const duplicate = await db.querySingle(
          "SELECT id, user_id FROM videos WHERE youtube_video_id = ? AND status = 'active'",
          [youtubeVideoId],
        );
        if (duplicate) {
          return createErrorResponse(
            "CONFLICT",
            duplicate.user_id === userId
              ? "You already submitted this video"
              : "This video is already in the queue",
            409,
          );
        }

        // One submission per member per 24 hours
        const lastSubmission = await db.querySingle(
          "SELECT created_at FROM videos WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
          [userId],
        );
        if (lastSubmission?.created_at) {
          const lastTs = new Date(lastSubmission.created_at as string).getTime();
          if (Date.now() - lastTs < 24 * 60 * 60 * 1000) {
            return createErrorResponse(
              "SUBMISSION_COOLDOWN",
              "You can only submit one video every 24 hours. Please try again later.",
              429,
            );
          }
        }

        // Give/take ratio gate: require ratio >= 0.80 (subscriptions_given + watch_hours) / subscriptions_received
        // Grace period: first 3 submissions are free; after that, ratio >= 0.80 required
        // New users with no received subscriptions are exempt (ratio treated as neutral 1.0)
        const rep = await db.querySingle(
          "SELECT subscriptions_given, subscriptions_received, watch_minutes FROM reputation_accounts WHERE user_id = ?",
          [userId],
        );
        const given = rep?.subscriptions_given ?? 0;
        const received = rep?.subscriptions_received ?? 0;

        // Count user's previous submissions
        const submissionCount = await db.querySingle(
          "SELECT COUNT(*) as cnt FROM videos WHERE user_id = ?",
          [userId],
        );
        const previousSubmissions = submissionCount?.cnt ?? 0;

        const needsRatioCheck = received > 0 && previousSubmissions >= 3;
        if (needsRatioCheck) {
          // Only gate users who have received subs AND used their 3 free submissions
          const watchHours = (rep?.watch_minutes ?? 0) / 60.0;
          const giveTakeRatio = (given + watchHours) / received;
          if (giveTakeRatio < 0.80) {
            return createErrorResponse(
              "RATIO_GATE",
              `Your give/take ratio is ${giveTakeRatio.toFixed(2)}. Minimum 0.80 required to submit. Watch more videos to earn trust first.`,
              403,
            );
          }
        }

        // Multi-account detection: prevent same YouTube channel on multiple LoopSquad accounts
        const metadata = await fetchYouTubeMetadata(youtubeVideoId, env);
        const videoChannelId = metadata.channelId;
        if (videoChannelId) {
          const existingChannel = await db.querySingle(
            "SELECT user_id FROM youtube_oauth_tokens WHERE channel_id = ? AND user_id != ?",
            [videoChannelId, userId],
          );
          if (existingChannel) {
            return createErrorResponse(
              "CHANNEL_CONFLICT",
              "This YouTube channel is already connected to another LoopSquad account. Each channel can only be linked to one account.",
              409,
            );
          }
        }
        const finalTitle = validation.data.title?.trim() || metadata.title || "Untitled video";

        const videoId = db.uuid();
        const communityId = validation.data.communityId || null;

        await db.execute(
          `INSERT INTO videos (id, user_id, community_id, youtube_video_id, youtube_url, title, description, thumbnail_url, duration_seconds, channel_id, magic_word, niche, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            videoId,
            userId,
            communityId,
            youtubeVideoId,
            validation.data.youtubeUrl,
            finalTitle,
            metadata.description,
            metadata.thumbnailUrl,
            metadata.durationSeconds,
            metadata.channelId,
            validation.data.magicWord?.trim() || null,
            validation.data.niche?.trim() || null,
            "active",
            now,
            now,
          ],
        );

        if (communityId) {
          await notifyCommunityMembers(
            db,
            communityId,
            "NEW_VIDEO_SUBMITTED",
            "New Video Submitted",
            `A new video has been submitted to your community.`,
            userId,
          );
        }

        // Daily quest progress
        await progressQuest(env, userId, "submit_video");

        // Analytics funnel
        await trackEvent(env, "video_submitted", userId, "video", videoId);

        // Auto-assign up to 3 reviewers (exclude submitter, prefer same-community
        // members, trust-threshold filtered, least-recently-reviewed weighted)
        const reviewers = await db.query(
          `SELECT u.id FROM users u
           LEFT JOIN community_members cm
             ON cm.user_id = u.id AND cm.community_id = ? AND cm.status = 'active'
           WHERE u.id != ? AND u.deleted_at IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM reviews r
               WHERE r.reviewer_id = u.id AND r.video_id = ?
                 AND r.status IN ('assigned','in_progress')
             )
             AND COALESCE((
               SELECT ra.score FROM reputation_accounts ra WHERE ra.user_id = u.id
             ), 100) >= 60
           ORDER BY (CASE WHEN cm.user_id IS NOT NULL THEN 0 ELSE 1 END),
             (
               SELECT MAX(r2.assigned_at) FROM reviews r2 WHERE r2.reviewer_id = u.id
             ) ASC NULLS FIRST
           LIMIT 3`,
          [communityId ?? null, userId, videoId],
        );
        for (const reviewer of reviewers.results) {
          const nowISO = new Date().toISOString();
          await db.execute(
            `INSERT INTO reviews (id, video_id, reviewer_id, submitter_id, status, assigned_at, created_at)
             VALUES (?, ?, ?, ?, 'assigned', ?, ?)`,
            [crypto.randomUUID(), videoId, (reviewer as any).id, userId, nowISO, nowISO],
          );
          await db.execute(
            `INSERT INTO notifications (id, user_id, type, title, message, created_at)
             VALUES (?, ?, 'REVIEW_ASSIGNED', 'New Review Assigned', ?, ?)`,
            [
              crypto.randomUUID(),
              (reviewer as any).id,
              `A new video "${finalTitle}" needs your review.`,
              nowISO,
            ],
          );
          await notifyUserPush(env, (reviewer as any).id, "New Review Assigned", `A new video "${finalTitle}" needs your review.`);
        }

        return createResponse({
          message: "Video submitted successfully",
          videoId: videoId,
          title: finalTitle,
          thumbnailUrl: metadata.thumbnailUrl,
          channelId: metadata.channelId,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        logger.error("Video submission error", error);
        return createErrorResponse("INTERNAL_ERROR", "Failed to submit video", 500);
      }
    },
  },

  {
    method: "GET",
    pattern: "^\\/api\\/v1/videos/([^/]+)$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      const logger = createLogger(env);
      try {
        const url = new URL(request.url);
        const videoId = url.pathname.split("/").pop();

        if (!videoId) {
          return createErrorResponse("VALIDATION_ERROR", "Video ID is required", 400);
        }

        const db = new Database(env);
        const video = await db.querySingle(
          "SELECT v.*, u.display_name as creator_name, u.photo_url as creator_photo FROM videos v LEFT JOIN users u ON v.user_id = u.id WHERE v.id = ?",
          [videoId],
        );

        if (!video) {
          return createErrorResponse("NOT_FOUND", "Video not found", 404);
        }

        const reviews = await db.query(
          "SELECT r.*, u.display_name as reviewer_name, u.photo_url as reviewer_photo FROM reviews r JOIN users u ON r.reviewer_id = u.id WHERE r.video_id = ? AND r.status = 'completed' ORDER BY r.completed_at DESC LIMIT 20",
          [videoId],
        );

        return createResponse({
          video: {
            id: video.id,
            title: video.title,
            description: video.description,
            youtubeUrl: video.youtube_url,
            thumbnailUrl: video.thumbnail_url,
            durationSeconds: video.duration_seconds,
            status: video.status,
            creator: {
              name: video.creator_name,
              photoUrl: video.creator_photo,
            },
            createdAt: video.created_at,
          },
          reviews: reviews.results,
        });
      } catch (error) {
        logger.error("Get video error", error);
        return createErrorResponse("INTERNAL_ERROR", "Failed to get video", 500);
      }
    },
  },
];

export const reviewRoutes = [
  {
    method: "GET",
    path: "/api/v1/reviews",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const { limit, offset } = getPagination(request);

        const totalResult = await db.query(
          `SELECT COUNT(*) as count FROM reviews WHERE reviewer_id = ? AND status IN ('assigned', 'in_progress', 'overdue')`,
          [userId],
        );

        const result = await db.query(
          `SELECT
             r.id,
             r.video_id as videoId,
             v.title as videoTitle,
             v.thumbnail_url as videoThumbnail,
             r.submitter_id as submitterId,
             u.display_name as submitterName,
             r.reviewer_id as reviewerId,
             r.status as status,
             r.score as score,
             r.feedback_text as feedbackText,
             r.assigned_at as assignedAt,
             r.started_at as startedAt,
             r.completed_at as completedAt,
             datetime(r.assigned_at, '+48 hours') as dueAt
           FROM reviews r
           JOIN videos v ON r.video_id = v.id
           JOIN users u ON r.submitter_id = u.id
           WHERE r.reviewer_id = ? AND r.status IN ('assigned', 'in_progress', 'overdue')
           ORDER BY r.assigned_at DESC LIMIT ? OFFSET ?`,
          [userId, limit, offset],
        );

        return createResponse({
          items: result.results,
          total: totalResult.results[0]?.count ?? 0,
          limit,
          offset,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch reviews", 500);
      }
    },
  },

  {
    method: "GET",
    pattern: "^\\/api\\/v1/reviews/([^/]+)$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const url = new URL(request.url);
        const reviewId = url.pathname.split("/").pop();
        const userId = await requireAuth(request, env);

        if (!reviewId) {
          return createErrorResponse("VALIDATION_ERROR", "Review ID is required", 400);
        }

        const db = new Database(env);
        const review = await db.querySingle(
          `SELECT
             r.id,
             r.video_id as videoId,
             v.title as videoTitle,
             v.thumbnail_url as videoThumbnail,
             v.youtube_url as youtubeUrl,
             r.submitter_id as submitterId,
             u.display_name as submitterName,
             u.photo_url as submitterPhoto,
             r.reviewer_id as reviewerId,
             ru.display_name as reviewerName,
             r.status as status,
             r.score as score,
             r.feedback_text as feedbackText,
             r.assigned_at as assignedAt,
             r.started_at as startedAt,
             r.completed_at as completedAt,
             datetime(r.assigned_at, '+48 hours') as dueAt
           FROM reviews r
           JOIN videos v ON r.video_id = v.id
           JOIN users u ON r.submitter_id = u.id
           LEFT JOIN users ru ON r.reviewer_id = ru.id
           WHERE r.id = ?`,
          [reviewId],
        );

        if (!review) {
          return createErrorResponse("NOT_FOUND", "Review not found", 404);
        }

        if (review.reviewerId !== userId && review.submitterId !== userId) {
          return createErrorResponse("FORBIDDEN", "Access denied", 403);
        }

        let answers: any[] = [];
        if (review.status === "completed" || review.status === "in_progress") {
          const answerResult = await db.query(
            "SELECT ra.*, rq.question_text, rq.question_type FROM review_answers ra JOIN review_questions rq ON ra.question_id = rq.id WHERE ra.review_id = ?",
            [reviewId],
          );
          answers = answerResult.results;
        }

        const questions = await db.query(
          "SELECT * FROM review_questions ORDER BY order_index ASC",
          [],
        );

        return createResponse({
          review: {
            id: review.id,
            videoId: review.videoId,
            videoTitle: review.videoTitle,
            videoThumbnail: review.videoThumbnail,
            youtubeUrl: review.youtubeUrl,
            submitterId: review.submitterId,
            submitterName: review.submitterName,
            submitterPhoto: review.submitterPhoto,
            reviewerId: review.reviewerId,
            reviewerName: review.reviewerName,
            status: review.status,
            score: review.score,
            feedbackText: review.feedbackText,
            assignedAt: review.assignedAt,
            startedAt: review.startedAt,
            completedAt: review.completedAt,
            dueAt: review.dueAt,
          },
          questions: questions.results,
          answers: answers,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to get review", 500);
      }
    },
  },

  {
    method: "POST",
    pattern: "^\\/api\\/v1/reviews/([^/]+)/start$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const url = new URL(request.url);
        const reviewId = url.pathname.split("/")[4];

        const db = new Database(env);
        const now = new Date().toISOString();

        const review = await db.querySingle(
          "SELECT submitter_id, video_id FROM reviews WHERE id = ?",
          [reviewId],
        );

        await db.execute(
          "UPDATE reviews SET status = 'in_progress', started_at = ? WHERE id = ? AND reviewer_id = ?",
          [now, reviewId, userId],
        );

        if (review) {
          await notifyUser(
            db,
            review.submitter_id,
            "REVIEW_STARTED",
            "Review Started",
            `A review of your video has been started.`,
          );
        }

        return createResponse({ message: "Review started" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to start review", 500);
      }
    },
  },

  {
    method: "POST",
    pattern: "^\\/api\\/v1/reviews/([^/]+)/complete$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const url = new URL(request.url);
        const reviewId = url.pathname.split("/")[4];

        const body = (await request.json().catch(() => ({}))) as any;

        const validation = reviewSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const db = new Database(env);
        const now = new Date().toISOString();

        // Load the review (need submitter + current status for rewards/notification)
        const review = await db.querySingle(
          "SELECT id, reviewer_id, submitter_id, status FROM reviews WHERE id = ? AND reviewer_id = ?",
          [reviewId, userId],
        );
        if (!review) {
          return createErrorResponse("NOT_FOUND", "Review not found", 404);
        }

        const answers = Array.isArray(body?.answers) ? body.answers : [];

        // Score = average of rating answers when provided, else the submitted score
        const ratingValues = answers
          .map((a: any) => Number(a?.ratingValue))
          .filter((v: number) => Number.isFinite(v) && v > 0);
        const computedScore =
          ratingValues.length > 0
            ? Math.round(ratingValues.reduce((a: number, b: number) => a + b, 0) / ratingValues.length)
            : (body.score ?? null);

        await db.execute(
          "UPDATE reviews SET status = 'completed', completed_at = ?, score = ?, feedback_text = ? WHERE id = ? AND reviewer_id = ?",
          [now, computedScore, body.feedbackText ?? null, reviewId, userId],
        );

        // Daily quest progress
        await progressQuest(env, userId, "give_reviews");

        // Analytics funnel
        await trackEvent(env, "review_completed", userId, "review", reviewId);

        // Reward the reviewer (XP + credits) — one payout per review
        const REVIEW_XP = parseInt(env.REVIEW_XP || "20", 10);
        const REVIEW_CREDITS = parseInt(env.REVIEW_CREDITS || "5", 10);
        const firstCompletion = review.status !== "completed";
        let xpEarned = 0;
        let creditsEarned = 0;
        if (firstCompletion) {
          xpEarned = REVIEW_XP;
          creditsEarned = REVIEW_CREDITS;

          await db.execute(
            "INSERT INTO xp_transactions (id, user_id, amount, type, description, reference_id, created_at) VALUES (?, ?, ?, 'review', 'Review completed', ?, ?)",
            [crypto.randomUUID(), userId, xpEarned, reviewId, now],
          );
          const xpAccount = await db.querySingle("SELECT * FROM xp_accounts WHERE user_id = ?", [
            userId,
          ]);
          if (xpAccount) {
            const totalXp = (xpAccount.total_xp ?? 0) + xpEarned;
            const { level } = calculateLevel(totalXp);
            await db.execute(
              "UPDATE xp_accounts SET total_xp = ?, level = ?, updated_at = ? WHERE user_id = ?",
              [totalXp, level, now, userId],
            );
          } else {
            await db.execute(
              "INSERT INTO xp_accounts (id, user_id, total_xp, level, xp_to_next_level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [crypto.randomUUID(), userId, xpEarned, 1, 100, now, now],
            );
          }

          await db.execute(
            "INSERT INTO credit_transactions (id, user_id, amount, type, description, reference_id, created_at) VALUES (?, ?, ?, 'earned', 'Review completed', ?, ?)",
            [crypto.randomUUID(), userId, creditsEarned, reviewId, now],
          );
          const creditAccount = await db.querySingle(
            "SELECT * FROM credit_accounts WHERE user_id = ?",
            [userId],
          );
          if (creditAccount) {
            await db.execute(
              "UPDATE credit_accounts SET balance = balance + ?, updated_at = ? WHERE user_id = ?",
              [creditsEarned, now, userId],
            );
          } else {
            await db.execute(
              "INSERT INTO credit_accounts (id, user_id, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
              [crypto.randomUUID(), userId, creditsEarned, now, now],
            );
          }

          // Update the video owner's reputation (+1, audit-logged)
          const submitterId = review.submitter_id as string | null;
          if (submitterId && submitterId !== userId) {
            await db.execute(
              "INSERT INTO reputation_accounts (id, user_id, score, last_calculated, created_at, updated_at) VALUES (?, ?, 100, ?, ?, ?) ON CONFLICT(user_id) DO NOTHING",
              [crypto.randomUUID(), submitterId, now, now, now],
            );
            await db.execute(
              "UPDATE reputation_accounts SET score = MIN(100, score + 1), updated_at = ? WHERE user_id = ?",
              [now, submitterId],
            );
            await db.execute(
              "INSERT INTO reputation_events (id, user_id, event_type, points_change, description, created_at) VALUES (?, ?, 'review_received', 1, 'Video received a completed peer review', ?)",
              [crypto.randomUUID(), submitterId, now],
            );

            // Notify the video owner
            await db.execute(
              "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, 'REVIEW_COMPLETED', 'Review Completed', ?, ?)",
              [
                crypto.randomUUID(),
                submitterId,
                `Your video received a completed review${computedScore ? ` with a score of ${computedScore}/5` : ""}.`,
                now,
              ],
            );
            await notifyUserPush(
              env,
              submitterId,
              "Review Completed",
              `Your video received a completed review${computedScore ? ` with a score of ${computedScore}/5` : ""}.`,
            );
          }
        }

        if (answers.length > 0) {
          await db.execute("DELETE FROM review_answers WHERE review_id = ?", [reviewId]);
          const statements = answers
            .filter((a: any) => a?.questionId)
            .map((a: any) => ({
              sql: "INSERT INTO review_answers (id, review_id, question_id, rating_value, text_answer, created_at) VALUES (?, ?, ?, ?, ?, ?)",
              params: [
                db.uuid(),
                reviewId,
                a.questionId,
                a.ratingValue ?? null,
                a.textAnswer ?? null,
                now,
              ],
            }));
          if (statements.length > 0) {
            await db.batch(statements);
          }
        }

        return createResponse({
          message: "Review completed successfully",
          xpEarned,
          creditsEarned,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to complete review", 500);
      }
    },
  },

  {
    method: "POST",
    pattern: "^\\/api\\/v1/reviews/([^/]+)/answers$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const url = new URL(request.url);
        const reviewId = url.pathname.split("/")[4];
        if (!reviewId) {
          return createErrorResponse("VALIDATION_ERROR", "Review ID is required", 400);
        }
        const body = (await request.json().catch(() => ({}))) as any;
        const answers: any[] = Array.isArray(body?.answers) ? body.answers : [];

        const db = new Database(env);
        const review = await db.querySingle(
          "SELECT id FROM reviews WHERE id = ? AND (reviewer_id = ? OR submitter_id = ?)",
          [reviewId, userId, userId],
        );
        if (!review) {
          return createErrorResponse("NOT_FOUND", "Review not found", 404);
        }

        const now = db.now();
        const statements = answers
          .filter((a) => a?.questionId)
          .map((a) => ({
            sql: "INSERT INTO review_answers (id, review_id, question_id, rating_value, text_answer, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            params: [
              db.uuid(),
              reviewId,
              a.questionId,
              a.ratingValue ?? null,
              a.textAnswer ?? null,
              now,
            ],
          }));

        if (statements.length > 0) {
          await db.execute("DELETE FROM review_answers WHERE review_id = ?", [reviewId]);
          await db.batch(statements);
        }

        return createResponse({ message: "Answers submitted", saved: statements.length });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to submit answers", 500);
      }
    },
  },

  {
    method: "POST",
    pattern: "^\\/api\\/v1/reviews/([^/]+)/helpful$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const url = new URL(request.url);
        const reviewId = url.pathname.split("/")[4];
        if (!reviewId) return createErrorResponse("VALIDATION_ERROR", "reviewId required", 400);

        const database = db(env);
        const review = await database.query("SELECT * FROM reviews WHERE id = ?", [reviewId]);
        if (review.results.length === 0) return createErrorResponse("NOT_FOUND", "Review not found", 404);

        const reviewRow = review.results[0] as Record<string, unknown>;
        const video = await database.query("SELECT * FROM videos WHERE id = ?", [reviewRow.video_id]);
        if (video.results.length === 0) return createErrorResponse("NOT_FOUND", "Video not found", 404);
        if ((video.results[0] as Record<string, unknown>).user_id !== userId) {
          return createErrorResponse("FORBIDDEN", "Only the video submitter can rate this review", 403);
        }

        const body = (await request.json()) as { helpful: boolean };
        await database.query("UPDATE reviews SET helpful = ? WHERE id = ?", [body.helpful ? 1 : 0, reviewId]);

        // Boost reviewer trust by 1 per helpful review (base 100, capped at 100)
        if (body.helpful) {
          const nowTs = new Date().toISOString();
          await database.query(
            `INSERT INTO reputation_accounts (id, user_id, score, last_calculated, created_at, updated_at)
             VALUES (?, ?, 100, ?, ?, ?)
             ON CONFLICT(user_id) DO NOTHING`,
            [crypto.randomUUID(), reviewRow.reviewer_id, nowTs, nowTs, nowTs],
          );
          await database.query(
            `UPDATE reputation_accounts SET score = MIN(100, score + 1), updated_at = ? WHERE user_id = ?`,
            [nowTs, reviewRow.reviewer_id],
          );
          await database.query(
            `INSERT INTO reputation_events (id, user_id, event_type, points_change, description, created_at)
             VALUES (?, ?, 'helpful_review', 1, 'Review rated helpful by the video submitter', ?)`,
            [crypto.randomUUID(), reviewRow.reviewer_id, nowTs],
          );
        }

        return createResponse({ message: "Rating saved" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to rate review", 500);
      }
    },
  },
];

// Helper: Extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  const VALID_ID = /^[a-zA-Z0-9_-]{11}$/;
  const trimmed = url.trim();

  // Bare 11-character video ID
  if (VALID_ID.test(trimmed)) return trimmed;

  try {
    const u = new URL(trimmed);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0] ?? "";
      return VALID_ID.test(id) ? id : null;
    }
    if (/(^|\.)youtube\.com$/i.test(u.hostname)) {
      // watch?v=<id>
      const v = u.searchParams.get("v");
      if (v && VALID_ID.test(v)) return v;
      // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>, /e/<id>
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v|e)\/([a-zA-Z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // Not a parseable URL — fall through
  }
  return null;
}

// Helper: Fetch YouTube metadata.
// Degrades gracefully: without an API key (or on API/quota errors) we still return
// a usable record — the thumbnail is constructible from the video ID alone — so
// video submission keeps working instead of hard-failing with a 500.
async function fetchYouTubeMetadata(videoId: string, env: Env): Promise<any> {
  const cached = (await env.KV_CACHE.get<any>(`youtube:meta:${videoId}`, { type: "json" })) as any;
  if (cached && cached.channelId) return cached;

  const fallback = {
    title: null,
    description: null,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    durationSeconds: null,
    channelId: null,
    channelTitle: null,
  };

  if (!env.YOUTUBE_API_KEY || env.YOUTUBE_API_KEY === "placeholder") {
    return fallback;
  }

  let meta = fallback;
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${env.YOUTUBE_API_KEY}`,
    );

    if (response.ok) {
      const data = (await response.json()) as any;
      const video = data.items?.[0];

      if (video) {
        meta = {
          title: video.snippet?.title ?? "",
          description: video.snippet?.description ?? "",
          thumbnailUrl: video.snippet?.thumbnails?.medium?.url ?? fallback.thumbnailUrl,
          durationSeconds: parseDuration(video.contentDetails?.duration),
          channelId: video.snippet?.channelId ?? null,
          channelTitle: video.snippet?.channelTitle ?? null,
        };
      }
    }
  } catch {
    // Network/API failure — keep the fallback metadata
  }

  await env.KV_CACHE.put(`youtube:meta:${videoId}`, JSON.stringify(meta), {
    expirationTtl: 86400,
  });

  return meta;
}

function parseDuration(duration: string | undefined): number | null {
  if (!duration) return null;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}
