/**
 * Video, review, mission, shop, top-up and notification payloads.
 *
 * Copied from the handlers' previous inline definitions with identical
 * constraints, so moving them here changed documentation — not behaviour.
 */
import { z } from "zod";

// --- Videos & reviews -----------------------------------------------------

export const submitVideoSchema = z.object({
  youtubeUrl: z.string().url(),
  communityId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  magicWord: z.string().min(2).max(30).optional(),
  niche: z.string().max(50).optional(),
});

const reviewAnswerSchema = z.object({
  questionId: z.string().min(1).max(100),
  ratingValue: z.number().min(0).max(5).optional(),
  textAnswer: z.string().max(500).optional(),
});

export const reviewAnswersSchema = z.object({
  answers: z.array(reviewAnswerSchema).max(20).default([]),
});

export const reviewHelpfulSchema = z.object({
  helpful: z.boolean(),
});

export const reviewSubmitSchema = z.object({
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

// --- Missions -------------------------------------------------------------

export const missionCreateSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().max(1000),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  xpReward: z.number().min(0).default(25),
  creditReward: z.number().min(0).default(10),
  timeEstimateMinutes: z.number().min(1).max(300).default(15),
  chainId: z.string().uuid().optional(),
  chainStep: z.number().min(1).max(3).optional(),
});

export const missionChainSchema = z.object({
  niche: z.string().min(2).max(50),
  steps: z
    .array(
      z.object({
        title: z.string().min(5).max(200),
        description: z.string().max(1000).default(""),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
        xpReward: z.number().min(0).default(25),
        creditReward: z.number().min(0).default(10),
        timeEstimateMinutes: z.number().min(1).max(300).default(15),
      }),
    )
    .min(2)
    .max(5),
});

export const missionCompleteSchema = z.object({
  completionData: z.string().max(2000).optional(),
});

// --- Shop -----------------------------------------------------------------

export const shopPurchaseSchema = z.object({
  itemType: z.enum(["boost", "streak_freeze"]),
  videoId: z.string().optional(),
});

// --- Top-ups (web/NGN; never sold inside the Play app — see GRW-010) -------

export const topupRequestSchema = z.object({
  tierId: z.string().min(1).max(32),
  /**
   * `proof:<path>` token returned by `POST /topups/proof`, pointing at the
   * receipt stored in R2. The transfer reference is a fallback for members
   * whose bank statement shows a quotable reference.
   */
  proofImage: z.string().min(1).max(512).optional(),
  proofImageName: z.string().max(255).optional(),
  proofImageType: z.string().max(64).optional(),
  transferReference: z
    .string()
    .trim()
    .min(4, "Transfer reference is too short")
    .max(64)
    .regex(
      /^[A-Za-z0-9\-_/+]+$/,
      "Transfer reference may only contain letters, numbers, dashes, underscores, slashes or plus signs",
    )
    .optional(),
});

// --- Notifications --------------------------------------------------------

export const notificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  missionReminders: z.boolean().optional(),
  reviewRequests: z.boolean().optional(),
  communityUpdates: z.boolean().optional(),
  quietHoursStart: z.number().min(0).max(23).nullable().optional(),
  quietHoursEnd: z.number().min(0).max(23).nullable().optional(),
});

const pushEndpoint = z
  .string()
  .min(1)
  .max(2048)
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "endpoint must be an https URL");

export const pushSubscribeSchema = z.object({
  endpoint: pushEndpoint,
  keys: z.object({
    // Web Push uses unpadded base64url keys; both are ~65 bytes encoded.
    p256dh: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/, "p256dh must be base64url"),
    auth: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/, "auth must be base64url"),
  }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: pushEndpoint,
});

export type SubmitVideoInput = z.infer<typeof submitVideoSchema>;
export type ReviewSubmitInput = z.infer<typeof reviewSubmitSchema>;
export type MissionCompleteInput = z.infer<typeof missionCompleteSchema>;
export type ShopPurchaseInput = z.infer<typeof shopPurchaseSchema>;
export type TopupRequestInput = z.infer<typeof topupRequestSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;
