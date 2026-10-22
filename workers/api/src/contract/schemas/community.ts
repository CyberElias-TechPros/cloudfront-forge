/**
 * Community request schemas.
 *
 * Moved verbatim out of `routes/communities.ts` and
 * `routes/community-management.ts` (PLAT-002) so the handlers, the OpenAPI
 * document and both generated clients share one definition.
 */
import { z } from "zod";

export const communityCreateSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(false),
  maxMembers: z.number().min(10).max(10000).default(10000),
});

/** Join by invite code (`POST /communities/join`). */
export const communityJoinByCodeSchema = z.object({
  inviteCode: z.string().min(4).max(20),
});

/** Squad settings — rules are shown on the community page. */
export const communitySettingsSchema = z.object({
  allowPeerReview: z.boolean().optional(),
  allowCollaboration: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
  defaultLanguage: z.string().min(2).max(10).nullable().optional(),
  rules: z.string().max(5000).nullable().optional(),
});

/** Message attached to a join request (`POST /communities/:id/join`). */
export const communityJoinRequestSchema = z.object({
  message: z.string().max(300).optional(),
});

/** Owner-only member role change. */
export const communityMemberRoleSchema = z.object({
  role: z.enum(["member", "moderator"]),
});

export type CommunityCreateInput = z.infer<typeof communityCreateSchema>;
export type CommunitySettingsInput = z.infer<typeof communitySettingsSchema>;
export type CommunityJoinByCodeInput = z.infer<typeof communityJoinByCodeSchema>;
export type CommunityJoinRequestInput = z.infer<typeof communityJoinRequestSchema>;
