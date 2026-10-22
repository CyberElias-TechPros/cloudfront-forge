/**
 * AUTO-GENERATED — do not edit.
 *
 * Produced by `node scripts/api-client.mjs` from
 * `workers/api/src/contract/openapi.generated.json`. Run `npm run contract:client`
 * after changing a schema; CI fails when this file drifts from the contract.
 *
 * Every operation declares the HTTP method, the literal path template, the auth
 * tier, its query parameters, the request body and the success envelope.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "AUTH_REQUIRED"
  | "AUTH_ERROR"
  | "FORBIDDEN"
  | "ACCOUNT_DELETED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_BANNED"
  | "SUBMISSION_COOLDOWN"
  | "RATIO_GATE"
  | "CHANNEL_CONFLICT"
  | "AI_NOT_CONFIGURED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INSUFFICIENT_CREDITS"
  | "DAILY_LIMIT"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "INTERNAL_ERROR"
  | "DATABASE_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "AI_UNAVAILABLE"
  | "MISSING_ENV"
  | "SCHEMA_OUT_OF_DATE"
  | "NOT_READY";

export interface ResponseMeta {
  timestamp: string;
  version: string;
}

/** The failure envelope every non-2xx response uses. */
export interface ApiErrorEnvelope {
  success: false;
  error: { code: ErrorCode; message: string };
  meta: ResponseMeta;
}

/**
 * Operation id → wire details. Index it by the ids in the contract
 * (`GET /openapi.json` → `operationId`), never by hand-written strings.
 */
