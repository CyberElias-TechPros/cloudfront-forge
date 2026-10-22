/**
 * Rate limiting (PLAT-012).
 *
 * Two things were wrong with the first version:
 *
 * 1. **It keyed on IP only.** Carrier NAT puts a whole neighbourhood behind one
 *    address, so one heavy user punished everyone, while a single user on a
 *    rotating mobile connection could exceed any budget. Authenticated requests
 *    are now bucketed by a hash of the bearer token (a stable identity that does
 *    not require verifying it first, so limiting still happens before the
 *    expensive work), with the coarse IP as a second, wider bucket.
 * 2. **It returned a boolean**, so a 429 told the client nothing. It now returns
 *    the budget, the remaining allowance and the reset time, which the entry
 *    point publishes as `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
 *    `X-RateLimit-Reset` and `Retry-After`.
 *
 * The subject hash is deliberately truncated: it only needs to be stable for
 * the length of a window, not reversible.
 */
import type { Env } from "../types";
import { createLogger } from "../lib/logger";

export interface RateLimitOptions {
  maxRequests?: number;
  windowSeconds?: number;
  failClosed?: boolean;
  keyPrefix?: string;
  /**
   * Requests allowed from the shared IP bucket per window. Defaults to
   * `maxRequests × 4`, which leaves room for a household or a small office while
   * still stopping one address from running a botnet of free accounts.
   */
  ipMaxRequests?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch seconds at which the window resets. */
  resetAt: number;
  /** `Retry-After` in seconds — how long until the bucket has room. */
  retryAfterSeconds: number;
  /** Which bucket refused, for logging. */
  bucket?: "subject" | "ip";
}

interface Counter {
  count: number;
  resetTime: number;
}

/** SHA-256 → 16 hex chars. Stable within a window, not reversible. */
async function subjectHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function ipOf(request: Request): string {
  const forwarded =
    request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  return forwarded.split(",")[0]?.trim() ?? "unknown";
}

async function increment(env: Env, key: string, windowSeconds: number): Promise<Counter> {
  const current = (await env.KV_CACHE.get(key, { type: "json" })) as Counter | null;
  const now = Date.now();
  const live =
    current && current.resetTime > now
      ? current
      : { count: 0, resetTime: now + windowSeconds * 1000 };

  const next: Counter = { count: live.count + 1, resetTime: live.resetTime };
  const ttl = Math.max(1, Math.ceil((live.resetTime - now) / 1000));
  await env.KV_CACHE.put(key, JSON.stringify(next), { expirationTtl: ttl });
  return next;
}

export async function rateLimitMiddleware(
  request: Request,
  env: Env,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const logger = createLogger(env);
  const {
    maxRequests = parseInt(env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
    windowSeconds = parseInt(env.RATE_LIMIT_WINDOW || "60", 10),
    failClosed = false,
    keyPrefix = "general",
  } = options;
  const ipMaxRequests = options.ipMaxRequests ?? maxRequests * 4;

  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";

  try {
    // Authenticated callers get their own budget…
    if (token) {
      const subject = await subjectHash(token);
      const subjectCounter = await increment(
        env,
        `rate_limit:${keyPrefix}:subject:${subject}`,
        windowSeconds,
      );
      // …but a single address still cannot aggregate unlimited accounts.
      const ipCounter = await increment(
        env,
        `rate_limit:${keyPrefix}:ip:${ipOf(request)}`,
        windowSeconds,
      );

      const subjectBudget: RateLimitResult = {
        allowed: subjectCounter.count <= maxRequests,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - subjectCounter.count),
        resetAt: Math.ceil(subjectCounter.resetTime / 1000),
        retryAfterSeconds: Math.max(1, Math.ceil((subjectCounter.resetTime - Date.now()) / 1000)),
        bucket: "subject",
      };
      const ipBudget: RateLimitResult = {
        allowed: ipCounter.count <= ipMaxRequests,
        limit: ipMaxRequests,
        remaining: Math.max(0, ipMaxRequests - ipCounter.count),
        resetAt: Math.ceil(ipCounter.resetTime / 1000),
        retryAfterSeconds: Math.max(1, Math.ceil((ipCounter.resetTime - Date.now()) / 1000)),
        bucket: "ip",
      };

      // Publish the bucket the caller is actually up against: a refused bucket
      // wins, otherwise whichever has less headroom. Reporting the roomy bucket
      // while the other is about to refuse would make `Retry-After` a surprise.
      const binding = !subjectBudget.allowed
        ? subjectBudget
        : !ipBudget.allowed
          ? ipBudget
          : subjectBudget.remaining <= ipBudget.remaining
            ? subjectBudget
            : ipBudget;
      return { ...binding, allowed: subjectBudget.allowed && ipBudget.allowed };
    }

    // Anonymous: the address is all we have, so it gets exactly the endpoint's
    // budget — not the wider allowance reserved for many members behind one NAT.
    const counter = await increment(
      env,
      `rate_limit:${keyPrefix}:ip:${ipOf(request)}`,
      windowSeconds,
    );
    const allowed = counter.count <= maxRequests;
    return {
      allowed,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - counter.count),
      resetAt: Math.ceil(counter.resetTime / 1000),
      retryAfterSeconds: Math.max(1, Math.ceil((counter.resetTime - Date.now()) / 1000)),
      bucket: "ip",
    };
  } catch (error) {
    logger.error("Rate limit error", error);
    // Fail-open for general endpoints, fail-closed for critical endpoints.
    const allowed = !failClosed;
    return {
      allowed,
      limit: maxRequests,
      remaining: allowed ? maxRequests : 0,
      resetAt: Math.ceil((Date.now() + windowSeconds * 1000) / 1000),
      retryAfterSeconds: windowSeconds,
    };
  }
}

/** Headers a client can use to back off intelligently. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  };
  if (!result.allowed) headers["Retry-After"] = String(result.retryAfterSeconds);
  return headers;
}
