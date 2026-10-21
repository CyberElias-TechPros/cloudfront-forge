/**
 * Auth + profile request schemas.
 *
 * Moved verbatim out of `routes/auth.ts` and `routes/users.ts` so the OpenAPI
 * document, the handler validation and both generated clients come from one
 * definition (PLAT-002).
 */
import { z } from "zod";

/**
 * Body of `POST /auth/register`.
 *
 * `firebaseUid` is accepted but **ignored** by the handler: identity always
 * comes from the verified bearer token. It stays in the schema so older
 * clients sending it are not rejected, and it is documented as deprecated.
 */
export const registerSchema = z.object({
  firebaseUid: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  displayName: z.string().min(1).max(50).nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
});

export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
});

export const profileUpdateSchema = z.object({
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

export const youtubeChannelSchema = z.object({
  channelId: z.string().min(1),
  channelName: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type YoutubeChannelInput = z.infer<typeof youtubeChannelSchema>;
