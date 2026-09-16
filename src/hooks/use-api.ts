import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClientService, {
  type Community,
  type CommunityDetail,
  type Mission,
  type MissionAssignment,
  type Review,
  type ReviewAnswerInput,
  type LeaderboardEntry,
  type CreditsSummary,
  type XpSummary,
  type StreakInfo,
  type CreateCommunityInput,
  type AdminMetrics,
  type CurrentMember,
  type QueueTask,
  type SubmissionDTO,
  type ActivityItem,
  type Member,
  type PaginatedResponse,
  type NotificationPreferences,
  type UserPermissions,
  type TopupRequest,
  type TopupAdminItem,
  type CreatorInsights,
  type DiscoverMember,
  type JoinRequest,
  type Appeal,
  type SupportRequest,
  type CommunitySettingsInput,
  type ReportAgainstMe,
} from "@/lib/api-client";

const queryKeys = {
  communities: ["communities"] as const,
  community: (id: string) => ["communities", id] as const,
  missions: ["missions"] as const,
  assignments: ["missions", "assignments"] as const,
  reviews: ["reviews"] as const,
  review: (id: string) => ["reviews", id] as const,
  credits: ["gamification", "credits"] as const,
  xp: ["gamification", "xp"] as const,
  streaks: ["gamification", "streaks"] as const,
  badges: ["gamification", "badges"] as const,
  leaderboard: ["gamification", "leaderboard"] as const,
  profile: ["users", "me", "profile"] as const,
  creatorInsights: ["users", "me", "insights"] as const,
  discoverCollaborators: (intent: string) => ["discover", "collaborators", intent] as const,
  notifications: ["notifications"] as const,
  notificationPreferences: ["notifications", "preferences"] as const,
  adminMetrics: ["admin", "metrics"] as const,
  adminReports: (status: string) => ["admin", "reports", status] as const,
  adminUsers: (status: string) => ["admin", "users", status] as const,
  adminTopups: (status: string) => ["admin", "topups", status] as const,
  topupCatalog: ["topups", "catalog"] as const,
  myTopups: ["topups", "mine"] as const,
  userPermissions: ["auth", "permissions"] as const,
};

function shouldRetryAuth(failureCount: number, error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("429") || msg.includes("Too many requests") || msg.includes("RATE_LIMITED"))
    return false;
  if (
    msg.includes("401") ||
    msg.includes("Authentication required") ||
    msg.includes("AUTH_REQUIRED")
  )
    return false;
  return failureCount < 1;
}

function mapCommunity(c: {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  isPublic: boolean;
  maxMembers: number;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  createdAt: string;
  memberCount?: number;
  isOwner?: boolean;
  ownerName?: string | null;
  inviteCode?: string | null;
  niche?: string;
  thumbHue?: number;
  updatedAt?: string;
}): Community {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    slug: c.slug,
    isPublic: c.isPublic,
    maxMembers: c.maxMembers,
    logoUrl: c.logoUrl ?? null,
    bannerUrl: c.bannerUrl ?? null,
    createdAt: c.createdAt,
    memberCount: c.memberCount ?? 0,
    isOwner: c.isOwner ?? false,
    ownerName: c.ownerName ?? null,
    inviteCode: c.inviteCode ?? null,
    niche: c.niche ?? "Creator",
    thumbHue: c.thumbHue ?? 220,
    updatedAt: c.updatedAt ?? c.createdAt,
  };
}

export function useCommunities() {
  return useQuery({
    queryKey: queryKeys.communities,
    queryFn: async (): Promise<Community[]> => {
      const data = await apiClientService.communities.list();
      return data.items.map(mapCommunity);
    },
  });
}

export function useCommunity(communityId: string) {
  return useQuery({
    queryKey: queryKeys.community(communityId),
    queryFn: async () => {
      const data = await apiClientService.communities.get(communityId);
      return data as CommunityDetail;
    },
  });
}

export function useCreateCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCommunityInput) => apiClientService.communities.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
    },
  });
}

export function useJoinCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteCode: string) => apiClientService.communities.join(inviteCode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
    },
  });
}

