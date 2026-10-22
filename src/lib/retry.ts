/**
 * Client retry policy (PLAT-011).
 *
 * The API now tells a client *when* to come back (`Retry-After` on 429/503) and
 * *how much* budget is left (`X-RateLimit-*`). This module turns that advice
 * into behaviour: honour the server's number when it gives one, otherwise back
 * off exponentially with jitter, and give up after a few attempts instead of
 * retrying forever on a connection that is clearly not coming back.
 *
 * Deliberate limits:
 * - **Reads only.** Replaying a POST can duplicate a purchase. Writes are safe
 *   only when they carry an `Idempotency-Key`, which the call sites that need it
 *   pass explicitly — the blanket retry path never touches them.
 * - **Jitter, not fixed sleeps.** A thousand phones reconnecting after an outage
 *   would otherwise retry in lockstep and re-create the outage (thundering herd).
 */

/** Statuses worth another attempt. 4xx other than 408/429 are our own fault. */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 300;
const MAX_DELAY_MS = 8_000;

export interface RetryInput {
  /** HTTP status, or `undefined` for a network/DNS/timeout failure. */
  status?: number | undefined;
  method?: string | undefined;
  attempt: number;
  retryAfterHeader?: string | null | undefined;
}

/** `Retry-After` is seconds or an HTTP date; both forms appear in the wild. */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return seconds >= 0 ? seconds : null;
  }
  // `Date.parse` is forgiving enough to read "-5" as a year; an HTTP date always
  // contains whitespace or a letter (e.g. "Thu, 22 Oct 2026 12:00:30 GMT").
  if (!/[a-z\s,]/i.test(trimmed)) return null;
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - now) / 1000));
}

export function shouldRetry({ status, method = "GET", attempt }: RetryInput): boolean {
  if (attempt >= MAX_ATTEMPTS) return false;
  if (method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD") return false;
  // A request that never reached the server is always worth retrying.
  if (status === undefined) return true;
  return RETRYABLE_STATUSES.has(status);
}

/**
 * Milliseconds to wait before attempt `attempt + 1`.
 *
 * The server's `Retry-After` wins when present (it knows when the window
 * resets); otherwise `base × 2^attempt` with up to 50 % jitter, capped so a UI
 * spinner never hangs for longer than a user will tolerate.
 */
export function retryDelayMs(
  attempt: number,
  retryAfterHeader?: string | null,
  random: () => number = Math.random,
): number {
  const serverAdvice = parseRetryAfter(retryAfterHeader);
  if (serverAdvice !== null) return Math.min(serverAdvice * 1000, MAX_DELAY_MS);
  const exponential = BASE_DELAY_MS * 2 ** Math.max(0, attempt);
  const jitter = exponential * 0.5 * random();
  return Math.min(Math.round(exponential + jitter), MAX_DELAY_MS);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
