/**
 * integrations endpoints — generated into the contract registry (PLAT-002).
 *
 * One entry per route in the router table; `tests/contract/openapi.test.ts` fails
 * if an entry does not match a real route, so these cannot drift.
 */
import type { EndpointContract } from "../contract-types";
import { freeFormDataSchema } from "../schemas/responses";
import { aiChatSchema } from "../schemas/moderation";
import { channelListResponseSchema, accountDeleteResponseSchema, aiChatResponseSchema, aiConversationListResponseSchema, aiMessageListResponseSchema, actionMessageSchema, youtubeAuthorizeResponseSchema, youtubeStatusResponseSchema } from "../schemas/views";

export const integrationsEndpoints: EndpointContract[] = [
  {
    route: { method: "GET", path: "/api/v1/users/me/youtube-channels" },
    path: "/api/v1/users/me/youtube-channels",
    operationId: "listMyYouTubeChannels",
    summary: "YouTube channels linked to the caller",
    tag: "Users",
    auth: "user",
    response: channelListResponseSchema,
  },
  {
    route: { method: "DELETE", path: "/api/v1/users/me" },
    path: "/api/v1/users/me",
    operationId: "deleteMyAccount",
    summary: "Delete the account and schedule data erasure",
    tag: "Users",
    auth: "user",
    response: accountDeleteResponseSchema,
    errors: ["CONFLICT"],
  },
  {
    route: { method: "POST", path: "/api/v1/ai/chat" },
    path: "/api/v1/ai/chat",
    operationId: "chatWithCoach",
    summary: "Ask the platform-aware growth coach a question",
    tag: "AI",
    auth: "user",
    request: aiChatSchema,
    response: aiChatResponseSchema,
    errors: ["AI_NOT_CONFIGURED", "AI_UNAVAILABLE", "QUOTA_EXCEEDED"],
  },
  {
    route: { method: "POST", path: "/api/v1/ai/chat/stream" },
    path: "/api/v1/ai/chat/stream",
    operationId: "streamChatWithCoach",
    summary: "Same as /ai/chat but streams tokens",
    description:
      "Responds with text/event-stream chunks rather than one JSON envelope.",
      responseContentType: "text/event-stream",
    tag: "AI",
    auth: "user",
    request: aiChatSchema,
    response: freeFormDataSchema,
    errors: ["AI_UNAVAILABLE", "QUOTA_EXCEEDED"],
  },
  {
    route: { method: "GET", path: "/api/v1/ai/conversations" },
    path: "/api/v1/ai/conversations",
    operationId: "listAiConversations",
    summary: "The caller's AI conversations",
    tag: "AI",
    auth: "user",
    response: aiConversationListResponseSchema,
  },
  {
    route: { method: "GET", pattern: "^\\/api\\/v1/ai/conversations/([^/]+)/messages$" },
    path: "/api/v1/ai/conversations/{conversationId}/messages",
    operationId: "listAiMessages",
    summary: "Messages in one conversation",
    tag: "AI",
    auth: "user",
    response: aiMessageListResponseSchema,
  },
  {
    route: { method: "DELETE", pattern: "^\\/api\\/v1/ai/conversations/([^/]+)$" },
    path: "/api/v1/ai/conversations/{conversationId}",
    operationId: "deleteAiConversation",
    summary: "Delete a conversation and its messages",
    tag: "AI",
    auth: "user",
    response: actionMessageSchema,
  },
  {
    route: { method: "GET", path: "/api/v1/youtube/oauth/authorize" },
    path: "/api/v1/youtube/oauth/authorize",
    operationId: "startYouTubeAuthorization",
    summary: "Begin the YouTube OAuth flow",
    tag: "YouTube",
    auth: "user",
    response: youtubeAuthorizeResponseSchema,
    errors: ["SERVICE_UNAVAILABLE"],
  },
  {
    route: { method: "GET", path: "/api/v1/youtube/oauth/callback" },
    path: "/api/v1/youtube/oauth/callback",
    operationId: "youTubeOAuthCallback",
    summary: "OAuth redirect target (bounces back to the SPA)",
    description:
      "Google redirects the browser here; the handler then redirects to the SPA with a result flag.",
    tag: "YouTube",
    auth: "public",
    response: freeFormDataSchema,
    query: [{ name: "code" },
      { name: "state", required: true },
      { name: "error" }],
  },
  {
    route: { method: "POST", path: "/api/v1/youtube/oauth/callback" },
    path: "/api/v1/youtube/oauth/callback",
    operationId: "completeYouTubeOAuth",
    summary: "Finish the OAuth exchange from a client",
    tag: "YouTube",
    auth: "public",
    response: actionMessageSchema,
    errors: ["BAD_REQUEST", "SERVICE_UNAVAILABLE"],
  },
  {
    route: { method: "GET", path: "/api/v1/youtube/status" },
    path: "/api/v1/youtube/status",
    operationId: "getYouTubeStatus",
    summary: "Whether the caller has a usable YouTube connection",
    tag: "YouTube",
    auth: "user",
    response: youtubeStatusResponseSchema,
  },
  {
    route: { method: "POST", path: "/api/v1/youtube/disconnect" },
    path: "/api/v1/youtube/disconnect",
    operationId: "disconnectYouTube",
    summary: "Revoke the stored YouTube tokens",
    tag: "YouTube",
    auth: "user",
    response: actionMessageSchema,
  },
];
