/**
 * Response schemas for the read-model endpoints added in PLAT-002.
 *
 * These payloads are assembled from SQL rows, so several of them expose
 * snake_case column names (`created_at`, `display_name`). They are documented
 * exactly as the handlers return them — a contract that "improves" the shape
 * would lie to generated clients. Normalising these to camelCase is tracked as
 * a separate, breaking change in `docs/ROADMAP.md` (PLAT-002 exit criterion:
 * document first, rename with a version bump).
 *
 * Every schema is `.passthrough()` so a handler that adds a field does not
 * break the contract, while a *removed* field still shows up as a missing key
 * in generated clients.
 */
import { z } from "zod";

const id = z.string();
const iso = z.string();
const nullableIso = z.string().nullable();
const nullableString = z.string().nullable();

/** `{ items, total, limit?, offset? }` — the list envelope used by every collection. */
export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    /** Opaque cursor for the next page; `null` on the last page (PLAT-016). */
    nextCursor: z.string().nullable().optional(),
    hasMore: z.boolean().optional(),
  });
}

/** `{ message }` — the acknowledgement every write endpoint returns. */
export const actionMessageSchema = z.object({ message: z.string() }).passthrough();

// --- Communities ----------------------------------------------------------

export const communitySummarySchema = z
  .object({
    id,
    name: z.string(),
    description: nullableString.optional(),
    slug: z.string().optional(),
    is_public: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    max_members: z.number().optional(),
    maxMembers: z.number().optional(),
    logo_url: nullableString.optional(),
    banner_url: nullableString.optional(),
    owner_id: z.string().optional(),
    invite_code: z.string().optional(),
    status: z.string().optional(),
    created_at: iso.optional(),
    updated_at: iso.optional(),
  })
  .passthrough();

export const communityListResponseSchema = paginated(communitySummarySchema);

export const communityMemberSchema = z
  .object({
    id,
    userId: z.string().optional(),
    displayName: nullableString.optional(),
    photoUrl: nullableString.optional(),
    role: z.enum(["owner", "admin", "moderator", "member"]).optional(),
    joined_at: iso.optional(),
    joinedAt: iso.optional(),
  })
  .passthrough();

export const communityMemberListResponseSchema = z
  .object({ members: z.array(communityMemberSchema) })
  .passthrough();

export const communityDetailResponseSchema = z
  .object({
    community: communitySummarySchema,
    memberCount: z.number().optional(),
    members: z.array(communityMemberSchema).optional(),
    settings: z.record(z.unknown()).optional(),
    isOwner: z.boolean().optional(),
    isMember: z.boolean().optional(),
    role: nullableString.optional(),
  })
  .passthrough();

export const communityCreateResponseSchema = z
  .object({
    message: z.string(),
    communityId: id,
    inviteCode: z.string().optional(),
    slug: z.string().optional(),
  })
  .passthrough();

export const communityJoinResponseSchema = z
  .object({
    message: z.string(),
    communityId: id.optional(),
    communityName: z.string().optional(),
    requestId: id.optional(),
    pending: z.boolean().optional(),
  })
  .passthrough();

export const joinRequestSchema = z
  .object({
    id,
    message: nullableString.optional(),
    status: z.string().optional(),
    requestedAt: iso.optional(),
    userId: z.string().optional(),
    displayName: nullableString.optional(),
    photoUrl: nullableString.optional(),
  })
  .passthrough();

export const joinRequestListResponseSchema = z
  .object({ items: z.array(joinRequestSchema) })
  .passthrough();

export const inviteCodeResponseSchema = z
  .object({ message: z.string(), inviteCode: z.string() })
  .passthrough();

// --- Feed -----------------------------------------------------------------

