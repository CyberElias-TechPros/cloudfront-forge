/**
 * feed endpoints — generated into the contract registry (PLAT-002).
 *
 * One entry per route in the router table; `tests/contract/openapi.test.ts` fails
 * if an entry does not match a real route, so these cannot drift.
 */
import type { EndpointContract } from "../contract-types";
import { queueResponseSchema, submissionListResponseSchema, activityResponseSchema } from "../schemas/views";

export const feedEndpoints: EndpointContract[] = [
  {
    route: { method: "GET", path: "/api/v1/queue" },
    path: "/api/v1/queue",
    operationId: "getWatchQueue",
    summary: "The next video the caller should watch",
    tag: "Feed",
    auth: "user",
    response: queueResponseSchema,
    query: [{ name: "communityId", description: "Restrict the queue to one squad." },
      { name: "limit", type: "integer", description: "Page size (1–100, default 20)." },
      { name: "offset", type: "integer", description: "Rows to skip (default 0)." }],
  },
  {
    route: { method: "GET", path: "/api/v1/submissions" },
    path: "/api/v1/submissions",
    operationId: "listMySubmissions",
    summary: "The caller's videos and the attention each one earned",
    tag: "Feed",
    auth: "user",
    response: submissionListResponseSchema,
    query: [
      { name: "limit", type: "integer", description: "Page size (1–100, default 20)." },
      { name: "offset", type: "integer", description: "Rows to skip (default 0)." },
    ],
  },
  {
    route: { method: "GET", path: "/api/v1/activity" },
    path: "/api/v1/activity",
    operationId: "getActivity",
    summary: "Unread notifications for the caller (the activity bell)",
    tag: "Feed",
    auth: "user",
    response: activityResponseSchema,
    query: [
      { name: "limit", type: "integer", description: "Page size (1–100, default 20)." },
      { name: "offset", type: "integer", description: "Rows to skip (default 0)." },
    ],
  },
];
