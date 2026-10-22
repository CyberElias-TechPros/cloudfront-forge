/**
 * Request schemas shared by every contract group.
 *
 * These are the schemas handlers actually validate with — the contract is not a
 * parallel description that can drift, it *is* the runtime validation.
 */
import { z } from "zod";

/** Standard list pagination. Defaults mirror the handlers' historical behaviour. */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** A UUID path parameter, used for typed `/…/:id` routes. */
export const uuidParamSchema = z.string().uuid();

/** Opaque, human-typable invite code (matches `communities.invite_code`). */
export const inviteCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, "Invite codes contain letters, numbers, dashes and underscores");

/** Free text that reaches the database only after `sanitize()` runs. */
export const shortText = (max: number) => z.string().trim().min(1).max(max);
export const optionalText = (max: number) => z.string().trim().max(max).optional();

/** ISO-8601 timestamp as used by every response payload. */
export const isoDateTime = z.string().datetime();

export const idSchema = z.object({ id: uuidParamSchema });
