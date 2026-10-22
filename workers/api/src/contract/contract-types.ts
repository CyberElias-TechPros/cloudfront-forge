/**
 * Shared vocabulary for the API contract.
 *
 * Lives outside `registry.ts` so the per-domain endpoint modules under
 * `src/contract/endpoints/` can import the types without importing the
 * registry itself (which imports them back).
 */
import type { HttpMethod } from "../types";
import type { z } from "zod";
import type { ErrorCode } from "./errors";

/** Who may call an endpoint. Enforced by `requireAuth`/`requireAdmin` at runtime. */
export type AuthTier = "public" | "user" | "moderator" | "admin";

/** A documented query parameter. */
export interface QueryParam {
  name: string;
  /** Marks the parameter as deprecated in the generated OpenAPI document. */
  deprecated?: boolean;
  /**
   * ISO date at which the endpoint stops working. Required for a deprecated
   * endpoint: a deprecation without a date is just a rumour (RFC 8594 `Sunset`).
   */
  sunset?: string;
  /** OpenAPI type; `string` by default. */
  type?: "string" | "integer" | "boolean" | "number";
  required?: boolean;
  enum?: string[];
  default?: string | number | boolean;
  description?: string;
}

export interface EndpointContract {
  /** Route key — must match a `RouteDefinition` in the router table exactly. */
  route: { method: HttpMethod; path?: string; pattern?: string };
  /** OpenAPI path template (`/api/v1/reviews/{reviewId}`). */
  path: string;
  operationId: string;
  summary: string;
  description?: string;
  tag: string;
  auth: AuthTier;
  request?: z.ZodTypeAny;
  response?: z.ZodTypeAny;
  /** Query parameters, documented in order. */
  query?: QueryParam[];
  /** Request headers the endpoint reads (e.g. `Idempotency-Key`, `If-None-Match`). */
  headers?: QueryParam[];
  /**
   * Request body media type. Defaults to `application/json`; proof uploads are
   * `multipart/form-data` and are documented with a single `file` field.
   */
  contentType?: "application/json" | "multipart/form-data";
  /**
   * Success response media type. Defaults to `application/json`; set this for
   * streams (`text/event-stream`) and binary downloads (`image/*`).
   */
  responseContentType?: "application/json" | "text/event-stream" | "image/*";
  /** Codes this endpoint can return, in addition to the generic set. */
  errors?: ErrorCode[];
  deprecated?: boolean;
  /**
   * ISO date at which the endpoint stops working. Required for a deprecated
   * endpoint: a deprecation without a date is just a rumour (RFC 8594 `Sunset`).
   */
  sunset?: string;
}

/** Codes every authenticated endpoint can produce. */
export const COMMON_ERRORS: ErrorCode[] = [
  "AUTH_REQUIRED",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "SCHEMA_OUT_OF_DATE",
];

export const TAGS = [
  { name: "Auth", description: "Identity bootstrap and profile." },
  { name: "Users", description: "Member profiles, insights and channel links." },
  { name: "Watch", description: "Verified watch sessions and payouts." },
  { name: "Videos", description: "Submissions and archive." },
  { name: "Reviews", description: "Structured peer reviews." },
  { name: "Missions", description: "Missions, chains and assignments." },
  {
    name: "Gamification",
    description: "XP, credits, reputation, streaks, quests and leaderboards.",
  },
  { name: "Feed", description: "The watch queue, the caller's submissions and their activity." },
  { name: "Communities", description: "Squads: roster, join requests, settings and invites." },
  { name: "Shop", description: "Credit sinks." },
  { name: "Top-ups", description: "NGN top-ups (web only — not sold in the Play app)." },
  { name: "Notifications", description: "Inbox, preferences and push registration." },
  { name: "Safety", description: "Reports, appeals and the enforcement trail." },
  { name: "Support", description: "Member support requests and the operator queue." },
  {
    name: "Admin",
    description: "Operator console: analytics, metrics, retention, moderation actions.",
  },
  { name: "AI", description: "The platform-aware coach." },
  { name: "YouTube", description: "Channel linking and OAuth." },
  { name: "Discovery", description: "Search and collaborator matching." },
  { name: "System", description: "Health, readiness and the API document." },
] as const;

const LIMIT_PARAM: QueryParam = {
  name: "limit",
  type: "integer",
  description: "Page size (1–100, default 20).",
};

const OFFSET_PARAM: QueryParam = {
  name: "offset",
  type: "integer",
  description: "Rows to skip (default 0).",
};

/**
 * Pagination for endpoints that support keyset paging (PLAT-016).
 *
 * `offset` stays accepted for one release and is marked deprecated in the
 * generated document, so SDK generators can warn at compile time.
 */
export const PAGINATION: QueryParam[] = [
  LIMIT_PARAM,
  {
    name: "cursor",
    description:
      "Opaque cursor from the previous page's `nextCursor`. Preferred over `offset`: offset paging repeats or skips rows when new rows are inserted mid-scroll.",
  },
  {
    ...OFFSET_PARAM,
    description:
      "Deprecated: rows to skip (default 0). Kept for one release; cursor requests are stable under concurrent writes. Responses that use it carry `Deprecation`, `Sunset` and `Warning` headers.",
    deprecated: true,
  },
];

/** Pagination for list endpoints that still page by offset only. */
export const OFFSET_PAGINATION: QueryParam[] = [LIMIT_PARAM, OFFSET_PARAM];