/** `GET /queue` — a video the caller can watch next, plus their watch state. */
export const queueItemSchema = z
  .object({
    id,
    title: nullableString.optional(),
    duration_seconds: z.number().nullable().optional(),
    status: z.string().optional(),
    created_at: iso.optional(),
    user_id: z.string().optional(),
    youtube_video_id: nullableString.optional(),
    youtube_url: nullableString.optional(),
    channel_id: nullableString.optional(),
    magic_word: nullableString.optional(),
    display_name: nullableString.optional(),
    photo_url: nullableString.optional(),
    watch_status: nullableString.optional(),
    xp_awarded: z.number().optional(),
    credits_awarded: z.number().optional(),
  })
  .passthrough();

export const queueResponseSchema = paginated(queueItemSchema);

/** `GET /submissions` — the caller's own videos and the attention they earned. */
export const submissionItemSchema = z
  .object({
    id,
    title: nullableString.optional(),
    status: z.string().optional(),
    created_at: iso.optional(),
    watch_target: z.number().nullable().optional(),
    comment_count: z.number().optional(),
    watcher_count: z.number().optional(),
    subs_count: z.number().optional(),
  })
  .passthrough();

export const submissionListResponseSchema = paginated(submissionItemSchema);

/** `GET /activity` — the unread slice of the notification inbox. */
export const activityItemSchema = z
  .object({
    id,
    type: z.string(),
    title: nullableString.optional(),
    message: nullableString.optional(),
    created_at: iso.optional(),
  })
  .passthrough();

export const activityResponseSchema = paginated(activityItemSchema);

// --- Gamification ---------------------------------------------------------

export const creditTransactionSchema = z
  .object({
    id,
    user_id: z.string().optional(),
    type: z.string().optional(),
    amount: z.number().optional(),
    balance_after: z.number().optional(),
    description: nullableString.optional(),
    reference_id: nullableString.optional(),
    created_at: iso.optional(),
  })
  .passthrough();

export const creditsResponseSchema = z
  .object({
    balance: z.number(),
    totalEarned: z.number().optional(),
    totalSpent: z.number().optional(),
    transactions: z.array(creditTransactionSchema),
  })
  .passthrough();

export const xpTransactionSchema = z
  .object({
    id,
    user_id: z.string().optional(),
    amount: z.number().optional(),
    source: nullableString.optional(),
    description: nullableString.optional(),
    created_at: iso.optional(),
  })
  .passthrough();

export const xpResponseSchema = z
  .object({
    totalXp: z.number(),
    currentLevel: z.number(),
    xpToNextLevel: z.number(),
    transactions: z.array(xpTransactionSchema),
  })
  .passthrough();

export const reputationEventSchema = z
  .object({
    id,
    user_id: z.string().optional(),
    event_type: z.string().optional(),
    points_change: z.number().optional(),
    reason: nullableString.optional(),
    created_at: iso.optional(),
  })
  .passthrough();

export const reputationResponseSchema = z
  .object({ score: z.number(), events: z.array(reputationEventSchema) })
  .passthrough();

export const streaksResponseSchema = z
  .object({
    currentStreak: z.number(),
    longestStreak: z.number(),
    lastActive: nullableIso,
  })
  .passthrough();

export const badgeSchema = z
  .object({
    id,
    name: z.string().optional(),
    description: nullableString.optional(),
    icon: nullableString.optional(),
    earned_at: nullableIso.optional(),
  })
  .passthrough();

/** `GET /badges` returns the rows directly (an array, not a list envelope). */
export const badgeListResponseSchema = z.array(badgeSchema);

export const questSchema = z
  .object({
    id,
    title: z.string().optional(),
    description: nullableString.optional(),
    progress: z.number().optional(),
    target: z.number().optional(),
    completed: z.boolean().optional(),
    xpReward: z.number().optional(),
    creditReward: z.number().optional(),
  })
  .passthrough();

export const dailyQuestListResponseSchema = z
  .object({ items: z.array(questSchema), date: z.string() })
  .passthrough();