function mapMissionAssignment(a: {
  id: string;
  missionId?: string;
  title: string;
  description: string | null;
  difficulty?: string;
  xpReward?: number;
  creditReward?: number;
  status?: string;
  assignedAt?: string;
  dueAt?: string;
}): MissionAssignment {
  return {
    id: a.id,
    missionId: a.missionId ?? a.id,
    title: a.title,
    description: a.description ?? "",
    reward: { xp: a.xpReward ?? 0, credits: a.creditReward ?? 0 },
    category: "Mission",
    difficulty: (a.difficulty as MissionAssignment["difficulty"]) ?? "medium",
    status: (a.status as MissionAssignment["status"]) ?? "assigned",
    progress: a.status === "completed" ? 100 : 0,
    total: 100,
    assignedAt: a.assignedAt ?? new Date().toISOString(),
    dueAt: a.dueAt ?? new Date().toISOString(),
    claimed: false,
  };
}

export function useMissionAssignments() {
  return useQuery({
    queryKey: queryKeys.assignments,
    queryFn: async () => {
      const data = await apiClientService.missions.assignments();
      return data.items.map(mapMissionAssignment);
    },
  });
}

function mapMission(raw: {
  id: string;
  title: string;
  description?: string | null;
  difficulty?: string;
  xpReward?: number;
  creditReward?: number;
  timeEstimateMinutes?: number;
  isAssigned?: number | boolean;
  isCompleted?: number | boolean;
}): Mission {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? "",
    reward: { xp: raw.xpReward ?? 0, credits: raw.creditReward ?? 0 },
    category: "Mission",
    difficulty: (raw.difficulty as Mission["difficulty"]) ?? "medium",
    estimatedTimeMins: raw.timeEstimateMinutes ?? 15,
  };
}

export function useMissions() {
  return useQuery({
    queryKey: queryKeys.missions,
    queryFn: async () => {
      const data = (await apiClientService.missions.list()) as PaginatedResponse<{
        id: string;
        title: string;
        description?: string | null;
        difficulty?: string;
        xpReward?: number;
        creditReward?: number;
        timeEstimateMinutes?: number;
      }>;
      return data.items.map(mapMission);
    },
  });
}

export function useAssignMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (missionId: string) => apiClientService.missions.assign(missionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.missions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assignments });
    },
  });
}

export function useCompleteMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => apiClientService.missions.complete(assignmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assignments });
    },
  });
}

export function useSkipMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => apiClientService.missions.skip(assignmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assignments });
    },
  });
}

export function useCreateReport() {
  return useMutation({
    mutationFn: (data: {
      resourceType: string;
      resourceId: string;
      reason: string;
      description?: string;
      reportedUserId?: string;
    }) => apiClientService.reports.create(data),
  });
}

export function useAdminAnalytics(days = 30) {
  return useQuery({
    queryKey: ["admin", "analytics", days],
    queryFn: () => apiClientService.admin.analytics(days),
    refetchInterval: 300_000,
  });
}

export function useAdminRetention() {
  return useQuery({
    queryKey: ["admin", "retention"],
    queryFn: () => apiClientService.admin.retention(),
    refetchInterval: 600_000,
  });
}

export function useAttentionChallenge() {
  return useMutation({
    mutationFn: (videoId: string) => apiClientService.watch.challenge(videoId),
  });
}

export function useAnswerChallenge() {
  return useMutation({
    mutationFn: ({ challengeId, answer }: { challengeId: string; answer: string }) =>
      apiClientService.watch.answerChallenge(challengeId, answer),
  });
}

export function useAppealReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, reason }: { reportId: string; reason: string }) =>
      apiClientService.reports.appeal(reportId, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reports", "mine"] });
    },
  });
}

export function useMyReports() {
  return useQuery({
    queryKey: ["reports", "mine"],
    queryFn: async (): Promise<ReportAgainstMe[]> => {
      const res = await apiClientService.reports.mine();
      return res.items;
    },
  });
}

export function useDailyQuests() {
  return useQuery({
    queryKey: [...queryKeys.notifications, "daily-quests"],
    queryFn: async () => {
      return await apiClientService.quests.daily();
    },
    refetchInterval: 120_000,
  });
}

export function useShop() {
  return useQuery({
    queryKey: ["shop"],
    queryFn: async () => {
      const data = await apiClientService.shop.list();
      return data.items;
    },
  });
}

