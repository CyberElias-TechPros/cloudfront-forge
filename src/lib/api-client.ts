import apiClient from "./api";

export interface UserProfile {
  id: string;
  firebaseUid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  lastActive: string;
  trustScore?: number;
}

export interface Member {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  points: number;
  streak: number;
  level: number;
  rank: number;
  niche: string;
  subsGiven: number;
  subsReceived: number;
  watchMinutes: number;
  trustScore: number;
  isAdmin: boolean;
}

export interface Community {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  isPublic: boolean;
  maxMembers: number;
  logoUrl: string | null;
  bannerUrl: string | null;
  createdAt: string;
  memberCount: number;
  isOwner: boolean;
  ownerName: string | null;
  inviteCode: string | null;
  niche: string;
  thumbHue: number;
  updatedAt: string;
}

export interface CommunityMember {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  role: "owner" | "admin" | "moderator" | "mentor" | "member";
  joinedAt: string;
}

export interface CommunityDetail {
  community: Community;
  members: CommunityMember[];
}

export interface CreateCommunityInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  maxMembers?: number;
}

export interface CreateCommunityResult {
  message: string;
  communityId: string;
  inviteCode: string;
  slug: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  reward: { xp: number; credits: number };
  category: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedTimeMins: number;
}

export interface MissionAssignment {
  id: string;
  missionId: string;
  title: string;
  description: string;
  reward: { xp: number; credits: number };
  category: string;
  difficulty: "easy" | "medium" | "hard";
  status: "assigned" | "in_progress" | "completed" | "expired" | "skipped";
  progress: number;
  total: number;
  assignedAt: string;
  dueAt: string;
  claimed: boolean;
}

export interface Review {
  id: string;
  videoId: string;
  videoTitle: string;
  videoThumbnail: string | null;
  youtubeUrl: string;
  submitterId: string;
  submitterName: string;
  reviewerId: string;
  reviewerName: string;
  status: "assigned" | "in_progress" | "completed" | "overdue" | "skipped";
  score: number | null;
  feedbackText: string | null;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  dueAt: string;
}

export interface ReviewAnswerInput {
  questionId: string;
  ratingValue?: number;
  textAnswer?: string;
}

export interface LeaderboardEntry {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  totalXp: number;
  credits: number;
  reputation: number;
  weightedScore: number;
  rank?: number;
}