export const leaderboardEntrySchema = z
  .object({
    id,
    display_name: nullableString.optional(),
    photo_url: nullableString.optional(),
    total_xp: z.number().optional(),
    credits: z.number().optional(),
    reputation: z.number().optional(),
  })
  .passthrough();

export const leaderboardResponseSchema = paginated(leaderboardEntrySchema).and(
  z.object({ timeframe: z.string().optional(), cohort: z.string().optional() }).passthrough(),
);

export const dailyBonusResponseSchema = z
  .object({ credits: z.number(), multiplier: z.number(), streak: z.number() })
  .passthrough();

// --- Missions -------------------------------------------------------------

export const missionAssignmentSchema = z
  .object({
    id,
    mission_id: z.string().optional(),
    user_id: z.string().optional(),
    status: z.string().optional(),
    title: nullableString.optional(),
    description: nullableString.optional(),
    difficulty: z.string().optional(),
    xp_reward: z.number().optional(),
    credit_reward: z.number().optional(),
    time_estimate_minutes: z.number().optional(),
    assigned_at: iso.optional(),
    completed_at: nullableIso.optional(),
  })
  .passthrough();

export const missionAssignmentListResponseSchema = paginated(missionAssignmentSchema);

export const missionListResponseSchema = paginated(
  z
    .object({
      id,
      title: z.string(),
      description: nullableString.optional(),
      difficulty: z.string().optional(),
      xp_reward: z.number().optional(),
      credit_reward: z.number().optional(),
      assignment_status: nullableString.optional(),
    })
    .passthrough(),
);

export const missionCompleteResponseSchema = z
  .object({
    message: z.string(),
    xpEarned: z.number(),
    creditsEarned: z.number(),
    level: z.number(),
    totalXp: z.number(),
  })
  .passthrough();

export const missionChainResponseSchema = z
  .object({
    message: z.string(),
    chainId: id,
    missions: z.array(z.string()),
    steps: z.number(),
  })
  .passthrough();

// --- Admin ----------------------------------------------------------------

export const adminMetricsResponseSchema = z
  .object({
    users: z.number(),
    communities: z.number(),
    videos: z.number(),
    reviews: z.number(),
    pendingReports: z.number(),
  })
  .passthrough();

export const adminAnalyticsResponseSchema = z
  .object({
    period: z.string(),
    totals: z
      .object({
        submits: z.number(),
        claims: z.number(),
        reviews: z.number(),
        claimRate: z.number(),
      })
      .passthrough(),
    events: z.array(z.object({ event_type: z.string(), count: z.number() }).passthrough()),
    dailyTrend: z.array(
      z.object({ day: z.string(), event_type: z.string(), count: z.number() }).passthrough(),
    ),
  })
  .passthrough();

