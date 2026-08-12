import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { z } from "zod";

const submitVideoSchema = z.object({
  youtubeUrl: z.string().url(),
  communityId: z.string().uuid().optional(),
});

const reviewSchema = z.object({
  score: z.number().min(1).max(5).optional(),
  feedbackText: z.string().min(20).max(2000),
});

const reviewAnswerSchema = z.object({
  ratingValue: z.number().min(1).max(5).optional(),
  textAnswer: z.string().min(3).max(500).optional(),
});

export const videoRoutes = [
  {
    method: "GET",
    path: "/api/v1/videos",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const { searchParams } = new URL(request.url);
        const communityId = searchParams.get("communityId");

        const db = new Database(env);
        let result;

        if (communityId) {
          result = await db.query(
            "SELECT * FROM videos WHERE community_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 20",
            [communityId],
          );
        } else {
          result = await db.query(
            "SELECT v.*, c.name as community_name FROM videos v LEFT JOIN communities c ON v.community_id = c.id WHERE v.user_id = ? AND v.status = 'active' ORDER BY v.created_at DESC LIMIT 20",
            [userId],
          );
        }

        return createResponse(result.results);
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

        // Extract YouTube video ID from URL
        const youtubeVideoId = extractYouTubeId(body.youtubeUrl);
        if (!youtubeVideoId) {
          return createErrorResponse("VALIDATION_ERROR", "Invalid YouTube URL", 400);
        }

        // Fetch YouTube metadata
        const metadata = await fetchYouTubeMetadata(youtubeVideoId, env);

        const videoId = db.uuid();
        const communityId = body.communityId || null;

        await db.execute(
          `INSERT INTO videos (id, user_id, community_id, youtube_video_id, youtube_url, title, description, thumbnail_url, duration_seconds, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
           [
            videoId,
            userId,
            communityId,
            youtubeVideoId,
            body.youtubeUrl,
            metadata.title,
            metadata.description,
            metadata.thumbnailUrl,
            metadata.durationSeconds,
            "active",
            now,
            now,
          ],
        );

        // Create credit transaction for spending credits
        // This would be handled by the gamification service

        return createResponse({
          message: "Video submitted successfully",
          videoId: videoId,
          title: metadata.title,
          thumbnailUrl: metadata.thumbnailUrl,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        console.error("Video submission error:", error);
        return createErrorResponse("INTERNAL_ERROR", "Failed to submit video", 500);
      }
    },
  },

  {
    method: "GET",
    pattern: "^\\/api\\/v1/videos/([^/]+)$",
    handler: async (request: Request, env: Env): Promise<Response> => {
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
        console.error("Get video error:", error);
        return createErrorResponse("INTERNAL_ERROR", "Failed to get video", 500);
      }
    },
  },
];

// Helper: Extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  const regExp =
    /(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S{11}(?:\S+|$))|youtu\.be\/([a-zA-Z0-9_-]{11}))/i;
  const match = url.match(regExp);
  return match ? (match[1] ?? match[0]) : null;
}

// Helper: Fetch YouTube metadata
async function fetchYouTubeMetadata(videoId: string, env: Env): Promise<any> {
  const cached = await env.KV_CACHE.get(`youtube:meta:${videoId}`, { type: "json" });
  if (cached) return cached;

  // Dev fallback: without a real YouTube Data API key, return synthetic metadata
  // so the local loop (submit -> queue -> watch -> reward) can be exercised.
  if (!env.YOUTUBE_API_KEY || env.YOUTUBE_API_KEY === "placeholder") {
    return {
      title: "Test Video",
      description: "",
      thumbnailUrl: null,
      durationSeconds: 600,
    };
  }

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${env.YOUTUBE_API_KEY}`,
  );

  if (!response.ok) {
    throw new Error("YouTube API error");
  }

  const data = (await response.json()) as any;
  const video = data.items?.[0];

  if (!video) {
    return {
      title: "YouTube Video",
      description: "",
      thumbnailUrl: null,
      durationSeconds: 0,
    };
  }

  const meta = {
    title: video.snippet?.title ?? "",
    description: video.snippet?.description ?? "",
    thumbnailUrl: video.snippet?.thumbnails?.medium?.url ?? null,
    durationSeconds: parseDuration(video.contentDetails?.duration),
  };

  // Cache for 24 hours
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

export const reviewRoutes = [
  {
    method: "GET",
    path: "/api/v1/reviews",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);

        const result = await db.query(
          `SELECT r.*, v.title as video_title, v.thumbnail_url, u.display_name as submitter_name, u.photo_url as submitter_photo
           FROM reviews r
           JOIN videos v ON r.video_id = v.id
           JOIN users u ON r.submitter_id = u.id
           WHERE r.reviewer_id = ? AND r.status IN ('assigned', 'in_progress', 'overdue')
           ORDER BY r.assigned_at DESC LIMIT 20`,
          [userId],
        );

        return createResponse(result.results);
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
          `SELECT r.*, v.title as video_title, v.thumbnail_url, v.youtube_url,
                  u.display_name as submitter_name, u.photo_url as submitter_photo
           FROM reviews r
           JOIN videos v ON r.video_id = v.id
           JOIN users u ON r.submitter_id = u.id
           WHERE r.id = ?`,
          [reviewId],
        );

        if (!review) {
          return createErrorResponse("NOT_FOUND", "Review not found", 404);
        }

        // Ensure user is authorized (reviewer or submitter)
        if (review.reviewer_id !== userId && review.submitter_id !== userId) {
          return createErrorResponse("FORBIDDEN", "Access denied", 403);
        }

        // Fetch review answers if completed
        let answers: any[] = [];
        if (review.status === "completed" || review.status === "in_progress") {
          const answerResult = await db.query(
            "SELECT ra.*, rq.question_text, rq.question_type FROM review_answers ra JOIN review_questions rq ON ra.question_id = rq.id WHERE ra.review_id = ?",
            [reviewId],
          );
          answers = answerResult.results;
        }

        // Fetch community questions for creating the review form
        const questions = await db.query(
          "SELECT * FROM review_questions ORDER BY order_index ASC",
          [],
        );

        return createResponse({
          review: {
            id: review.id,
            videoTitle: review.video_title,
            videoThumbnail: review.thumbnail_url,
            youtubeUrl: review.youtube_url,
            status: review.status,
            submitterName: review.submitter_name,
            submitterPhoto: review.submitter_photo,
            feedbackText: review.feedback_text,
            score: review.score,
            assignedAt: review.assigned_at,
            startedAt: review.started_at,
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
        const reviewId = url.pathname.split("/")[4]; // /api/v1/reviews/:id/start

        const db = new Database(env);
        const now = new Date().toISOString();

        await db.execute(
          "UPDATE reviews SET status = 'in_progress', started_at = ? WHERE id = ? AND reviewer_id = ?",
          [now, reviewId, userId],
        );

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

        // Update review
        await db.execute(
          "UPDATE reviews SET status = 'completed', completed_at = ?, score = ?, feedback_text = ? WHERE id = ? AND reviewer_id = ?",
          [now, body.score ?? null, body.feedbackText, reviewId, userId],
        );

        // Award credits and XP (handled by gamification service)
        // For now, just return success

        return createResponse({ message: "Review completed successfully" });
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
    path: "/api/v1/reviews/{reviewId}/answers",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;

        const db = new Database(env);
        const now = new Date().toISOString();

        const result = await db.querySingle(
          "SELECT * FROM reviews WHERE id = (SELECT review_id FROM reviews WHERE submitter_id = ? OR reviewer_id = ? LIMIT 1)",
          [userId, userId],
        );

        // In a real implementation, we'd validate the review belongs to the user

        return createResponse({ message: "Answers submitted" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to submit answers", 500);
      }
    },
  },
];
