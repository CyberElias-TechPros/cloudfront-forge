import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClientService, {
  type Community,
  type CommunityDetail,
  type Mission,
  type MissionAssignment,
  type Review,
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
  adminMetrics: ["admin", "metrics"] as const,
  adminReports: (status: string) => ["admin", "reports", status] as const,
  adminUsers: (status: string) => ["admin", "users", status] as const,
};

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
        return data.map(mapCommunity);
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
        return data.map(mapMissionAssignment);
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
  description: string | null;
  difficulty?: string;
  xp_reward?: number;
  credit_reward?: number;
  time_estimate_minutes?: number;
  is_assigned?: number | boolean;
  is_completed?: number | boolean;
}): Mission {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? "",
    reward: { xp: raw.xp_reward ?? 0, credits: raw.credit_reward ?? 0 },
    category: "Mission",
    difficulty: (raw.difficulty as Mission["difficulty"]) ?? "medium",
    estimatedTimeMins: raw.time_estimate_minutes ?? 15,
  };
}

export function useMissions() {
  return useQuery({
    queryKey: queryKeys.missions,
    queryFn: async () => {
      try {
        const data = await apiClientService.missions.list();
        return (data as unknown as Array<Parameters<typeof mapMission>[0]>).map(mapMission);
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

export function useReviews() {
  return useQuery({
    queryKey: queryKeys.reviews,
    queryFn: async () => {
      try {
        return await apiClientService.reviews.list();
      } catch (error) {
        console.warn("[useReviews] API unavailable:", error);
        return [];
      }
    },
  });
}

export interface ReviewDetailData {
  review: Review;
  questions: { id: string; text: string }[];
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

export function useReview(reviewId: string) {
  return useQuery({
    queryKey: queryKeys.review(reviewId),
    queryFn: async (): Promise<ReviewDetailData> => {
      try {
        const data = await apiClientService.reviews.get(reviewId);
        const raw = data as unknown as {
          review: RawReview;
          questions: Array<{ id: string; questionText?: string; text?: string }>;
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
            text: String(q.questionText ?? q.text ?? ""),
          })),
          answers: (raw.answers ?? []).map((a) => ({
            questionId: String(a.questionId ?? ""),
            answer: (a.ratingValue ?? a.textAnswer ?? "") as string | number | boolean,
          })),
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
    mutationFn: (args: { reviewId: string; score: number; feedbackText?: string }) => {
      const payload: { score: number; feedbackText?: string; answers: Record<string, unknown> } = {
        score: args.score,
        answers: {},
      };
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
        return data;
      } catch (error) {
        console.warn("[useLeaderboard] API unavailable:", error);
        return [] as unknown as LeaderboardEntry[];
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
        return await apiClientService.notifications.list();
      } catch (error) {
        console.warn("[useNotifications] API unavailable, using empty data:", error);
        return [];
      }
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

// Mock admin reports removed: useAdminReports now returns real API data (or [] on error).

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
        ...(args.notes ? { notes: args.notes } : {}),
      }),
    onSuccess: (_data, variables) => {
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
  };
}

export function useCurrentMember() {
  return useQuery({
    queryKey: ["users", "me", "member"],
    queryFn: async (): Promise<Member> => {
      try {
        const data = await apiClientService.users.member();
        return currentMemberFromApi(data);
      } catch (error) {
        console.warn("[useCurrentMember] API unavailable:", error);
        throw error;
      }
    },
  });
}

export function useQueueTasks() {
  return useQuery({
    queryKey: ["feed", "queue"],
    queryFn: async (): Promise<QueueTask[]> => {
      try {
        return await apiClientService.feed.queue();
      } catch (error) {
        console.warn("[useQueueTasks] API unavailable, using empty data:", error);
        return [];
      }
    },
  });
}

export function useSubmissions() {
  return useQuery({
    queryKey: ["feed", "submissions"],
    queryFn: async (): Promise<SubmissionDTO[]> => {
      try {
        return await apiClientService.feed.submissions();
      } catch (error) {
        console.warn("[useSubmissions] API unavailable, using empty data:", error);
        return [];
      }
    },
  });
}

export function useSubmitVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { youtubeUrl: string; communityId?: string }) =>
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
      try {
        return await apiClientService.feed.activity();
      } catch (error) {
        console.warn("[useActivity] API unavailable, using empty data:", error);
        return [];
      }
    },
  });
}
