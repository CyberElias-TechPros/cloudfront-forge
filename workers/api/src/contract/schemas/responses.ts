/**
 * Response payload schemas for the endpoints that already have a stable shape.
 *
 * The API wraps every payload in `{ success, data, meta }`; these schemas
 * describe `data` only. Endpoints without a declared response are documented
 * with a free-form object and reported as `x-response-typed: false` so the gap
 * is visible instead of implied.
 */
import { z } from "zod";

const iso = z.string();
const nullableIso = iso.nullable();

/** The member record both clients bootstrap from (`GET /auth/me`). */
export const memberResponseSchema = z
  .object({
    id: z.string(),
    firebaseUid: z.string().optional(),
    email: z.string().nullable().optional(),
    displayName: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    photoUrl: z.string().nullable().optional(),
    level: z.number(),
    totalXp: z.number(),
    credits: z.number(),
    streak: z.number().optional(),
    niche: z.string().nullable().optional(),
    publicProfile: z.boolean().optional(),
    createdAt: iso.optional(),
    updatedAt: iso.optional(),
    lastActive: nullableIso.optional(),
  })
  .passthrough();

/**
 * Result of `POST /watch`.
 *
 * `evidence` is additive (SEC-010): clients use it to explain *why* a claim
 * paid or did not, without re-implementing the policy.
 */
export const watchClaimResponseSchema = z
  .object({
    status: z.enum(["started", "verified", "claimed"]),
    claimable: z.boolean(),
    attentionBlocked: z.boolean(),
    xpAwarded: z.number(),
    creditsAwarded: z.number(),
    watchVerified: z.boolean(),
    subscribed: z.boolean(),
    commented: z.boolean(),
    rewardBreakdown: z.object({
      watch: z.object({ xp: z.number(), credits: z.number() }),
      subscribe: z.object({ xp: z.number(), credits: z.number() }),
      comment: z.object({ xp: z.number(), credits: z.number() }),
    }),
    evidence: z
      .object({
        level: z.enum(["youtube_api", "signed_session", "self_report", "none"]),
        paid: z.boolean(),
        verifiedSeconds: z.number(),
        reason: z.string(),
      })
      .optional(),
    subReason: z.string().optional(),
    level: z.number(),
    totalXp: z.number(),
  })
  .passthrough();

export const watchSessionResponseSchema = z.object({
  sessionToken: z.string().nullable(),
  enabled: z.boolean(),
  startTs: z.number().optional(),
});

export const videoSummarySchema = z
  .object({
    id: z.string(),
    youtubeVideoId: z.string().optional(),
    youtubeUrl: z.string().optional(),
    title: z.string().nullable().optional(),
    thumbnailUrl: z.string().nullable().optional(),
    durationSeconds: z.number().nullable().optional(),
    status: z.enum(["pending", "active", "completed", "archived", "removed"]).optional(),
    createdAt: iso.optional(),
  })
  .passthrough();

export const videoListResponseSchema = z.object({
  videos: z.array(videoSummarySchema),
  pagination: z
    .object({
      limit: z.number(),
      offset: z.number(),
      total: z.number().optional(),
    })
    .passthrough()
    .optional(),
});

export const notificationSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    title: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
    isRead: z.boolean().optional(),
    createdAt: iso.optional(),
  })
  .passthrough();

export const notificationListResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number().optional(),
});

export const missionSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    xpReward: z.number().optional(),
    creditReward: z.number().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const missionListResponseSchema = z.object({
  missions: z.array(missionSchema),
});

export const shopItemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    cost: z.number(),
    itemType: z.string(),
  })
  .passthrough();

export const shopListResponseSchema = z.object({
  items: z.array(shopItemSchema),
  balance: z.number().optional(),
});

/** Explicitly-untyped payload: documented, but no field-level contract yet. */
export const freeFormDataSchema = z.record(z.unknown());

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  environment: z.string(),
  timestamp: iso,
});

export const readyResponseSchema = z.object({
  status: z.literal("ready"),
  environment: z.string(),
  schemaVersion: z.string(),
  timestamp: iso,
});