export function usePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { itemType: "boost" | "streak_freeze"; videoId?: string }) =>
      apiClientService.shop.purchase(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.credits });
      void queryClient.invalidateQueries({ queryKey: ["feed", "submissions"] });
    },
  });
}

export function useDailyBonus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClientService.gamification.dailyBonus(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.credits });
    },
  });
}

export function useTopupCatalog() {
  return useQuery({
    queryKey: queryKeys.topupCatalog,
    queryFn: async () => {
      return await apiClientService.topups.catalog();
    },
  });
}

export function useMyTopups() {
  return useQuery({
    queryKey: queryKeys.myTopups,
    queryFn: async (): Promise<TopupRequest[]> => {
      const res = await apiClientService.topups.mine();
      return res.items;
    },
  });
}

export function useRequestTopup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      tierId: string;
      proofImage?: string;
      proofImageName?: string;
      proofImageType?: string;
      transferReference?: string;
    }) => apiClientService.topups.request(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.topupCatalog });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myTopups });
    },
  });
}

export function useUploadTopupProof() {
  return useMutation({
    mutationFn: (file: File) => apiClientService.topups.uploadProof(file),
  });
}

export function useAdminTopups(status: "pending" | "approved" | "rejected" = "pending") {
  return useQuery({
    queryKey: queryKeys.adminTopups(status),
    queryFn: async (): Promise<TopupAdminItem[]> => {
      const res = await apiClientService.topups.adminList(status);
      return res.items;
    },
  });
}

export function useApproveTopup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClientService.topups.approve(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "topups"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.credits });
    },
  });
}

export function useRejectTopup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiClientService.topups.reject(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "topups"] });
    },
  });
}

export function useReviewHelpful() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, helpful }: { reviewId: string; helpful: boolean }) =>
      apiClientService.reviews.helpful(reviewId, helpful),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews });
    },
  });
}

export function useReviews() {
  return useQuery({
    queryKey: queryKeys.reviews,
    queryFn: async () => {
      const data = await apiClientService.reviews.list();
      return data.items as Review[];
    },
  });
}

export interface ReviewDetailData {
  review: Review;
  questions: { id: string; text: string; type?: string }[];
  answers: { questionId: string; answer: string | number | boolean }[];
}

type RawReview = {
  id?: unknown;
  videoId?: unknown;
  videoTitle?: unknown;
  videoThumbnail?: unknown;
  youtubeUrl?: unknown;
  submitterId?: unknown;
  submitterName?: unknown;
  reviewerId?: unknown;
  reviewerName?: unknown;
  status?: unknown;
  score?: unknown;
  feedbackText?: unknown;
  assignedAt?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
  dueAt?: unknown;
};

type RawQuestion = {
  id?: unknown;
  questionText?: unknown;
  question_text?: unknown;
  text?: unknown;
  questionType?: unknown;
  question_type?: unknown;
  type?: unknown;
};

export function useReview(reviewId: string) {
  return useQuery({
    queryKey: queryKeys.review(reviewId),
    queryFn: async (): Promise<ReviewDetailData> => {
      const data = await apiClientService.reviews.get(reviewId);
      const raw = data as unknown as {
        review: RawReview;
        questions: Array<RawQuestion>;
        answers: Array<{ questionId?: string; ratingValue?: number; textAnswer?: string }>;
      };
      const r = raw.review;
      return {
        review: {
          id: String(r.id ?? reviewId),
          videoId: String(r.videoId ?? ""),
          videoTitle: String(r.videoTitle ?? ""),
          videoThumbnail: (r.videoThumbnail as string | null) ?? null,
          youtubeUrl: String(r.youtubeUrl ?? ""),
          submitterId: String(r.submitterId ?? ""),
          submitterName: String(r.submitterName ?? ""),
          reviewerId: String(r.reviewerId ?? ""),
          reviewerName: String(r.reviewerName ?? ""),
          status: (r.status as Review["status"]) ?? "completed",
          score: (r.score as number | null) ?? null,
          feedbackText: (r.feedbackText as string | null) ?? null,
          assignedAt: String(r.assignedAt ?? new Date().toISOString()),
          startedAt: (r.startedAt as string | null) ?? null,
          completedAt: (r.completedAt as string | null) ?? null,
          dueAt: String(r.dueAt ?? new Date().toISOString()),
        },
        questions: (raw.questions ?? []).map((q) => ({
          id: String(q.id),
          text: String(q.questionText ?? q.question_text ?? q.text ?? ""),
          type: String(q.questionType ?? q.question_type ?? q.type ?? "rating"),
        })),
        answers: (raw.answers ?? []).map((a) => {
          const q = (raw.questions ?? []).find((x) => String(x.id) === String(a.questionId));
          const qType = String(q?.questionType ?? q?.question_type ?? q?.type ?? "rating");
          let value: string | number | boolean = "";
          if (typeof a.ratingValue === "number") {
            value = qType === "yes_no" ? a.ratingValue === 1 : a.ratingValue;
          } else if (typeof a.textAnswer === "string") {
            value = a.textAnswer;
          }
          return { questionId: String(a.questionId ?? ""), answer: value };
        }),
      };
    },
  });
}

