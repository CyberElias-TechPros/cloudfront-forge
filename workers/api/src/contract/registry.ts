/**
 * The API contract registry.
 *
 * Each entry binds an *actual* route (same `method` + `path`/`pattern` the
 * router matches) to its documented shape: auth tier, request schema, response
 * schema and the error codes it can produce.
 *
 * Why this file exists: the router table says *where* a request goes, but not
 * what it accepts, who may call it, or what comes back. Without that, the web
 * client and the Android client are hand-transcribed and drift. The registry is
 * the single source for OpenAPI generation, the generated TypeScript/Kotlin
 * clients, and the coverage report that lists what is still undocumented.
 *
 * Adding an endpoint to the contract is a two-line change: move the Zod schema
 * into `src/contract/schemas/*`, import it in the handler, and add an entry
 * here. `tests/contract/openapi.test.ts` fails if an entry does not match a
 * real route.
 */
import type { EndpointContract, AuthTier } from "./contract-types";
import {
  registerSchema,
  updateUserSchema,
  profileUpdateSchema,
  youtubeChannelSchema,
} from "./schemas/auth";
import {
  watchClaimSchema,
  watchStartSchema,
  watchHeartbeatSchema,
  attentionChallengeAnswerSchema,
} from "./schemas/watch";
import {
  submitVideoSchema,
  reviewAnswersSchema,
  reviewHelpfulSchema,
  reviewSubmitSchema,
  missionCreateSchema,
  missionChainSchema,
  missionCompleteSchema,
  shopPurchaseSchema,
  topupRequestSchema,
  notificationPreferencesSchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
} from "./schemas/content";
import {
  memberResponseSchema,
  watchClaimResponseSchema,
  watchSessionResponseSchema,
  videoListResponseSchema,
  notificationListResponseSchema,
  missionListResponseSchema,
  shopListResponseSchema,
  freeFormDataSchema,
} from "./schemas/responses";
import { communityEndpoints } from "./endpoints/community";
import { feedEndpoints } from "./endpoints/feed";
import { gamificationEndpoints } from "./endpoints/gamification";
import { adminEndpoints } from "./endpoints/admin";
import { integrationsEndpoints } from "./endpoints/integrations";
import { safetyEndpoints } from "./endpoints/safety";
import { supportEndpoints } from "./endpoints/support";
import { discoveryEndpoints } from "./endpoints/discovery";
import { topupsadminEndpoints } from "./endpoints/topups-admin";
import { missionsEndpoints } from "./endpoints/missions";

export type {
  AuthTier,
  QueryParam,
  EndpointContract,
} from "./contract-types";
export { COMMON_ERRORS, TAGS } from "./contract-types";

const AUTH_USER: AuthTier = "user";
const ADMIN: AuthTier = "admin";

