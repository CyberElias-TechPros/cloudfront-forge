/**
 * Moderation, safety and admin-action request schemas.
 *
 * Moved verbatim out of `routes/reports.ts`, `routes/admin.ts` and
 * `routes/topups.ts` (PLAT-002).
 */
import { z } from "zod";

/** `POST /reports` — a member flags a video, review, comment, user or squad. */
export const reportCreateSchema = z.object({
  reportedUserId: z.string().uuid().optional(),
  resourceType: z.enum(["video", "review", "comment", "user", "community"]),
  resourceId: z.string().min(1),
  reason: z.enum(["spam", "inappropriate", "harassment", "cheating", "misleading", "other"]),
  description: z.string().max(1000).optional(),
});

/** `POST /reports/:id/appeal` — the named member contests a report. */
export const reportAppealSchema = z.object({
  reason: z.string().min(10).max(2000),
});

/** `POST /admin/appeals/:id` — moderator accepts or rejects an appeal. */
export const appealReviewSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  note: z.string().max(2000).optional(),
});

/** `POST /admin/reports/:id/resolve` — moderator closes a report. */
export const reportResolveSchema = z.object({
  status: z.enum(["resolved", "dismissed"]),
  resolutionNotes: z.string().max(2000).optional(),
});

/** `POST /admin/users/:id/suspend` — reason is shown to the member. */
export const userSuspendSchema = z.object({
  reason: z.string().max(500).optional(),
});

/** `POST /admin/users/:id/role` — `null` removes the platform role. */
export const userRoleChangeSchema = z.object({
  role: z.enum(["moderator", "admin"]).nullable(),
});

/** `POST /admin/topups/:id/reject` — reason is surfaced to the payer. */
export const topupRejectSchema = z.object({
  reason: z.string().max(500).optional(),
});

/** `POST /support` — the member support channel. */
export const supportRequestSchema = z.object({
  topic: z.enum(["account", "credits", "community", "video", "moderation", "bug", "other"]),
  message: z.string().min(10).max(2000),
});

/**
 * `POST /ai/chat` and `POST /ai/chat/stream`.
 *
 * `message` is trimmed and required; `conversationId` continues an existing
 * thread (the handler verifies the thread belongs to the caller).
 */
export const aiChatSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
});

/** `POST /notifications` — admin/system notification creation. */
export const notificationCreateSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  data: z.record(z.any()).optional(),
});

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ReportAppealInput = z.infer<typeof reportAppealSchema>;
export type AppealReviewInput = z.infer<typeof appealReviewSchema>;
export type ReportResolveInput = z.infer<typeof reportResolveSchema>;
export type SupportRequestInput = z.infer<typeof supportRequestSchema>;
export type AiChatInput = z.infer<typeof aiChatSchema>;
export type NotificationCreateInput = z.infer<typeof notificationCreateSchema>;