export function useStartReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => apiClientService.reviews.start(reviewId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews });
    },
  });
}

export function useCompleteReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      reviewId: string;
      score?: number;
      feedbackText?: string;
      answers?: ReviewAnswerInput[];
    }) => {
      const payload: {
        score?: number;
        feedbackText?: string;
        answers?: ReviewAnswerInput[];
      } = { answers: args.answers ?? [] };
      if (typeof args.score === "number") payload.score = args.score;
      if (args.feedbackText) payload.feedbackText = args.feedbackText;
      return apiClientService.reviews.complete(args.reviewId, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews });
    },
  });
}

export function useCredits() {
  return useQuery({
    queryKey: queryKeys.credits,
    queryFn: async (): Promise<CreditsSummary> => {
      return await apiClientService.gamification.credits();
    },
  });
}

export function useXp() {
  return useQuery({
    queryKey: queryKeys.xp,
    queryFn: async (): Promise<XpSummary> => {
      return await apiClientService.gamification.xp();
    },
  });
}

export function useStreaks() {
  return useQuery({
    queryKey: queryKeys.streaks,
    queryFn: async (): Promise<StreakInfo> => {
      return await apiClientService.gamification.streaks();
    },
  });
}

export function useLeaderboard(cohort?: string) {
  return useQuery({
    queryKey: [...queryKeys.leaderboard, cohort ?? "all"],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const data = await apiClientService.gamification.leaderboard(cohort);
      return data.items;
    },
  });
}

export function useBadges() {
  return useQuery({
    queryKey: queryKeys.badges,
    queryFn: async () => {
      const data = (await apiClientService.gamification.badges()) as Array<{
        name: string;
        description: string;
        icon?: string;
        earnedAt?: string | null;
      }>;
      return data.map((b) => ({
        name: b.name,
        desc: b.description,
        earned: Boolean(b.earnedAt),
        icon: b.icon ?? "Award",
      }));
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: async () => {
      const data = await apiClientService.notifications.list();
      return data.items;
    },
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [...queryKeys.notifications, "unread-count"],
    queryFn: async () => {
      const data = await apiClientService.notifications.unreadCount();
      return data.total ?? 0;
    },
    refetchInterval: 60_000,
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClientService.notifications.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClientService.notifications.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notificationPreferences,
    queryFn: async () => {
      return await apiClientService.notifications.preferences();
    },
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NotificationPreferences>) =>
      apiClientService.notifications.updatePreferences(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences });
    },
  });
}

export function useMyProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => {
      return await apiClientService.users.profile();
    },
  });
}

export function useAdminMetrics() {
  return useQuery({
    queryKey: queryKeys.adminMetrics,
    queryFn: async (): Promise<AdminMetrics> => {
      return await apiClientService.admin.metrics();
    },
  });
}

export function useAdminReports(status = "pending") {
  return useQuery({
    queryKey: queryKeys.adminReports(status),
    queryFn: async () => {
      return await apiClientService.admin.reports(status);
    },
  });
}

export function useAdminUsers(status = "active") {
  return useQuery({
    queryKey: queryKeys.adminUsers(status),
    queryFn: async () => {
      return await apiClientService.admin.users(status);
    },
  });
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { reportId: string; status: "resolved" | "dismissed"; notes?: string }) =>
      apiClientService.admin.resolveReport(args.reportId, {
        status: args.status,
        ...(args.notes ? { resolutionNotes: args.notes } : {}),
      }),
    onSuccess: (_data, _variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "reports"],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMetrics });
    },
  });
}