const coreEndpoints: EndpointContract[] = [
  // --- Auth ---------------------------------------------------------------
  {
    route: { method: "POST", path: "/api/v1/auth/register" },
    path: "/api/v1/auth/register",
    operationId: "registerAccount",
    summary: "Register (or return) the account for the verified token",
    description:
      "Identity comes exclusively from the bearer token; a client-supplied `firebaseUid` is ignored.",
    tag: "Auth",
    auth: AUTH_USER,
    request: registerSchema,
    response: memberResponseSchema,
    errors: ["CONFLICT", "FORBIDDEN"],
  },
  {
    route: { method: "GET", path: "/api/v1/auth/me" },
    path: "/api/v1/auth/me",
    operationId: "getCurrentAccount",
    summary: "Bootstrap the signed-in member",
    tag: "Auth",
    auth: AUTH_USER,
    response: memberResponseSchema,
  },
  {
    route: { method: "PUT", path: "/api/v1/auth/profile" },
    path: "/api/v1/auth/profile",
    operationId: "updateAccount",
    summary: "Update display name or email",
    tag: "Auth",
    auth: AUTH_USER,
    request: updateUserSchema,
    response: memberResponseSchema,
  },
  {
    route: { method: "GET", path: "/api/v1/auth/permissions" },
    path: "/api/v1/auth/permissions",
    operationId: "getPermissions",
    summary: "Roles and permissions for the caller",
    tag: "Auth",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },

  // --- Users --------------------------------------------------------------
  {
    route: { method: "GET", pattern: "^\\/api\\/v1/users/([^/]+)$" },
    path: "/api/v1/users/{userId}",
    operationId: "getMemberById",
    summary: "Public member profile (respects the member's visibility setting)",
    tag: "Users",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },
  {
    route: { method: "GET", path: "/api/v1/users/me/profile" },
    path: "/api/v1/users/me/profile",
    operationId: "getMyProfile",
    summary: "Full profile of the caller",
    tag: "Users",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },
  {
    route: { method: "PUT", path: "/api/v1/users/me/profile" },
    path: "/api/v1/users/me/profile",
    operationId: "updateMyProfile",
    summary: "Update profile, goals and visibility",
    tag: "Users",
    auth: AUTH_USER,
    request: profileUpdateSchema,
    response: freeFormDataSchema,
  },
  {
    route: { method: "GET", path: "/api/v1/users/me/member" },
    path: "/api/v1/users/me/member",
    operationId: "getMyMemberCard",
    summary: "Member card used by the header and dashboard",
    tag: "Users",
    auth: AUTH_USER,
    response: memberResponseSchema,
  },
  {
    route: { method: "POST", path: "/api/v1/users/me/youtube-channel" },
    path: "/api/v1/users/me/youtube-channel",
    operationId: "linkYouTubeChannel",
    summary: "Link a YouTube channel to the member",
    tag: "Users",
    auth: AUTH_USER,
    request: youtubeChannelSchema,
    response: freeFormDataSchema,
    errors: ["CONFLICT"],
  },
  {
    route: { method: "GET", path: "/api/v1/users/me/insights" },
    path: "/api/v1/users/me/insights",
    operationId: "getMyInsights",
    summary: "Personal growth insights",
    tag: "Users",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },

  // --- Watch --------------------------------------------------------------
  {
    route: { method: "POST", path: "/api/v1/watch/start" },
    path: "/api/v1/watch/start",
    operationId: "startWatchSession",
    summary: "Open a signed watch session",
    description:
      "Returns `{ sessionToken: null, enabled: false }` while `WATCH_SESSIONS_ENABLED` is off; the claim then falls back to weak evidence (SEC-010).",
    tag: "Watch",
    auth: AUTH_USER,
    request: watchStartSchema,
    response: watchSessionResponseSchema,
  },
  {
    route: { method: "POST", path: "/api/v1/watch/heartbeat" },
    path: "/api/v1/watch/heartbeat",
    operationId: "recordWatchHeartbeat",
    summary: "Record a player-time sample",
    tag: "Watch",
    auth: AUTH_USER,
    request: watchHeartbeatSchema,
    response: freeFormDataSchema,
    errors: ["UNAUTHORIZED"],
  },
  {
    route: { method: "POST", path: "/api/v1/watch" },
    path: "/api/v1/watch",
    operationId: "claimWatch",
    summary: "Claim a watched video",
    description:
      "Payout depends on the evidence level: server-verified watch time (YouTube API or signed session) pays; self-reported time is recorded but pays nothing under the `evidence` policy.",
    tag: "Watch",
    auth: AUTH_USER,
    request: watchClaimSchema,
    response: watchClaimResponseSchema,
    errors: ["FORBIDDEN", "DAILY_LIMIT", "CONFLICT"],
  },
  {
    route: { method: "POST", path: "/api/v1/watch/challenge" },
    path: "/api/v1/watch/challenge",
    operationId: "createAttentionChallenge",
    summary: "Issue a mid-watch attention challenge",
    tag: "Watch",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/watch/challenge/([^/]+)/answer$" },
    path: "/api/v1/watch/challenge/{challengeId}/answer",
    operationId: "answerAttentionChallenge",
    summary: "Answer an attention challenge",
    tag: "Watch",
    auth: AUTH_USER,
    request: attentionChallengeAnswerSchema,
    response: freeFormDataSchema,
  },

  // --- Videos -------------------------------------------------------------
  {
    route: { method: "GET", path: "/api/v1/videos" },
    path: "/api/v1/videos",
    operationId: "listVideos",
    summary: "List videos visible to the caller",
    tag: "Videos",
    auth: AUTH_USER,
    response: videoListResponseSchema,
  },
  {
    route: { method: "POST", path: "/api/v1/videos" },
    path: "/api/v1/videos",
    operationId: "submitVideo",
    summary: "Submit a YouTube video to the loop",
    tag: "Videos",
    auth: AUTH_USER,
    request: submitVideoSchema,
    response: freeFormDataSchema,
    errors: ["CONFLICT", "FORBIDDEN"],
  },
  {
    route: { method: "GET", pattern: "^\\/api\\/v1/videos/([^/]+)$" },
    path: "/api/v1/videos/{videoId}",
    operationId: "getVideo",
    summary: "Video detail",
    tag: "Videos",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/videos/([^/]+)/archive$" },
    path: "/api/v1/videos/{videoId}/archive",
    operationId: "archiveVideo",
    summary: "Archive one of the caller's videos",
    tag: "Videos",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },

  // --- Reviews ------------------------------------------------------------
  {
    route: { method: "GET", path: "/api/v1/reviews" },
    path: "/api/v1/reviews",
    operationId: "listReviews",
    summary: "Reviews assigned to or submitted by the caller",
    tag: "Reviews",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },
  {
    route: { method: "GET", pattern: "^\\/api\\/v1/reviews/([^/]+)$" },
    path: "/api/v1/reviews/{reviewId}",
    operationId: "getReview",
    summary: "Review detail with questions",
    tag: "Reviews",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/reviews/([^/]+)/start$" },
    path: "/api/v1/reviews/{reviewId}/start",
    operationId: "startReview",
    summary: "Mark a review in progress",
    tag: "Reviews",
    auth: AUTH_USER,
    response: freeFormDataSchema,
    errors: ["CONFLICT"],
  },
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/reviews/([^/]+)/complete$" },
    path: "/api/v1/reviews/{reviewId}/complete",
    operationId: "completeReview",
    summary: "Complete a review and trigger its single payout",
    tag: "Reviews",
    auth: AUTH_USER,
    request: reviewSubmitSchema,
    response: freeFormDataSchema,
    errors: ["CONFLICT"],
  },
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/reviews/([^/]+)/answers$" },
    path: "/api/v1/reviews/{reviewId}/answers",
    operationId: "saveReviewAnswers",
    summary: "Draft the structured answers for a review",
    tag: "Reviews",
    auth: AUTH_USER,
    request: reviewAnswersSchema,
    response: freeFormDataSchema,
  },
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/reviews/([^/]+)/helpful$" },
    path: "/api/v1/reviews/{reviewId}/helpful",
    operationId: "rateReviewHelpful",
    summary: "Rate a received review as helpful",
    tag: "Reviews",
    auth: AUTH_USER,
    request: reviewHelpfulSchema,
    response: freeFormDataSchema,
    errors: ["CONFLICT"],
  },

  // --- Missions -----------------------------------------------------------
  {
    route: { method: "GET", path: "/api/v1/missions" },
    path: "/api/v1/missions",
    operationId: "listMissions",
    summary: "Missions available to the caller",
    tag: "Missions",
    auth: AUTH_USER,
    response: missionListResponseSchema,
  },
  {
    route: { method: "POST", path: "/api/v1/missions" },
    path: "/api/v1/missions",
    operationId: "createMission",
    summary: "Create a mission (admin)",
    tag: "Missions",
    auth: ADMIN,
    request: missionCreateSchema,
    response: freeFormDataSchema,
    errors: ["FORBIDDEN"],
  },
  {
    route: { method: "POST", path: "/api/v1/missions/chain" },
    path: "/api/v1/missions/chain",
    operationId: "createMissionChain",
    summary: "Create a 2–5 step mission chain (admin)",
    tag: "Missions",
    auth: ADMIN,
    request: missionChainSchema,
    response: freeFormDataSchema,
    errors: ["FORBIDDEN"],
  },
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/missions/([^/]+)/assign$" },
    path: "/api/v1/missions/{missionId}/assign",
    operationId: "assignMission",
    summary: "Assign a mission to the caller",
    tag: "Missions",
    auth: AUTH_USER,
    response: freeFormDataSchema,
    errors: ["CONFLICT"],
  },
  {
    route: { method: "GET", path: "/api/v1/missions/assignments" },
    path: "/api/v1/missions/assignments",
    operationId: "listMissionAssignments",
    summary: "The caller's mission assignments",
    tag: "Missions",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/missions/assignments/([^/]+)/complete$" },
    path: "/api/v1/missions/assignments/{assignmentId}/complete",
    operationId: "completeMissionAssignment",
    summary: "Complete an assignment (pays once)",
    tag: "Missions",
    auth: AUTH_USER,
    request: missionCompleteSchema,
    response: freeFormDataSchema,
    errors: ["CONFLICT"],
  },

  // --- Shop ---------------------------------------------------------------
  {
    route: { method: "GET", path: "/api/v1/shop" },
    path: "/api/v1/shop",
    operationId: "listShopItems",
    summary: "Shop catalogue and the caller's balance",
    tag: "Shop",
    auth: AUTH_USER,
    response: shopListResponseSchema,
  },
  {
    route: { method: "POST", path: "/api/v1/shop/purchase" },
    path: "/api/v1/shop/purchase",
    operationId: "purchaseShopItem",
    summary: "Spend credits on a boost or streak freeze",
    tag: "Shop",
    auth: AUTH_USER,
    request: shopPurchaseSchema,
    response: freeFormDataSchema,
    errors: ["INSUFFICIENT_CREDITS", "CONFLICT"],
  },

  // --- Top-ups (web only) -------------------------------------------------
  {
    route: { method: "GET", path: "/api/v1/topups" },
    path: "/api/v1/topups",
    operationId: "listTopupTiers",
    summary: "Server-defined top-up tiers",
    tag: "Top-ups",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },
  {
    route: { method: "POST", path: "/api/v1/topups" },
    path: "/api/v1/topups",
    operationId: "requestTopup",
    summary: "Request a top-up awaiting admin review",
    description:
      "Web only. The Android app must route purchases through Play Billing (AND-059/060).",
    tag: "Top-ups",
    auth: AUTH_USER,
    request: topupRequestSchema,
    response: freeFormDataSchema,
    errors: ["CONFLICT"],
  },
  {
    route: { method: "GET", path: "/api/v1/topups/mine" },
    path: "/api/v1/topups/mine",
    operationId: "listMyTopups",
    summary: "The caller's top-up requests and their state",
    tag: "Top-ups",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },
  {
    route: { method: "GET", path: "/api/v1/admin/topups" },
    path: "/api/v1/admin/topups",
    operationId: "adminListTopups",
    summary: "Top-up review queue (admin)",
    tag: "Top-ups",
    auth: ADMIN,
    response: freeFormDataSchema,
    errors: ["FORBIDDEN"],
  },

  // --- Notifications ------------------------------------------------------
  {
    route: { method: "GET", path: "/api/v1/notifications" },
    path: "/api/v1/notifications",
    operationId: "listNotifications",
    summary: "Inbox for the caller",
    tag: "Notifications",
    auth: AUTH_USER,
    response: notificationListResponseSchema,
  },
  {
    route: { method: "POST", path: "/api/v1/notifications/read-all" },
    path: "/api/v1/notifications/read-all",
    operationId: "markAllNotificationsRead",
    summary: "Mark the whole inbox read",
    tag: "Notifications",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },
  {
    route: { method: "POST", pattern: "^\\/api\\/v1/notifications/([^/]+)/read$" },
    path: "/api/v1/notifications/{notificationId}/read",
    operationId: "markNotificationRead",
    summary: "Mark one notification read",
    tag: "Notifications",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },
  {
    route: { method: "DELETE", pattern: "^\\/api\\/v1/notifications/([^/]+)$" },
    path: "/api/v1/notifications/{notificationId}",
    operationId: "deleteNotification",
    summary: "Delete one notification",
    tag: "Notifications",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },
  {
    route: { method: "GET", path: "/api/v1/notifications/preferences" },
    path: "/api/v1/notifications/preferences",
    operationId: "getNotificationPreferences",
    summary: "Per-channel notification preferences",
    tag: "Notifications",
    auth: AUTH_USER,
    response: freeFormDataSchema,
  },
  {
    route: { method: "PUT", path: "/api/v1/notifications/preferences" },
    path: "/api/v1/notifications/preferences",
    operationId: "updateNotificationPreferences",
    summary: "Update preferences and quiet hours",
    tag: "Notifications",
    auth: AUTH_USER,
    request: notificationPreferencesSchema,
    response: freeFormDataSchema,
  },
  {
    route: { method: "POST", path: "/api/v1/notifications/push/subscribe" },
    path: "/api/v1/notifications/push/subscribe",
    operationId: "subscribeWebPush",
    summary: "Register a Web Push subscription (web and PWA only)",
    tag: "Notifications",
    auth: AUTH_USER,
    request: pushSubscribeSchema,
    response: freeFormDataSchema,
  },
  {
    route: { method: "POST", path: "/api/v1/notifications/push/unsubscribe" },
    path: "/api/v1/notifications/push/unsubscribe",
    operationId: "unsubscribeWebPush",
    summary: "Remove a Web Push subscription",
    tag: "Notifications",
    auth: AUTH_USER,
    request: pushUnsubscribeSchema,
    response: freeFormDataSchema,
  },
];

