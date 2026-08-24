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
  notifications: ["notifications"] as const,
  notificationPreferences: ["notifications", "preferences"] as const,
  adminMetrics: ["admin", "metrics"] as const,
  adminReports: (status: string) => ["admin", "reports", status] as const,
  adminUsers: (status: string) => ["admin", "users", status] as const,
  userPermissions: ["auth", "permissions"] as const,
};

function shouldRetryAuth(failureCount: number, error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("429") || msg.includes("Too many requests") || msg.includes("RATE_LIMITED")) return false;
  if (msg.includes("401") || msg.includes("Authentication required") || msg.includes("AUTH_REQUIRED")) return false;
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
      try {
        const data = await apiClientService.communities.list();
        return data.items.map(mapCommunity);
      } catch (error) {
        console.warn("[useCommunities] API unavailable:", error);
        return [];
      }
    },
  });
}

export function useCommunity(communityId: string) {
  return useQuery({
    queryKey: queryKeys.community(communityId),
    queryFn: async () => {
      try {
        const data = await apiClientService.communities.get(communityId);
        return data as CommunityDetail;
      } catch (error) {
        console.warn("[useCommunity] API unavailable, using mock data:", error);
        throw error;
      }
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
    missionId: a.id,
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
      try {
        const data = await apiClientService.missions.assignments();
        return data.items.map(mapMissionAssignment);
      } catch (error) {
        console.warn("[useMissionAssignments] API unavailable:", error);
        return [];
      }
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
      try {
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
      } catch (error) {
        console.warn("[useMissions] API unavailable:", error);
        return [];
      }
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
    mutationFn: (assignmentId: string) =>
      apiClientService.missions.skip(assignmentId),
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
  return useMutation({
    mutationFn: ({ reportId, reason }: { reportId: string; reason: string }) =>
      apiClientService.reports.appeal(reportId, { reason }),
  });
}

export function useDailyQuests() {
  return useQuery({
    queryKey: [...queryKeys.notifications, "daily-quests"],
    queryFn: async () => {
      try {
        return await apiClientService.quests.daily();
      } catch {
        return { items: [], date: "" };
      }
    },
    refetchInterval: 120_000,
  });
}

export function useShop() {
  return useQuery({
    queryKey: ["shop"],
    queryFn: async () => {
      try {
        const data = await apiClientService.shop.list();
        return data.items;
      } catch {
        return [];
      }
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

export function useReviews() {
  return useQuery({
    queryKey: queryKeys.reviews,
    queryFn: async () => {
      try {
        const data = await apiClientService.reviews.list();
        return data.items as Review[];
      } catch (error) {
        console.warn("[useReviews] API unavailable:", error);
        return [];
      }
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
      try {
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
      } catch (error) {
        console.warn("[useReview] API unavailable:", error);
        throw error;
      }
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
    queryFn: async () => {
      try {
        return await apiClientService.gamification.credits();
      } catch (error) {
        console.warn("[useCredits] API unavailable:", error);
        return { balance: 0, totalEarned: 0, totalSpent: 0 } as CreditsSummary;
      }
    },
  });
}

export function useXp() {
  return useQuery({
    queryKey: queryKeys.xp,
    queryFn: async () => {
      try {
        return await apiClientService.gamification.xp();
      } catch (error) {
        console.warn("[useXp] API unavailable:", error);
        return { totalXp: 0, currentLevel: 1, xpToNextLevel: 0 } as XpSummary;
      }
    },
  });
}

export function useStreaks() {
  return useQuery({
    queryKey: queryKeys.streaks,
    queryFn: async () => {
      try {
        return await apiClientService.gamification.streaks();
      } catch (error) {
        console.warn("[useStreaks] API unavailable:", error);
        return {
          currentStreak: 0,
          longestStreak: 0,
          lastActive: new Date().toISOString(),
        } as StreakInfo;
      }
    },
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: queryKeys.leaderboard,
    queryFn: async () => {
      try {
        const data = await apiClientService.gamification.leaderboard();
        return data.items;
      } catch (error) {
        console.warn("[useLeaderboard] API unavailable:", error);
        return [] as LeaderboardEntry[];
      }
    },
  });
}

export function useBadges() {
  return useQuery({
    queryKey: queryKeys.badges,
    queryFn: async () => {
      try {
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
      } catch (error) {
        console.warn("[useBadges] API unavailable:", error);
        return [];
      }
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: async () => {
      try {
        const data = await apiClientService.notifications.list();
        return data.items;
      } catch (error) {
        console.warn("[useNotifications] API unavailable, using empty data:", error);
        return [];
      }
    },
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [...queryKeys.notifications, "unread-count"],
    queryFn: async () => {
      try {
        const data = await apiClientService.notifications.unreadCount();
        return data.total ?? 0;
      } catch {
        return 0;
      }
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
      try {
        return await apiClientService.notifications.preferences();
      } catch (error) {
        console.warn("[useNotificationPreferences] API unavailable:", error);
        return {
          emailEnabled: true,
          pushEnabled: true,
          whatsappEnabled: false,
          inAppEnabled: true,
          missionReminders: true,
          reviewRequests: true,
          communityUpdates: true,
        } as NotificationPreferences;
      }
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
      try {
        return await apiClientService.users.profile();
      } catch (error) {
        console.warn("[useMyProfile] API unavailable, using mock data:", error);
        throw error;
      }
    },
  });
}

export function useAdminMetrics() {
  return useQuery({
    queryKey: queryKeys.adminMetrics,
    queryFn: async () => {
      try {
        return await apiClientService.admin.metrics();
      } catch (error) {
        console.warn("[useAdminMetrics] API unavailable:", error);
        return {
          users: 0,
          communities: 0,
          videos: 0,
          reviews: 0,
          pendingReports: 0,
        } as AdminMetrics;
      }
    },
  });
}

export function useAdminReports(status = "pending") {
  return useQuery({
    queryKey: queryKeys.adminReports(status),
    queryFn: async () => {
      try {
        return await apiClientService.admin.reports(status);
      } catch (error) {
        console.warn("[useAdminReports] API unavailable:", error);
        return [];
      }
    },
  });
}

export function useAdminUsers(status = "active") {
  return useQuery({
    queryKey: queryKeys.adminUsers(status),
    queryFn: async () => {
      try {
        return await apiClientService.admin.users(status);
      } catch (error) {
        console.warn("[useAdminUsers] API unavailable, using empty data:", error);
        return [];
      }
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

export function useUserPermissions() {
  return useQuery({
    queryKey: queryKeys.userPermissions,
    queryFn: async (): Promise<UserPermissions> => {
      try {
        return await apiClientService.auth.permissions();
      } catch (error) {
        console.warn("[useUserPermissions] API unavailable:", error);
        return { userId: "", role: "member", permissions: ["read"] };
      }
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
    mutationFn: (data: { youtubeUrl: string; communityId?: string; title?: string; magicWord?: string }) =>
      apiClientService.videos.create(data),
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
