/**
 * Watch-loop request schemas — the highest-value contract in the product,
 * because these payloads decide payouts.
 */
import { z } from "zod";

/**
 * Body of `POST /watch` (the claim).
 *
 * `watchSeconds` is the member's/client's own measurement. It is *input*, not
 * proof: `src/lib/verification/policy.ts` decides what evidence level it
 * represents and whether it may pay (SEC-010).
 */
export const watchClaimSchema = z.object({
  videoId: z.string().min(1),
  watchSeconds: z.number().min(0).max(86400),
  subscribed: z.boolean().default(false),
  commented: z.boolean().default(false),
  /** Signed session token from `POST /watch/start` (strong evidence, SEC-011). */
  sessionToken: z.string().max(512).optional(),
});

export const watchStartSchema = z.object({
  videoId: z.string().min(1),
});

/**
 * One player-time sample for slope verification (SEC-012).
 *
 * Only the two fields the handler stores today are declared: a contract that
 * promises fields the server ignores is worse than no contract.
 */
export const watchHeartbeatSchema = z.object({
  sessionToken: z.string().min(1).max(512),
  /** Player position in seconds, as reported by the embed. */
  playerTime: z.number().min(0).max(86400),
});

/** Answer to a mid-watch attention challenge. */
export const attentionChallengeAnswerSchema = z.object({
  answer: z.union([z.string().trim().min(1).max(64), z.number()]),
});

export type WatchClaimInput = z.infer<typeof watchClaimSchema>;
export type WatchStartInput = z.infer<typeof watchStartSchema>;
export type WatchHeartbeatInput = z.infer<typeof watchHeartbeatSchema>;
export type AttentionChallengeAnswerInput = z.infer<typeof attentionChallengeAnswerSchema>;