function currentMemberFromApi(m: CurrentMember): Member {
  return {
    id: m.id,
    name: m.name,
    handle: m.handle,
    avatar: m.avatar,
    points: m.points,
    streak: m.streak,
    level: m.level,
    rank: m.rank,
    niche: m.niche,
    subsGiven: m.subsGiven,
    subsReceived: m.subsReceived,
    watchMinutes: m.watchMinutes,
    trustScore: m.trustScore,
    isAdmin: m.isAdmin,
  };
}

export function useCurrentMember() {
  return useQuery({
    queryKey: ["users", "me", "member"],
    queryFn: async (): Promise<Member> => {
      const data = await apiClientService.users.member();
      return currentMemberFromApi(data);
    },
    retry: shouldRetryAuth,
    enabled: typeof window !== "undefined" && !!localStorage.getItem("authToken"),
  });
}

export function useCreatorInsights() {
  return useQuery({
    queryKey: queryKeys.creatorInsights,
    queryFn: async (): Promise<CreatorInsights> => {
      return await apiClientService.users.insights();
    },
    retry: shouldRetryAuth,
    enabled: typeof window !== "undefined" && !!localStorage.getItem("authToken"),
  });
}

export function useCollaborators(intent: string) {
  return useQuery({
    queryKey: queryKeys.discoverCollaborators(intent),
    queryFn: async (): Promise<DiscoverMember[]> => {
      const res = await apiClientService.discover.collaborators(intent);
      return res.items;
    },
    retry: shouldRetryAuth,
    enabled: typeof window !== "undefined" && !!localStorage.getItem("authToken"),
  });
}

export function useUserPermissions() {
  return useQuery({
    queryKey: queryKeys.userPermissions,
    queryFn: async (): Promise<UserPermissions> => {
      return await apiClientService.auth.permissions();
    },
    retry: shouldRetryAuth,
    enabled: typeof window !== "undefined" && !!localStorage.getItem("authToken"),
  });
}

export function useQueueTasks(communityId?: string) {
  return useQuery({
    queryKey: ["feed", "queue", communityId ?? "all"],
    queryFn: async (): Promise<QueueTask[]> => {
      const data = await apiClientService.feed.queue(communityId);
      return data.items;
    },
    retry: shouldRetryAuth,
  });
}

export function useSubmissions() {
  return useQuery({
    queryKey: ["feed", "submissions"],
    queryFn: async (): Promise<SubmissionDTO[]> => {
      const data = await apiClientService.feed.submissions();
      return data.items;
    },
    retry: shouldRetryAuth,
  });
}

export function useSubmitVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      youtubeUrl: string;
      communityId?: string;
      title?: string;
      magicWord?: string;
      niche?: string;
    }) => apiClientService.videos.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feed", "submissions"] });
    },
  });
}

export function useWatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      videoId: string;
      watchSeconds: number;
      subscribed: boolean;
      commented: boolean;
      sessionToken?: string;
    }) => apiClientService.watch.submit(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feed", "queue"] });
      void queryClient.invalidateQueries({ queryKey: ["users", "me", "member"] });
      void queryClient.invalidateQueries({ queryKey: ["gamification", "leaderboard"] });
    },
  });
}

export function useActivity() {
  return useQuery({
    queryKey: ["feed", "activity"],
    queryFn: async (): Promise<ActivityItem[]> => {
      const data = await apiClientService.feed.activity();
      return data.items;
    },
    retry: shouldRetryAuth,
  });
}

export function useYouTubeStatus() {
  return useQuery({
    queryKey: ["youtube", "status"],
    queryFn: async () => {
      return await apiClientService.youtube.status();
    },
  });
}

export function useConnectYouTube() {
  return useMutation({
    mutationFn: async () => {
      const result = await apiClientService.youtube.authorize();
      if (!result.authUrl) {
        throw new Error("Missing auth URL from backend");
      }
      return result.authUrl;
    },
    onSuccess: (authUrl) => {
      window.open(authUrl, "_blank", "width=500,height=700");
    },
  });
}

export function useDisconnectYouTube() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return await apiClientService.youtube.disconnect();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["youtube", "status"] });
    },
  });
}