/** Operations implemented outside the router table (handled in `index.ts`). */
/**
 * Every documented endpoint: the original core set plus the routes brought into
 * the contract by PLAT-002 (communities, feed, gamification, admin, safety,
 * support, AI, YouTube, discovery and the top-up admin actions).
 */
export const endpoints: EndpointContract[] = [
  ...coreEndpoints,
  ...communityEndpoints,
  ...feedEndpoints,
  ...gamificationEndpoints,
  ...adminEndpoints,
  ...integrationsEndpoints,
  ...safetyEndpoints,
  ...supportEndpoints,
  ...discoveryEndpoints,
  ...topupsadminEndpoints,
  ...missionsEndpoints,
];

export const systemEndpoints: EndpointContract[] = [
  {
    route: { method: "GET", path: "/health" },
    path: "/health",
    operationId: "health",
    summary: "Liveness probe (answers even when configuration is incomplete)",
    tag: "System",
    auth: "public",
    response: freeFormDataSchema,
  },
  {
    route: { method: "GET", path: "/ready" },
    path: "/ready",
    operationId: "ready",
    summary: "Readiness gate — verifies bindings and applied schema",
    tag: "System",
    auth: "public",
    response: freeFormDataSchema,
    errors: ["NOT_READY", "MISSING_ENV"],
  },
  {
    route: { method: "GET", path: "/openapi.json" },
    path: "/openapi.json",
    operationId: "openApiDocument",
    summary: "This document",
    tag: "System",
    auth: "public",
    response: freeFormDataSchema,
  },
];
