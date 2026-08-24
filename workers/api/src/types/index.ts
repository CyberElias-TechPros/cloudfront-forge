/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  KV_CACHE: KVNamespace;
  ASSETS_BUCKET: R2Bucket;
  FIREBASE_PROJECT_ID: string;
  YOUTUBE_API_KEY: string;
  AI_PROVIDER: string;
  AI_API_KEY: string;
  AI_MODEL: string;
  ENVIRONMENT: string;
  CORS_ORIGINS: string;
  YOUTUBE_OAUTH_CLIENT_ID?: string;
  YOUTUBE_OAUTH_CLIENT_SECRET?: string;
  YOUTUBE_OAUTH_REDIRECT_URI?: string;
  REQUIRED_WATCH_SEC?: string;
  REWARD_XP?: string;
  REWARD_CREDITS?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  RATE_LIMIT_WINDOW?: string;
  AUTH_RATE_LIMIT_MAX_REQUESTS?: string;
  AUTH_RATE_LIMIT_WINDOW?: string;
  AI_DAILY_USER_LIMIT?: string;
  AI_DAILY_GLOBAL_LIMIT?: string;
  WATCH_SESSIONS_ENABLED?: string;
  WATCH_SESSION_SECRET?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  RESEND_API_KEY?: string;
}

export interface User {
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
}

export interface Community {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  inviteCode: string;
  isPublic: boolean;
  ownerId: string;
  maxMembers: number;
  createdAt: string;
  updatedAt: string;
}

export interface Video {
  id: string;
  userId: string;
  communityId: string;
  youtubeVideoId: string;
  youtubeUrl: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  status: "pending" | "active" | "completed" | "archived" | "removed";
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  videoId: string;
  reviewerId: string;
  submitterId: string;
  status: "assigned" | "in_progress" | "completed" | "overdue" | "skipped";
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  score: number | null;
  feedbackText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MissionAssignment {
  id: string;
  missionId: string;
  userId: string;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  status: "assigned" | "in_progress" | "completed" | "expired" | "skipped";
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: "earned" | "spent" | "bonus" | "penalty" | "admin";
  description: string;
  createdAt: string;
}

export interface XpTransaction {
  id: string;
  userId: string;
  amount: number;
  type: "mission" | "challenge" | "review" | "feedback" | "login" | "bonus" | "penalty";
  description: string;
  createdAt: string;
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

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any[];
  };
  meta: {
    timestamp: string;
    version: string;
    requestId?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