export function useSearch(query?: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      if (!query) {
        return { communities: [], videos: [] };
      }
      return await apiClientService.search.search(query);
    },
  });
}

/* ---------------- account lifecycle ---------------- */

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => apiClientService.account.delete(),
  });
}

/* ---------------- community management ---------------- */

export function useLeaveCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (communityId: string) => apiClientService.communities.leave(communityId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
      void queryClient.invalidateQueries({ queryKey: ["feed", "queue"] });
    },
  });
}

export function useJoinPublicCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ communityId, message }: { communityId: string; message?: string }) =>
      apiClientService.communities.joinPublic(communityId, message),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
    },
  });
}

export function useCommunityRequests(communityId: string, enabled = true) {
  return useQuery({
    queryKey: ["communities", communityId, "requests"],
    queryFn: async (): Promise<JoinRequest[]> => {
      const res = await apiClientService.communities.requests(communityId);
      return res.items;
    },
    enabled,
    refetchInterval: 60_000,
  });
}

export function useReviewJoinRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      communityId,
      requestId,
      approve,
    }: {
      communityId: string;
      requestId: string;
      approve: boolean;
    }) =>
      approve
        ? apiClientService.communities.approveRequest(communityId, requestId)
        : apiClientService.communities.rejectRequest(communityId, requestId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["communities", variables.communityId, "requests"],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.community(variables.communityId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
    },
  });
}

export function useSetMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      communityId,
      userId,
      role,
    }: {
      communityId: string;
      userId: string;
      role: "member" | "moderator";
    }) => apiClientService.communities.setMemberRole(communityId, userId, role),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.community(variables.communityId) });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ communityId, userId }: { communityId: string; userId: string }) =>
      apiClientService.communities.removeMember(communityId, userId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.community(variables.communityId) });
    },
  });
}

export function useRegenerateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (communityId: string) => apiClientService.communities.regenerateInvite(communityId),
    onSuccess: (_data, communityId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.community(communityId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
    },
  });
}

export function useUpdateCommunitySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      communityId,
      settings,
    }: {
      communityId: string;
      settings: CommunitySettingsInput;
    }) => apiClientService.communities.updateSettings(communityId, settings),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.community(variables.communityId) });
    },
  });
}

export function useArchiveCommunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (communityId: string) => apiClientService.communities.archive(communityId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
      void queryClient.invalidateQueries({ queryKey: ["feed", "queue"] });
      void queryClient.invalidateQueries({ queryKey: ["feed", "submissions"] });
    },
  });
}

/* ---------------- video lifecycle ---------------- */

export function useArchiveVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (videoId: string) => apiClientService.videos.archive(videoId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feed", "submissions"] });
      void queryClient.invalidateQueries({ queryKey: ["feed", "queue"] });
    },
  });
}

/* ---------------- support ---------------- */

export function useSubmitSupport() {
  return useMutation({
    mutationFn: (data: {
      topic: "account" | "credits" | "community" | "video" | "moderation" | "bug" | "other";
      message: string;
    }) => apiClientService.support.create(data),
  });
}

export function useAdminSupport(status: "open" | "resolved" = "open") {
  return useQuery({
    queryKey: ["admin", "support", status],
    queryFn: async (): Promise<SupportRequest[]> => {
      const res = await apiClientService.admin.support(status);
      return res.items;
    },
  });
}

export function useResolveSupport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (supportId: string) => apiClientService.admin.resolveSupport(supportId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "support"] });
    },
  });
}

/* ---------------- admin moderation ---------------- */

export function useAdminAppeals(status: "pending" | "accepted" | "rejected" = "pending") {
  return useQuery({
    queryKey: ["admin", "appeals", status],
    queryFn: async (): Promise<Appeal[]> => {
      const res = await apiClientService.admin.appeals(status);
      return res.items;
    },
  });
}

export function useReviewAppeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      appealId,
      status,
      note,
    }: {
      appealId: string;
      status: "accepted" | "rejected";
      note?: string | undefined;
    }) => apiClientService.admin.reviewAppeal(appealId, { status, ...(note ? { note } : {}) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "appeals"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminReports("pending") });
    },
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string | undefined }) =>
      apiClientService.admin.suspendUser(userId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useReinstateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiClientService.admin.reinstateUser(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "moderator" | "admin" | null }) =>
      apiClientService.admin.setUserRole(userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}
