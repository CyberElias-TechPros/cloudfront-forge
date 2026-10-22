/**
 * The error-code registry — the single source of truth for every code the API
 * can return.
 *
 * Clients (web, Android, future SDKs) branch on `error.code`, never on the
 * English message. Registry entries therefore carry the HTTP status they map
 * to, whether the caller may retry the same request, and the user-facing
 * guidance the clients render. `tests/contract/errors.test.ts` fails if a
 * handler returns a code that is not declared here.
 */

export interface ErrorCodeSpec {
  /** HTTP status the code is always returned with. */
  status: number;
  /** True when replaying the identical request may succeed later. */
  retryable: boolean;
  /** One-line description for the OpenAPI document. */
  description: string;
  /** What a client should offer the member (used by both apps' error UI). */
  action: "sign_in" | "retry" | "wait" | "fix_input" | "upgrade" | "contact_support" | "none";
}

export const ERROR_CODES = {
  // --- Generic request handling -------------------------------------------
  VALIDATION_ERROR: {
    status: 400,
    retryable: false,
    description: "The payload failed schema validation.",
    action: "fix_input",
  },
  BAD_REQUEST: {
    status: 400,
    retryable: false,
    description: "The request was malformed.",
    action: "fix_input",
  },
  UNAUTHORIZED: {
    status: 401,
    retryable: false,
    description: "The presented credential is not valid for this request.",
    action: "sign_in",
  },
  AUTH_REQUIRED: {
    status: 401,
    retryable: false,
    description: "A Firebase ID token is required (or it expired).",
    action: "sign_in",
  },
  AUTH_ERROR: {
    status: 401,
    retryable: false,
    description: "Authentication could not be completed.",
    action: "sign_in",
  },
  FORBIDDEN: {
    status: 403,
    retryable: false,
    description: "The authenticated member is not allowed to perform this action.",
    action: "none",
  },
  ACCOUNT_DELETED: {
    status: 403,
    retryable: false,
    description: "This account has been deleted.",
    action: "contact_support",
  },
  ACCOUNT_SUSPENDED: {
    status: 403,
    retryable: false,
    description: "This account is suspended.",
    action: "contact_support",
  },
  ACCOUNT_BANNED: {
    status: 403,
    retryable: false,
    description: "This account has been banned.",
    action: "contact_support",
  },
  SUBMISSION_COOLDOWN: {
    status: 429,
    retryable: true,
    description: "The member submitted a video too recently (one per cooldown window).",
    action: "wait",
  },
  RATIO_GATE: {
    status: 403,
    retryable: false,
    description: "The member's give/take ratio is below the minimum required to submit.",
    action: "none",
  },
  CHANNEL_CONFLICT: {
    status: 409,
    retryable: false,
    description: "This YouTube channel is already linked to another account.",
    action: "contact_support",
  },
  AI_NOT_CONFIGURED: {
    status: 503,
    retryable: true,
    description: "The AI coach is not configured on this deployment.",
    action: "none",
  },
  NOT_FOUND: {
    status: 404,
    retryable: false,
    description: "The requested resource does not exist (or is not visible to this member).",
    action: "none",
  },
  CONFLICT: {
    status: 409,
    retryable: false,
    description: "The request conflicts with the current state of the resource.",
    action: "none",
  },
  IDEMPOTENCY_CONFLICT: {
    status: 409,
    retryable: false,
    description:
      "The Idempotency-Key was already used with a different request body. Use a new key for a new operation.",
    action: "fix_input",
  },
  INSUFFICIENT_CREDITS: {
    status: 400,
    retryable: false,
    description: "The member does not have enough credits for this purchase.",
    action: "upgrade",
  },
  DAILY_LIMIT: {
    status: 429,
    retryable: true,
    description: "A per-day allowance (e.g. claimable watches) is exhausted.",
    action: "wait",
  },
  RATE_LIMITED: {
    status: 429,
    retryable: true,
    description: "Too many requests from this client in the current window.",
    action: "wait",
  },
  QUOTA_EXCEEDED: {
    status: 429,
    retryable: true,
    description: "A member- or platform-level quota (e.g. AI messages) is exhausted.",
    action: "wait",
  },
  INTERNAL_ERROR: {
    status: 500,
    retryable: true,
    description: "An unexpected server error. Safe to retry with backoff.",
    action: "retry",
  },
  DATABASE_ERROR: {
    status: 500,
    retryable: true,
    description: "The database operation failed. Safe to retry with backoff.",
    action: "retry",
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    retryable: true,
    description: "A dependency is unavailable. Respect `Retry-After`.",
    action: "retry",
  },
  AI_UNAVAILABLE: {
    status: 503,
    retryable: true,
    description: "The AI provider is not configured or is failing.",
    action: "retry",
  },
  MISSING_ENV: {
    status: 503,
    retryable: true,
    description: "The deployment is missing a required binding or secret.",
    action: "contact_support",
  },
  SCHEMA_OUT_OF_DATE: {
    status: 503,
    retryable: true,
    description: "Migrations have not been applied yet; the service is being updated.",
    action: "retry",
  },
  NOT_READY: {
    status: 503,
    retryable: true,
    description: "A readiness dependency failed (`/ready` gate).",
    action: "retry",
  },
} as const satisfies Record<string, ErrorCodeSpec>;

export type ErrorCode = keyof typeof ERROR_CODES;

export const ERROR_CODE_NAMES = Object.keys(ERROR_CODES) as ErrorCode[];

export function isErrorCode(value: string): value is ErrorCode {
  return Object.prototype.hasOwnProperty.call(ERROR_CODES, value);
}

/** HTTP status for a code, or 500 for an unregistered code (which tests forbid). */
export function statusForErrorCode(code: string): number {
  return isErrorCode(code) ? ERROR_CODES[code].status : 500;
}