export interface OperationRegistry {
  adminListTopups: {
    method: "GET";
    path: "/api/v1/admin/topups";
    auth: "admin";
    summary: "Top-up review queue (admin)";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  answerAttentionChallenge: {
    method: "POST";
    path: "/api/v1/watch/challenge/{challengeId}/answer";
    auth: "user";
    summary: "Answer an attention challenge";
    media: "application/json";
    query: Record<string, never>;
    request: {
      answer: string | number;
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  appealReport: {
    method: "POST";
    path: "/api/v1/reports/{reportId}/appeal";
    auth: "user";
    summary: "Appeal a report the caller was named in";
    media: "application/json";
    query: Record<string, never>;
    request: {
      reason: string;
    };
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  approveJoinRequest: {
    method: "POST";
    path: "/api/v1/communities/{communityId}/requests/{requestId}/approve";
    auth: "user";
    summary: "Approve a join request";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  approveTopup: {
    method: "POST";
    path: "/api/v1/admin/topups/{topupId}/approve";
    auth: "admin";
    summary: "Approve a transfer and credit the account";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        credits: number;
        balance: number;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  archiveCommunity: {
    method: "DELETE";
    path: "/api/v1/communities/{communityId}";
    auth: "user";
    summary: "Archive a squad (soft delete, history preserved)";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  archiveVideo: {
    method: "POST";
    path: "/api/v1/videos/{videoId}/archive";
    auth: "user";
    summary: "Archive one of the caller's videos";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  assignMission: {
    method: "POST";
    path: "/api/v1/missions/{missionId}/assign";
    auth: "user";
    summary: "Assign a mission to the caller";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  chatWithCoach: {
    method: "POST";
    path: "/api/v1/ai/chat";
    auth: "user";
    summary: "Ask the platform-aware growth coach a question";
    media: "application/json";
    query: Record<string, never>;
    request: {
      message: string;
      conversationId?: string;
    };
    response: {
      success: true;
      data: {
        conversationId: string;
        reply: string;
        conversation: {
          id: string;
          title?: string;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  claimDailyBonus: {
    method: "POST";
    path: "/api/v1/gamification/daily-bonus";
    auth: "user";
    summary: "Claim the once-a-day login bonus";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        credits: number;
        multiplier: number;
        streak: number;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  claimWatch: {
    method: "POST";
    path: "/api/v1/watch";
    auth: "user";
    summary: "Claim a watched video";
    media: "application/json";
    query: Record<string, never>;
    request: {
      videoId: string;
      watchSeconds: number;
      subscribed?: boolean;
      commented?: boolean;
      sessionToken?: string;
    };
    response: {
      success: true;
      data: {
        status: "started" | "verified" | "claimed";
        claimable: boolean;
        attentionBlocked: boolean;
        xpAwarded: number;
        creditsAwarded: number;
        watchVerified: boolean;
        subscribed: boolean;
        commented: boolean;
        rewardBreakdown: {
          watch: {
            xp: number;
            credits: number;
          };
          subscribe: {
            xp: number;
            credits: number;
          };
          comment: {
            xp: number;
            credits: number;
          };
        };
        evidence?: {
          level: "youtube_api" | "signed_session" | "self_report" | "none";
          paid: boolean;
          verifiedSeconds: number;
          reason: string;
        };
        subReason?: string;
        level: number;
        totalXp: number;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  completeMissionAssignment: {
    method: "POST";
    path: "/api/v1/missions/assignments/{assignmentId}/complete";
    auth: "user";
    summary: "Complete an assignment (pays once)";
    media: "application/json";
    query: Record<string, never>;
    request: {
      completionData?: string;
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  completeReview: {
    method: "POST";
    path: "/api/v1/reviews/{reviewId}/complete";
    auth: "user";
    summary: "Complete a review and trigger its single payout";
    media: "application/json";
    query: Record<string, never>;
    request: {
      score?: number;
      feedbackText?: string;
      answers?: {
        questionId: string;
        ratingValue?: number;
        textAnswer?: string;
      }[];
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  completeYouTubeOAuth: {
    method: "POST";
    path: "/api/v1/youtube/oauth/callback";
    auth: "public";
    summary: "Finish the OAuth exchange from a client";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  createAttentionChallenge: {
    method: "POST";
    path: "/api/v1/watch/challenge";
    auth: "user";
    summary: "Issue a mid-watch attention challenge";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  createCommunity: {
    method: "POST";
    path: "/api/v1/communities";
    auth: "user";
    summary: "Create a squad (the caller becomes owner)";
    media: "application/json";
    query: Record<string, never>;
    request: {
      name: string;
      description?: string;
      isPublic?: boolean;
      maxMembers?: number;
    };
    response: {
      success: true;
      data: {
        message: string;
        communityId: string;
        inviteCode?: string;
        slug?: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  createMission: {
    method: "POST";
    path: "/api/v1/missions";
    auth: "admin";
    summary: "Create a mission (admin)";
    media: "application/json";
    query: Record<string, never>;
    request: {
      title: string;
      description: string;
      difficulty?: "easy" | "medium" | "hard";
      xpReward?: number;
      creditReward?: number;
      timeEstimateMinutes?: number;
      chainId?: string;
      chainStep?: number;
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  createMissionChain: {
    method: "POST";
    path: "/api/v1/missions/chain";
    auth: "admin";
    summary: "Create a 2–5 step mission chain (admin)";
    media: "application/json";
    query: Record<string, never>;
    request: {
      niche: string;
      steps: Array<{
        title: string;
        description?: string;
        difficulty?: "easy" | "medium" | "hard";
        xpReward?: number;
        creditReward?: number;
        timeEstimateMinutes?: number;
      }>;
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  createNotification: {
    method: "POST";
    path: "/api/v1/notifications";
    auth: "user";
    summary: "Create a notification for the caller (system/admin use)";
    media: "application/json";
    query: Record<string, never>;
    request: {
      type: string;
      title: string;
      message: string;
      data?: Record<string, unknown>;
    };
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  createReport: {
    method: "POST";
    path: "/api/v1/reports";
    auth: "user";
    summary: "Report a video, review, comment, member or squad";
    media: "application/json";
    query: Record<string, never>;
    request: {
      reportedUserId?: string;
      resourceType: "video" | "review" | "comment" | "user" | "community";
      resourceId: string;
      reason: "spam" | "inappropriate" | "harassment" | "cheating" | "misleading" | "other";
      description?: string;
    };
    response: {
      success: true;
      data: {
        message: string;
        reportId: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  createSupportRequest: {
    method: "POST";
    path: "/api/v1/support";
    auth: "user";
    summary: "Contact the team about an account, credit or moderation problem";
    media: "application/json";
    query: Record<string, never>;
    request: {
      topic: "account" | "credits" | "community" | "video" | "moderation" | "bug" | "other";
      message: string;
    };
    response: {
      success: true;
      data: {
        message: string;
        supportId: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  deleteAiConversation: {
    method: "DELETE";
    path: "/api/v1/ai/conversations/{conversationId}";
    auth: "user";
    summary: "Delete a conversation and its messages";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  deleteMyAccount: {
    method: "DELETE";
    path: "/api/v1/users/me";
    auth: "user";
    summary: "Delete the account and schedule data erasure";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        deletedAt?: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  deleteNotification: {
    method: "DELETE";
    path: "/api/v1/notifications/{notificationId}";
    auth: "user";
    summary: "Delete one notification";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  disconnectYouTube: {
    method: "POST";
    path: "/api/v1/youtube/disconnect";
    auth: "user";
    summary: "Revoke the stored YouTube tokens";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getActivity: {
    method: "GET";
    path: "/api/v1/activity";
    auth: "user";
    summary: "Unread notifications for the caller (the activity bell)";
    media: "application/json";
    query: {
      limit?: number;
      offset?: number;
    };
    request: never;
    response: {
      success: true;
      data: {
        items: {
          id: string;
          type: string;
          title?: string;
          message?: string;
          created_at?: string;
          [key: string]: unknown;
        }[];
        total: number;
        limit?: number;
        offset?: number;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getAnalytics: {
    method: "GET";
    path: "/api/v1/admin/analytics";
    auth: "admin";
    summary: "Funnel totals, event counts and the daily trend";
    media: "application/json";
    query: {
      days?: number;
    };
    request: never;
    response: {
      success: true;
      data: {
        period: string;
        totals: {
          submits: number;
          claims: number;
          reviews: number;
          claimRate: number;
          [key: string]: unknown;
        };
        events: {
          event_type: string;
          count: number;
          [key: string]: unknown;
        }[];
        dailyTrend: {
          day: string;
          event_type: string;
          count: number;
          [key: string]: unknown;
        }[];
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getCommunity: {
    method: "GET";
    path: "/api/v1/communities/{communityId}";
    auth: "user";
    summary: "One squad: roster, settings and the caller's role";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        community: {
          id: string;
          name: string;
          description?: string;
          slug?: string;
          is_public?: boolean;
          isPublic?: boolean;
          max_members?: number;
          maxMembers?: number;
          logo_url?: string;
          banner_url?: string;
          owner_id?: string;
          invite_code?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          [key: string]: unknown;
        };
        memberCount?: number;
        members?: Array<{
          id: string;
          userId?: string;
          displayName?: string;
          photoUrl?: string;
          role?: "owner" | "admin" | "moderator" | "member";
          joined_at?: string;
          joinedAt?: string;
          [key: string]: unknown;
        }>;
        settings?: Record<string, unknown>;
        isOwner?: boolean;
        isMember?: boolean;
        role?: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getCreditBalance: {
    method: "GET";
    path: "/api/v1/credits";
    auth: "user";
    summary: "Credit balance and the 50 most recent transactions";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        balance: number;
        totalEarned?: number;
        totalSpent?: number;
        transactions: {
          id: string;
          user_id?: string;
          type?: string;
          amount?: number;
          balance_after?: number;
          description?: string;
          reference_id?: string;
          created_at?: string;
          [key: string]: unknown;
        }[];
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getCurrentAccount: {
    method: "GET";
    path: "/api/v1/auth/me";
    auth: "user";
    summary: "Bootstrap the signed-in member";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        id: string;
        firebaseUid?: string;
        email?: string;
        displayName?: string;
        name?: string;
        photoUrl?: string;
        level: number;
        totalXp: number;
        credits: number;
        streak?: number;
        niche?: string;
        publicProfile?: boolean;
        createdAt?: string;
        updatedAt?: string;
        lastActive?: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getLeaderboard: {
    method: "GET";
    path: "/api/v1/leaderboards";
    auth: "public";
    summary: "XP leaderboard, optionally by cohort";
    media: "application/json";
    query: {
      timeframe?: "weekly" | "monthly" | "all";
      cohort?: "rookie" | "rising" | "veteran";
      limit?: number;
      offset?: number;
    };
    request: never;
    response: {
      success: true;
      data: {
        items: {
          id: string;
          display_name?: string;
          photo_url?: string;
          total_xp?: number;
          credits?: number;
          reputation?: number;
          [key: string]: unknown;
        }[];
        total: number;
        limit?: number;
        offset?: number;
      } & {
        timeframe?: string;
        cohort?: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getMemberById: {
    method: "GET";
    path: "/api/v1/users/{userId}";
    auth: "user";
    summary: "Public member profile (respects the member's visibility setting)";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getMyInsights: {
    method: "GET";
    path: "/api/v1/users/me/insights";
    auth: "user";
    summary: "Personal growth insights";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getMyMemberCard: {
    method: "GET";
    path: "/api/v1/users/me/member";
    auth: "user";
    summary: "Member card used by the header and dashboard";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        id: string;
        firebaseUid?: string;
        email?: string;
        displayName?: string;
        name?: string;
        photoUrl?: string;
        level: number;
        totalXp: number;
        credits: number;
        streak?: number;
        niche?: string;
        publicProfile?: boolean;
        createdAt?: string;
        updatedAt?: string;
        lastActive?: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getMyProfile: {
    method: "GET";
    path: "/api/v1/users/me/profile";
    auth: "user";
    summary: "Full profile of the caller";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getNotificationPreferences: {
    method: "GET";
    path: "/api/v1/notifications/preferences";
    auth: "user";
    summary: "Per-channel notification preferences";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getPermissions: {
    method: "GET";
    path: "/api/v1/auth/permissions";
    auth: "user";
    summary: "Roles and permissions for the caller";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getPlatformMetrics: {
    method: "GET";
    path: "/api/v1/admin/metrics";
    auth: "admin";
    summary: "Headline counts used by the operator dashboard and alerting";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        users: number;
        communities: number;
        videos: number;
        reviews: number;
        pendingReports: number;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getReputation: {
    method: "GET";
    path: "/api/v1/reputation";
    auth: "user";
    summary: "Trust score and the events that moved it";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        score: number;
        events: {
          id: string;
          user_id?: string;
          event_type?: string;
          points_change?: number;
          reason?: string;
          created_at?: string;
          [key: string]: unknown;
        }[];
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getRetentionCohorts: {
    method: "GET";
    path: "/api/v1/admin/retention";
    auth: "admin";
    summary: "Weekly cohort retention (week 1 and week 4)";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        cohorts: {
          date: string;
          total: number;
          week1Retention: number;
          week4Retention: number;
          [key: string]: unknown;
        }[];
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getReview: {
    method: "GET";
    path: "/api/v1/reviews/{reviewId}";
    auth: "user";
    summary: "Review detail with questions";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getStreaks: {
    method: "GET";
    path: "/api/v1/streaks";
    auth: "user";
    summary: "Current and longest daily streak";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        currentStreak: number;
        longestStreak: number;
        lastActive: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getTopupProof: {
    method: "GET";
    path: "/api/v1/admin/topups/{topupId}/proof";
    auth: "admin";
    summary: "Receipt image for a top-up (admin browsers render it inline)";
    media: "image/*";
    query: Record<string, never>;
    request: never;
    response: string;
  };

  getVideo: {
    method: "GET";
    path: "/api/v1/videos/{videoId}";
    auth: "public";
    summary: "Video detail";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getWatchQueue: {
    method: "GET";
    path: "/api/v1/queue";
    auth: "user";
    summary: "The next video the caller should watch";
    media: "application/json";
    query: {
      communityId?: string;
      limit?: number;
      offset?: number;
    };
    request: never;
    response: {
      success: true;
      data: {
        items: {
          id: string;
          title?: string;
          duration_seconds?: number;
          status?: string;
          created_at?: string;
          user_id?: string;
          youtube_video_id?: string;
          youtube_url?: string;
          channel_id?: string;
          magic_word?: string;
          display_name?: string;
          photo_url?: string;
          watch_status?: string;
          xp_awarded?: number;
          credits_awarded?: number;
          [key: string]: unknown;
        }[];
        total: number;
        limit?: number;
        offset?: number;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getXpProgress: {
    method: "GET";
    path: "/api/v1/xp";
    auth: "user";
    summary: "XP total, level and progress to the next level";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        totalXp: number;
        currentLevel: number;
        xpToNextLevel: number;
        transactions: {
          id: string;
          user_id?: string;
          amount?: number;
          source?: string;
          description?: string;
          created_at?: string;
          [key: string]: unknown;
        }[];
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  getYouTubeStatus: {
    method: "GET";
    path: "/api/v1/youtube/status";
    auth: "user";
    summary: "Whether the caller has a usable YouTube connection";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        connected: boolean;
        channelId?: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  health: {
    method: "GET";
    path: "/health";
    auth: "public";
    summary: "Liveness probe (answers even when configuration is incomplete)";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  joinCommunityByCode: {
    method: "POST";
    path: "/api/v1/communities/join";
    auth: "user";
    summary: "Join a squad with an invite code";
    media: "application/json";
    query: Record<string, never>;
    request: {
      inviteCode: string;
    };
    response: {
      success: true;
      data: {
        message: string;
        communityId?: string;
        communityName?: string;
        requestId?: string;
        pending?: boolean;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  leaveCommunity: {
    method: "POST";
    path: "/api/v1/communities/{communityId}/leave";
    auth: "user";
    summary: "Leave a squad (owners must archive instead)";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  linkYouTubeChannel: {
    method: "POST";
    path: "/api/v1/users/me/youtube-channel";
    auth: "user";
    summary: "Link a YouTube channel to the member";
    media: "application/json";
    query: Record<string, never>;
    request: {
      channelId: string;
      channelName?: string;
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listAdminCommunities: {
    method: "GET";
    path: "/api/v1/admin/communities";
    auth: "admin";
    summary: "Every squad with its owner and member count";
    media: "application/json";
    query: {
      status?: "active" | "archived";
      limit?: number;
      offset?: number;
    };
    request: never;
    response: {
      success: true;
      data: {
        items: {
          id: string;
          name: string;
          slug?: string;
          description?: string;
          status?: string;
          is_public?: boolean;
          member_count?: number;
          owner_name?: string;
          created_at?: string;
          [key: string]: unknown;
        }[];
        total: number;
        limit?: number;
        offset?: number;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listAdminUsers: {
    method: "GET";
    path: "/api/v1/admin/users";
    auth: "admin";
    summary: "Member directory with trust score and platform role";
    media: "application/json";
    query: {
      status?: "active" | "suspended" | "deleted";
      limit?: number;
      offset?: number;
    };
    request: never;
    response: {
      success: true;
      data: {
        items: {
          id: string;
          email?: string;
          display_name?: string;
          photo_url?: string;
          status?: string;
          created_at?: string;
          trust_score?: number;
          platform_role?: string;
          [key: string]: unknown;
        }[];
        total: number;
        limit?: number;
        offset?: number;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listAiConversations: {
    method: "GET";
    path: "/api/v1/ai/conversations";
    auth: "user";
    summary: "The caller's AI conversations";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        conversations: {
          id: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
          [key: string]: unknown;
        }[];
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listAiMessages: {
    method: "GET";
    path: "/api/v1/ai/conversations/{conversationId}/messages";
    auth: "user";
    summary: "Messages in one conversation";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        messages: Array<{
          id?: string;
          role: "user" | "assistant" | "system";
          content: string;
          created_at?: string;
          [key: string]: unknown;
        }>;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listAppeals: {
    method: "GET";
    path: "/api/v1/admin/appeals";
    auth: "moderator";
    summary: "Appeals awaiting review";
    media: "application/json";
    query: {
      status?: "pending" | "accepted" | "rejected";
    };
    request: never;
    response: {
      success: true;
      data: {
        items: {
          id: string;
          reason?: string;
          status?: string;
          createdAt?: string;
          reviewedAt?: string;
          note?: string;
          reportId?: string;
          userId?: string;
          displayName?: string;
          [key: string]: unknown;
        }[];
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listBadges: {
    method: "GET";
    path: "/api/v1/badges";
    auth: "user";
    summary: "Badges the caller has earned";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        id: string;
        name?: string;
        description?: string;
        icon?: string;
        earned_at?: string;
        [key: string]: unknown;
      }[];
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listCollaborators: {
    method: "GET";
    path: "/api/v1/discover/collaborators";
    auth: "user";
    summary: "Members open to collaborating";
    media: "application/json";
    query: {
      intent?: "collaboration" | "feedback" | "support" | "mentorship";
      limit?: number;
    };
    request: never;
    response: {
      success: true;
      data: {
        items: Array<
          | {
              id: string;
              userId?: string;
              displayName?: string;
              photoUrl?: string;
              role?: "owner" | "admin" | "moderator" | "member";
              joined_at?: string;
              joinedAt?: string;
              [key: string]: unknown;
            }
          | {
              id: string;
              email?: string;
              display_name?: string;
              photo_url?: string;
              status?: string;
              created_at?: string;
              trust_score?: number;
              platform_role?: string;
              [key: string]: unknown;
            }
        >;
        intent?: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listCommunityMembers: {
    method: "GET";
    path: "/api/v1/communities/{communityId}/members";
    auth: "user";
    summary: "Active roster of a squad";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        members: Array<{
          id: string;
          userId?: string;
          displayName?: string;
          photoUrl?: string;
          role?: "owner" | "admin" | "moderator" | "member";
          joined_at?: string;
          joinedAt?: string;
          [key: string]: unknown;
        }>;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listDailyQuests: {
    method: "GET";
    path: "/api/v1/daily-quests";
    auth: "user";
    summary: "Today's quests and the caller's progress";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        items: {
          id: string;
          title?: string;
          description?: string;
          progress?: number;
          target?: number;
          completed?: boolean;
          xpReward?: number;
          creditReward?: number;
          [key: string]: unknown;
        }[];
        date: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listJoinRequests: {
    method: "GET";
    path: "/api/v1/communities/{communityId}/requests";
    auth: "user";
    summary: "Pending join requests (owner/moderator only)";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        items: {
          id: string;
          message?: string;
          status?: string;
          requestedAt?: string;
          userId?: string;
          displayName?: string;
          photoUrl?: string;
          [key: string]: unknown;
        }[];
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listMissionAssignments: {
    method: "GET";
    path: "/api/v1/missions/assignments";
    auth: "user";
    summary: "The caller's mission assignments";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listMissions: {
    method: "GET";
    path: "/api/v1/missions";
    auth: "user";
    summary: "Missions available to the caller";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        missions: Array<{
          id: string;
          title: string;
          description?: string;
          difficulty?: "easy" | "medium" | "hard";
          xpReward?: number;
          creditReward?: number;
          status?: string;
          [key: string]: unknown;
        }>;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listMyCommunities: {
    method: "GET";
    path: "/api/v1/communities";
    auth: "user";
    summary: "Squads the caller belongs to";
    media: "application/json";
    query: {
      limit?: number;
      offset?: number;
    };
    request: never;
    response: {
      success: true;
      data: {
        items: {
          id: string;
          name: string;
          description?: string;
          slug?: string;
          is_public?: boolean;
          isPublic?: boolean;
          max_members?: number;
          maxMembers?: number;
          logo_url?: string;
          banner_url?: string;
          owner_id?: string;
          invite_code?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          [key: string]: unknown;
        }[];
        total: number;
        limit?: number;
        offset?: number;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listMyReports: {
    method: "GET";
    path: "/api/v1/reports/mine";
    auth: "user";
    summary: "Reports the caller filed, with appeal state";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        items: {
          id: string;
          reason?: string;
          resource_type?: string;
          resource_id?: string;
          status?: string;
          created_at?: string;
          resolution_notes?: string;
          appealed?: boolean;
          [key: string]: unknown;
        }[];
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listMySubmissions: {
    method: "GET";
    path: "/api/v1/submissions";
    auth: "user";
    summary: "The caller's videos and the attention each one earned";
    media: "application/json";
    query: {
      limit?: number;
      offset?: number;
    };
    request: never;
    response: {
      success: true;
      data: {
        items: {
          id: string;
          title?: string;
          status?: string;
          created_at?: string;
          watch_target?: number;
          comment_count?: number;
          watcher_count?: number;
          subs_count?: number;
          [key: string]: unknown;
        }[];
        total: number;
        limit?: number;
        offset?: number;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listMyTopups: {
    method: "GET";
    path: "/api/v1/topups/mine";
    auth: "user";
    summary: "The caller's top-up requests and their state";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listMyYouTubeChannels: {
    method: "GET";
    path: "/api/v1/users/me/youtube-channels";
    auth: "user";
    summary: "YouTube channels linked to the caller";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        items: Record<string, unknown>[];
        connected?: boolean;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listNotifications: {
    method: "GET";
    path: "/api/v1/notifications";
    auth: "user";
    summary: "Inbox for the caller";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        notifications: {
          id: string;
          type: string;
          title?: string;
          message?: string;
          isRead?: boolean;
          createdAt?: string;
          [key: string]: unknown;
        }[];
        unreadCount?: number;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listReportsForModeration: {
    method: "GET";
    path: "/api/v1/admin/reports";
    auth: "moderator";
    summary: "Report queue (moderator view)";
    media: "application/json";
    query: {
      status?: "pending" | "resolved" | "dismissed";
    };
    request: never;
    response: {
      success: true;
      data: {
        items: {
          id: string;
          reason?: string;
          resource_type?: string;
          resource_id?: string;
          status?: string;
          created_at?: string;
          reporter_name?: string;
          reported_name?: string;
          description?: string;
          [key: string]: unknown;
        }[];
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listReviews: {
    method: "GET";
    path: "/api/v1/reviews";
    auth: "user";
    summary: "Reviews assigned to or submitted by the caller";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listShopItems: {
    method: "GET";
    path: "/api/v1/shop";
    auth: "user";
    summary: "Shop catalogue and the caller's balance";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        items: {
          id: string;
          name: string;
          description?: string;
          cost: number;
          itemType: string;
          [key: string]: unknown;
        }[];
        balance?: number;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listSupportRequests: {
    method: "GET";
    path: "/api/v1/admin/support";
    auth: "moderator";
    summary: "Support queue (moderator view)";
    media: "application/json";
    query: {
      status?: "open" | "resolved";
    };
    request: never;
    response: {
      success: true;
      data: {
        items: {
          id: string;
          topic?: string;
          message?: string;
          status?: string;
          createdAt?: string;
          resolvedAt?: string;
          displayName?: string;
          email?: string;
          [key: string]: unknown;
        }[];
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listTopupTiers: {
    method: "GET";
    path: "/api/v1/topups";
    auth: "user";
    summary: "Server-defined top-up tiers";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  listVideos: {
    method: "GET";
    path: "/api/v1/videos";
    auth: "user";
    summary: "List videos visible to the caller";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        videos: Array<{
          id: string;
          youtubeVideoId?: string;
          youtubeUrl?: string;
          title?: string;
          thumbnailUrl?: string;
          durationSeconds?: number;
          status?: "pending" | "active" | "completed" | "archived" | "removed";
          createdAt?: string;
          [key: string]: unknown;
        }>;
        pagination?: {
          limit: number;
          offset: number;
          total?: number;
          [key: string]: unknown;
        };
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  markAllNotificationsRead: {
    method: "POST";
    path: "/api/v1/notifications/read-all";
    auth: "user";
    summary: "Mark the whole inbox read";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  markNotificationRead: {
    method: "POST";
    path: "/api/v1/notifications/{notificationId}/read";
    auth: "user";
    summary: "Mark one notification read";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  openApiDocument: {
    method: "GET";
    path: "/openapi.json";
    auth: "public";
    summary: "This document";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  purchaseShopItem: {
    method: "POST";
    path: "/api/v1/shop/purchase";
    auth: "user";
    summary: "Spend credits on a boost or streak freeze";
    media: "application/json";
    query: Record<string, never>;
    request: {
      itemType: "boost" | "streak_freeze";
      videoId?: string;
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  rateReviewHelpful: {
    method: "POST";
    path: "/api/v1/reviews/{reviewId}/helpful";
    auth: "user";
    summary: "Rate a received review as helpful";
    media: "application/json";
    query: Record<string, never>;
    request: {
      helpful: boolean;
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  ready: {
    method: "GET";
    path: "/ready";
    auth: "public";
    summary: "Readiness gate — verifies bindings and applied schema";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  recordWatchHeartbeat: {
    method: "POST";
    path: "/api/v1/watch/heartbeat";
    auth: "user";
    summary: "Record a player-time sample";
    media: "application/json";
    query: Record<string, never>;
    request: {
      sessionToken: string;
      playerTime: number;
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  regenerateInviteCode: {
    method: "POST";
    path: "/api/v1/communities/{communityId}/invite/regenerate";
    auth: "user";
    summary: "Rotate a leaked invite code (owner only)";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        inviteCode: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  registerAccount: {
    method: "POST";
    path: "/api/v1/auth/register";
    auth: "user";
    summary: "Register (or return) the account for the verified token";
    media: "application/json";
    query: Record<string, never>;
    request: {
      firebaseUid?: string;
      email?: string;
      displayName?: string;
      photoUrl?: string;
    };
    response: {
      success: true;
      data: {
        id: string;
        firebaseUid?: string;
        email?: string;
        displayName?: string;
        name?: string;
        photoUrl?: string;
        level: number;
        totalXp: number;
        credits: number;
        streak?: number;
        niche?: string;
        publicProfile?: boolean;
        createdAt?: string;
        updatedAt?: string;
        lastActive?: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  reinstateMember: {
    method: "POST";
    path: "/api/v1/admin/users/{userId}/reinstate";
    auth: "admin";
    summary: "Lift a suspension";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  rejectJoinRequest: {
    method: "POST";
    path: "/api/v1/communities/{communityId}/requests/{requestId}/reject";
    auth: "user";
    summary: "Reject a join request";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  rejectTopup: {
    method: "POST";
    path: "/api/v1/admin/topups/{topupId}/reject";
    auth: "admin";
    summary: "Decline a transfer with a reason";
    media: "application/json";
    query: Record<string, never>;
    request: {
      reason?: string;
    };
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  removeMember: {
    method: "POST";
    path: "/api/v1/communities/{communityId}/members/{memberId}/remove";
    auth: "user";
    summary: "Remove a member from the squad (owner only)";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  requestToJoinCommunity: {
    method: "POST";
    path: "/api/v1/communities/{communityId}/join";
    auth: "user";
    summary: "Join a public squad, or submit a request when approval is required";
    media: "application/json";
    query: Record<string, never>;
    request: {
      message?: string;
    };
    response: {
      success: true;
      data: {
        message: string;
        communityId?: string;
        communityName?: string;
        requestId?: string;
        pending?: boolean;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  requestTopup: {
    method: "POST";
    path: "/api/v1/topups";
    auth: "user";
    summary: "Request a top-up awaiting admin review";
    media: "application/json";
    query: Record<string, never>;
    request: {
      tierId: string;
      proofImage?: string;
      proofImageName?: string;
      proofImageType?: string;
      transferReference?: string;
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  resolveReport: {
    method: "POST";
    path: "/api/v1/admin/reports/{reportId}/resolve";
    auth: "moderator";
    summary: "Close a report as resolved or dismissed";
    media: "application/json";
    query: Record<string, never>;
    request: {
      status: "resolved" | "dismissed";
      resolutionNotes?: string;
    };
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  resolveSupportRequest: {
    method: "POST";
    path: "/api/v1/admin/support/{supportId}/resolve";
    auth: "moderator";
    summary: "Mark a support request resolved";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  restoreVideo: {
    method: "POST";
    path: "/api/v1/admin/videos/{videoId}/restore";
    auth: "moderator";
    summary: "Return a removed video to the queue";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  reviewAppeal: {
    method: "POST";
    path: "/api/v1/admin/appeals/{appealId}";
    auth: "moderator";
    summary: "Accept or reject an appeal";
    media: "application/json";
    query: Record<string, never>;
    request: {
      status: "accepted" | "rejected";
      note?: string;
    };
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  saveReviewAnswers: {
    method: "POST";
    path: "/api/v1/reviews/{reviewId}/answers";
    auth: "user";
    summary: "Draft the structured answers for a review";
    media: "application/json";
    query: Record<string, never>;
    request: {
      answers?: {
        questionId: string;
        ratingValue?: number;
        textAnswer?: string;
      }[];
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  search: {
    method: "GET";
    path: "/api/v1/search";
    auth: "user";
    summary: "Search squads and videos";
    media: "application/json";
    query: {
      q?: string;
    };
    request: never;
    response: {
      success: true;
      data: {
        communities: {
          id: string;
          name: string;
          description?: string;
          slug?: string;
          is_public?: boolean;
          isPublic?: boolean;
          max_members?: number;
          maxMembers?: number;
          logo_url?: string;
          banner_url?: string;
          owner_id?: string;
          invite_code?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          [key: string]: unknown;
        }[];
        videos: {
          id: string;
          title?: string;
          duration_seconds?: number;
          status?: string;
          created_at?: string;
          user_id?: string;
          youtube_video_id?: string;
          youtube_url?: string;
          channel_id?: string;
          magic_word?: string;
          display_name?: string;
          photo_url?: string;
          watch_status?: string;
          xp_awarded?: number;
          credits_awarded?: number;
          [key: string]: unknown;
        }[];
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  setMemberRole: {
    method: "POST";
    path: "/api/v1/communities/{communityId}/members/{memberId}/role";
    auth: "user";
    summary: "Promote or demote a member (owner only)";
    media: "application/json";
    query: Record<string, never>;
    request: {
      role: "member" | "moderator";
    };
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  setPlatformRole: {
    method: "POST";
    path: "/api/v1/admin/users/{userId}/role";
    auth: "admin";
    summary: "Grant or remove the moderator/admin platform role";
    media: "application/json";
    query: Record<string, never>;
    request: {
      role: "moderator" | "admin";
    };
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  skipMissionAssignment: {
    method: "POST";
    path: "/api/v1/missions/assignments/{assignmentId}/skip";
    auth: "user";
    summary: "Skip an assignment (no reward, no penalty beyond the miss)";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  startReview: {
    method: "POST";
    path: "/api/v1/reviews/{reviewId}/start";
    auth: "user";
    summary: "Mark a review in progress";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  startWatchSession: {
    method: "POST";
    path: "/api/v1/watch/start";
    auth: "user";
    summary: "Open a signed watch session";
    media: "application/json";
    query: Record<string, never>;
    request: {
      videoId: string;
    };
    response: {
      success: true;
      data: {
        sessionToken: string;
        enabled: boolean;
        startTs?: number;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  startYouTubeAuthorization: {
    method: "GET";
    path: "/api/v1/youtube/oauth/authorize";
    auth: "user";
    summary: "Begin the YouTube OAuth flow";
    media: "application/json";
    query: Record<string, never>;
    request: never;
    response: {
      success: true;
      data: {
        authUrl: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  streamChatWithCoach: {
    method: "POST";
    path: "/api/v1/ai/chat/stream";
    auth: "user";
    summary: "Same as /ai/chat but streams tokens";
    media: "text/event-stream";
    query: Record<string, never>;
    request: {
      message: string;
      conversationId?: string;
    };
    response: string;
  };

  submitVideo: {
    method: "POST";
    path: "/api/v1/videos";
    auth: "user";
    summary: "Submit a YouTube video to the loop";
    media: "application/json";
    query: Record<string, never>;
    request: {
      youtubeUrl: string;
      communityId?: string;
      title?: string;
      magicWord?: string;
      niche?: string;
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  subscribeWebPush: {
    method: "POST";
    path: "/api/v1/notifications/push/subscribe";
    auth: "user";
    summary: "Register a Web Push subscription (web and PWA only)";
    media: "application/json";
    query: Record<string, never>;
    request: {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  suspendMember: {
    method: "POST";
    path: "/api/v1/admin/users/{userId}/suspend";
    auth: "admin";
    summary: "Suspend a member and record the reason";
    media: "application/json";
    query: Record<string, never>;
    request: {
      reason?: string;
    };
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  unsubscribeWebPush: {
    method: "POST";
    path: "/api/v1/notifications/push/unsubscribe";
    auth: "user";
    summary: "Remove a Web Push subscription";
    media: "application/json";
    query: Record<string, never>;
    request: {
      endpoint: string;
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  updateAccount: {
    method: "PUT";
    path: "/api/v1/auth/profile";
    auth: "user";
    summary: "Update display name or email";
    media: "application/json";
    query: Record<string, never>;
    request: {
      displayName?: string;
      email?: string;
    };
    response: {
      success: true;
      data: {
        id: string;
        firebaseUid?: string;
        email?: string;
        displayName?: string;
        name?: string;
        photoUrl?: string;
        level: number;
        totalXp: number;
        credits: number;
        streak?: number;
        niche?: string;
        publicProfile?: boolean;
        createdAt?: string;
        updatedAt?: string;
        lastActive?: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  updateCommunitySettings: {
    method: "PUT";
    path: "/api/v1/communities/{communityId}/settings";
    auth: "user";
    summary: "Update squad settings and rules (owner only)";
    media: "application/json";
    query: Record<string, never>;
    request: {
      allowPeerReview?: boolean;
      allowCollaboration?: boolean;
      requireApproval?: boolean;
      defaultLanguage?: string;
      rules?: string;
    };
    response: {
      success: true;
      data: {
        message: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  updateMyProfile: {
    method: "PUT";
    path: "/api/v1/users/me/profile";
    auth: "user";
    summary: "Update profile, goals and visibility";
    media: "application/json";
    query: Record<string, never>;
    request: {
      displayName?: string;
      bio?: string;
      country?: string;
      language?: string;
      experienceLevel?: "beginner" | "intermediate" | "advanced";
      niche?: string;
      contentCategories?: string;
      goals?: string;
      lookingFor?: "collaboration" | "feedback" | "support" | "mentorship";
      publicProfile?: boolean;
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  updateNotificationPreferences: {
    method: "PUT";
    path: "/api/v1/notifications/preferences";
    auth: "user";
    summary: "Update preferences and quiet hours";
    media: "application/json";
    query: Record<string, never>;
    request: {
      emailEnabled?: boolean;
      pushEnabled?: boolean;
      inAppEnabled?: boolean;
      whatsappEnabled?: boolean;
      missionReminders?: boolean;
      reviewRequests?: boolean;
      communityUpdates?: boolean;
      quietHoursStart?: number;
      quietHoursEnd?: number;
    };
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  uploadTopupProof: {
    method: "POST";
    path: "/api/v1/topups/proof";
    auth: "user";
    summary: "Upload a payment receipt to R2";
    media: "application/json";
    query: Record<string, never>;
    request: {
      file: string;
    };
    response: {
      success: true;
      data: {
        path: string;
        name: string;
        type: string;
        [key: string]: unknown;
      };
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };

  youTubeOAuthCallback: {
    method: "GET";
    path: "/api/v1/youtube/oauth/callback";
    auth: "public";
    summary: "OAuth redirect target (bounces back to the SPA)";
    media: "application/json";
    query: {
      code?: string;
      state?: string;
      error?: string;
    };
    request: never;
    response: {
      success: true;
      data: Record<string, unknown>;
      meta: {
        timestamp: string;
        version: string;
        requestId?: string;
      };
    };
  };
}

export type OperationId = keyof OperationRegistry;
export type Operation<K extends OperationId> = OperationRegistry[K];
export type ResponseOf<K extends OperationId> = OperationRegistry[K]["response"];
export type DataOf<K extends OperationId> =
  ResponseOf<K> extends { data: infer D } ? D : ResponseOf<K>;
export type RequestOf<K extends OperationId> = OperationRegistry[K]["request"];
export type QueryOf<K extends OperationId> = OperationRegistry[K]["query"];
export type PathOf<K extends OperationId> = OperationRegistry[K]["path"];