export const adminRetentionResponseSchema = z
  .object({
    cohorts: z.array(
      z
        .object({
          date: z.string(),
          total: z.number(),
          week1Retention: z.number(),
          week4Retention: z.number(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const adminUserSchema = z
  .object({
    id,
    email: nullableString.optional(),
    display_name: nullableString.optional(),
    photo_url: nullableString.optional(),
    status: z.string().optional(),
    created_at: iso.optional(),
    trust_score: z.number().optional(),
    platform_role: nullableString.optional(),
  })
  .passthrough();

export const adminUserListResponseSchema = paginated(adminUserSchema);

export const adminCommunitySchema = z
  .object({
    id,
    name: z.string(),
    slug: z.string().optional(),
    description: nullableString.optional(),
    status: z.string().optional(),
    is_public: z.boolean().optional(),
    member_count: z.number().optional(),
    owner_name: nullableString.optional(),
    created_at: iso.optional(),
  })
  .passthrough();

export const adminCommunityListResponseSchema = paginated(adminCommunitySchema);

export const adminReportSchema = z
  .object({
    id,
    reason: z.string().optional(),
    resource_type: z.string().optional(),
    resource_id: z.string().optional(),
    status: z.string().optional(),
    created_at: iso.optional(),
    reporter_name: nullableString.optional(),
    reported_name: nullableString.optional(),
    description: nullableString.optional(),
  })
  .passthrough();

export const adminReportListResponseSchema = z
  .object({ items: z.array(adminReportSchema) })
  .passthrough();

export const appealSchema = z
  .object({
    id,
    reason: z.string().optional(),
    status: z.string().optional(),
    createdAt: iso.optional(),
    reviewedAt: nullableIso.optional(),
    note: nullableString.optional(),
    reportId: z.string().optional(),
    userId: z.string().optional(),
    displayName: nullableString.optional(),
  })
  .passthrough();

export const appealListResponseSchema = z.object({ items: z.array(appealSchema) }).passthrough();

// --- Reports & support ----------------------------------------------------

export const myReportSchema = z
  .object({
    id,
    reason: z.string().optional(),
    resource_type: z.string().optional(),
    resource_id: z.string().optional(),
    status: z.string().optional(),
    created_at: iso.optional(),
    resolution_notes: nullableString.optional(),
    appealed: z.boolean().optional(),
  })
  .passthrough();

export const myReportListResponseSchema = z
  .object({ items: z.array(myReportSchema) })
  .passthrough();

export const supportTicketSchema = z
  .object({
    id,
    topic: z.string().optional(),
    message: z.string().optional(),
    status: z.string().optional(),
    createdAt: iso.optional(),
    resolvedAt: nullableIso.optional(),
    displayName: nullableString.optional(),
    email: nullableString.optional(),
  })
  .passthrough();

export const supportTicketListResponseSchema = z
  .object({ items: z.array(supportTicketSchema) })
  .passthrough();

export const supportCreateResponseSchema = z
  .object({ message: z.string(), supportId: id })
  .passthrough();

/** `POST /reports` — the created report id is the only new fact. */
export const reportCreateResponseSchema = z
  .object({ message: z.string(), reportId: id })
  .passthrough();

// --- Top-ups --------------------------------------------------------------

export const topupTierSchema = z
  .object({
    id,
    ngn: z.number().optional(),
    credits: z.number().optional(),
    label: z.string().optional(),
    bonus: z.number().optional(),
  })
  .passthrough();

export const topupRequestRowSchema = z
  .object({
    id,
    user_id: z.string().optional(),
    tier_id: z.string().optional(),
    amount_ngn: z.number().optional(),
    credits_amount: z.number().optional(),
    transfer_reference: nullableString.optional(),
    proof_image_path: nullableString.optional(),
    status: z.string().optional(),
    reject_reason: nullableString.optional(),
    created_at: iso.optional(),
    display_name: nullableString.optional(),
    email: nullableString.optional(),
  })
  .passthrough();

export const topupCatalogResponseSchema = z
  .object({
    tiers: z.array(topupTierSchema),
    bank: z.record(z.unknown()),
    pending: z.boolean(),
  })
  .passthrough();

export const topupCreateResponseSchema = z
  .object({ message: z.string(), request: topupRequestRowSchema })
  .passthrough();

export const topupListResponseSchema = z
  .object({ items: z.array(topupRequestRowSchema) })
  .passthrough();

export const topupApproveResponseSchema = z
  .object({ message: z.string(), credits: z.number(), balance: z.number() })
  .passthrough();

export const proofUploadResponseSchema = z
  .object({ path: z.string(), name: z.string(), type: z.string() })
  .passthrough();

// --- AI -------------------------------------------------------------------

export const aiConversationSchema = z
  .object({
    id,
    title: nullableString.optional(),
    created_at: iso.optional(),
    updated_at: iso.optional(),
  })
  .passthrough();

export const aiConversationListResponseSchema = z
  .object({ conversations: z.array(aiConversationSchema) })
  .passthrough();

export const aiMessageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    created_at: iso.optional(),
  })
  .passthrough();

export const aiMessageListResponseSchema = z
  .object({ messages: z.array(aiMessageSchema) })
  .passthrough();

export const aiChatResponseSchema = z
  .object({
    conversationId: id,
    reply: z.string(),
    conversation: z.object({ id, title: nullableString.optional() }).passthrough(),
  })
  .passthrough();

// --- YouTube --------------------------------------------------------------

export const youtubeAuthorizeResponseSchema = z.object({ authUrl: z.string() }).passthrough();

export const youtubeStatusResponseSchema = z
  .object({ connected: z.boolean(), channelId: nullableString.optional() })
  .passthrough();

// --- Watch ----------------------------------------------------------------

export const watchChallengeResponseSchema = z
  .object({ challengeId: id, question: z.string(), ttlSec: z.number() })
  .passthrough();

export const watchChallengeAnswerResponseSchema = z
  .object({ passed: z.boolean(), attempts: z.number(), voided: z.boolean().optional() })
  .passthrough();

export const watchHeartbeatResponseSchema = z
  .object({
    ok: z.boolean(),
    enabled: z.boolean(),
    accepted: z.boolean().optional(),
    deltaSeconds: z.number().optional(),
    verifiedSeconds: z.number().optional(),
    rejectReason: nullableString.optional(),
  })
  .passthrough();

// --- Search & discovery ---------------------------------------------------

export const searchResponseSchema = z
  .object({
    communities: z.array(communitySummarySchema),
    videos: z.array(queueItemSchema),
  })
  .passthrough();

export const discoverResponseSchema = z
  .object({
    items: z.array(communityMemberSchema.or(adminUserSchema)),
    intent: z.string().optional(),
  })
  .passthrough();

// --- Member views ---------------------------------------------------------

export const memberProfileResponseSchema = z
  .object({
    id,
    displayName: nullableString.optional(),
    photoUrl: nullableString.optional(),
    profile: z.record(z.unknown()).nullable().optional(),
  })
  .passthrough();

export const myProfileResponseSchema = memberProfileResponseSchema.and(
  z
    .object({
      firebaseUid: z.string().optional(),
      email: nullableString.optional(),
      emailVerified: z.boolean().optional(),
      createdAt: iso.optional(),
      updatedAt: iso.optional(),
      deletedAt: nullableIso.optional(),
      lastActive: nullableIso.optional(),
      channels: z.array(z.record(z.unknown())).optional(),
    })
    .passthrough(),
);

export const memberCardResponseSchema = z
  .object({
    id,
    name: z.string(),
    handle: z.string().optional(),
    avatar: z.string().optional(),
    points: z.number(),
    streak: z.number(),
    level: z.number(),
    rank: z.number(),
    niche: nullableString.optional(),
    subsGiven: z.number(),
    subsReceived: z.number().optional(),
  })
  .passthrough();

export const channelListResponseSchema = z
  .object({ items: z.array(z.record(z.unknown())), connected: z.boolean().optional() })
  .passthrough();

export const insightsResponseSchema = z
  .object({
    totals: z
      .object({
        videos: z.number(),
        watchesReceived: z.number(),
        subsReceived: z.number(),
        commentsReceived: z.number(),
        watchMinutesReceived: z.number(),
      })
      .passthrough(),
    videos: z.array(z.record(z.unknown())).optional(),
    trend: z.array(z.record(z.unknown())).optional(),
    averageScore: z.number().nullable().optional(),
    credits: z.number().optional(),
    earnings: z.number().optional(),
    helpfulGiven: z.number().optional(),
    level: z.number().optional(),
    reviews: z.number().optional(),
    reviewsGiven: z.number().optional(),
  })
  .passthrough();

// --- Account --------------------------------------------------------------

export const accountDeleteResponseSchema = z
  .object({ message: z.string(), deletedAt: iso.optional() })
  .passthrough();