export interface CreditsSummary {
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

export interface XpSummary {
  totalXp: number;
  currentLevel: number;
  xpToNextLevel: number;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActive: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string | null;
  message: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface CurrentMember {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  points: number;
  streak: number;
  level: number;
  rank: number;
  niche: string;
  subsGiven: number;
  subsReceived: number;
  watchMinutes: number;
  trustScore: number;
  isAdmin: boolean;
}

export interface QueueTask {
  id: string;
  owner: string;
  handle: string;
  avatar: string;
  title: string;
  niche: string;
  durationSec: number;
  requiredSec: number;
  reward: number;
  status: "pending" | "watching" | "verified" | "expired";
  postedAgo: string;
  thumbHue: number;
}

export interface SubmissionDTO {
  id: string;
  title: string;
  postedAgo: string;
  watchers: number;
  target: number;
  subs: number;
  comments: number;
  status: "active" | "completed" | "queued";
}

export interface ActivityItem {
  id: string;
  who: string;
  what: string;
  when: string;
  points: string;
}

export interface AdminReport {
  id: string;
  reporterId: string;
  reportedUserId: string;
  resourceType: "video" | "review" | "comment" | "user" | "community";
  resourceId: string | null;
  reason: string;
  description: string | null;
  status: "pending" | "investigating" | "resolved" | "dismissed";
  resolvedBy: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  reporterName?: string | null;
  reportedUserName?: string | null;
}

export interface AdminMetrics {
  users: number;
  communities: number;
  videos: number;
  reviews: number;
  pendingReports: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  inAppEnabled: boolean;
  missionReminders: boolean;
  reviewRequests: boolean;
  communityUpdates: boolean;
}

export interface UserPermissions {
  userId: string;
  role: string;
  permissions: string[];
}

export interface SearchResult {
  communities: unknown[];
  videos: unknown[];
}

const getData = async <T>(url: string): Promise<T> => {
  const response = await apiClient.get(url);
  return response.data.data as T;
};

const postData = async <T, D extends object = object>(url: string, data?: D): Promise<T> => {
  const response = await apiClient.post(url, data as Record<string, unknown> | undefined);
  return response.data.data as T;
};

const putData = async <T, D extends object = object>(url: string, data?: D): Promise<T> => {
  const response = await apiClient.put(url, data as Record<string, unknown> | undefined);
  return response.data.data as T;
};

export const apiClientService = {
  auth: {
    register: (data: {
      firebaseUid: string;
      email?: string | null;
      displayName?: string | null;
      photoUrl?: string | null;
    }) => postData<UserProfile>("/api/v1/auth/register", data),
    me: () => getData<UserProfile>("/api/v1/auth/me"),
    permissions: () => getData<UserPermissions>("/api/v1/auth/permissions"),
  },

  communities: {
    list: () => getData<PaginatedResponse<Community>>("/api/v1/communities"),
    get: (communityId: string) => getData<CommunityDetail>(`/api/v1/communities/${communityId}`),
    create: (data: CreateCommunityInput) =>
      postData<CreateCommunityResult>("/api/v1/communities", data),
    join: (inviteCode: string) =>
      postData<{ message: string; communityId: string; communityName: string }>(
        "/api/v1/communities/join",
        { inviteCode },
      ),
  },

  missions: {
    list: () => getData<PaginatedResponse<Mission>>("/api/v1/missions"),
    assignments: () =>
      getData<PaginatedResponse<MissionAssignment>>("/api/v1/missions/assignments"),
    assign: (missionId: string) =>
      postData<{ message: string }>(`/api/v1/missions/${missionId}/assign`),
    complete: (assignmentId: string) =>
      postData<{ message: string; xpAwarded: number; creditsAwarded: number }>(
        `/api/v1/missions/assignments/${assignmentId}/complete`,
      ),
  },

  videos: {
    list: () => getData<PaginatedResponse<unknown>>("/api/v1/videos"),
    create: (data: { youtubeUrl: string; communityId?: string }) =>
      postData<{ message: string; videoId: string }>("/api/v1/videos", data),
  },

  reviews: {
    list: () => getData<PaginatedResponse<Review>>("/api/v1/reviews"),
    get: (reviewId: string) => getData<Review>(`/api/v1/reviews/${reviewId}`),
    start: (reviewId: string) => postData<{ message: string }>(`/api/v1/reviews/${reviewId}/start`),
    complete: (
      reviewId: string,
      data: { score?: number; feedbackText?: string; answers?: ReviewAnswerInput[] },
    ) =>
      postData<{ message: string; xpAwarded: number }>(
        `/api/v1/reviews/${reviewId}/complete`,
        data,
      ),
  },

  gamification: {
    credits: () => getData<CreditsSummary>("/api/v1/credits"),
    xp: () => getData<XpSummary>("/api/v1/xp"),
    streaks: () => getData<StreakInfo>("/api/v1/streaks"),
    badges: () => getData<unknown[]>("/api/v1/badges"),
    leaderboard: () => getData<PaginatedResponse<LeaderboardEntry>>("/api/v1/leaderboards"),
  },

  notifications: {
    list: () => getData<PaginatedResponse<Notification>>("/api/v1/notifications"),
    preferences: () => getData<NotificationPreferences>("/api/v1/notifications/preferences"),
    updatePreferences: (data: Partial<NotificationPreferences>) =>
      putData<{ message: string }>("/api/v1/notifications/preferences", data),
  },

  watch: {
    submit: (data: {
      videoId: string;
      watchSeconds: number;
      subscribed: boolean;
      commented: boolean;
    }) =>
      postData<{ status: string; claimable: boolean; xpAwarded: number; creditsAwarded: number }>(
        "/api/v1/watch",
        data,
      ),
  },

  youtube: {
    authorize: () => getData<{ authUrl: string }>("/api/v1/youtube/oauth/authorize"),
    status: () =>
      getData<{ connected: boolean; channelId?: string | null }>("/api/v1/youtube/status"),
    disconnect: () => postData<{ message: string }>("/api/v1/youtube/disconnect", {}),
  },

  users: {
    profile: () => getData<UserProfile>("/api/v1/users/me/profile"),
    member: () => getData<CurrentMember>("/api/v1/users/me/member"),
    updateProfile: (data: { displayName?: string; bio?: string; niche?: string }) =>
      putData<UserProfile>("/api/v1/users/me/profile", data),
  },

  feed: {
    queue: () => getData<PaginatedResponse<QueueTask>>("/api/v1/queue"),
    submissions: () => getData<PaginatedResponse<SubmissionDTO>>("/api/v1/submissions"),
    activity: () => getData<PaginatedResponse<ActivityItem>>("/api/v1/activity"),
  },

  search: {
    search: (q: string) => getData<SearchResult>(`/api/v1/search?q=${encodeURIComponent(q)}`),
  },

  admin: {
    metrics: () => getData<AdminMetrics>("/api/v1/admin/metrics"),
    users: (status = "active") => getData<UserProfile[]>(`/api/v1/admin/users?status=${status}`),
    reports: (status = "pending") =>
      getData<AdminReport[]>(`/api/v1/admin/reports?status=${status}`),
    resolveReport: (
      reportId: string,
      data: { status: "resolved" | "dismissed"; resolutionNotes?: string },
    ) => postData<{ message: string }>(`/api/v1/admin/reports/${reportId}/resolve`, data),
    createReport: (data: {
      reportedUserId: string;
      resourceType: "video" | "review" | "comment" | "user" | "community";
      resourceId?: string;
      reason: string;
      description: string;
    }) => postData<{ message: string; reportId: string }>("/api/v1/admin/reports", data),
  },
};

export default apiClientService;
