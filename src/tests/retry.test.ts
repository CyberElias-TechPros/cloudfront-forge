import { describe, it, expect } from "vitest";
import { MAX_ATTEMPTS, parseRetryAfter, retryDelayMs, shouldRetry } from "@/lib/retry";

/**
 * PLAT-011 — the retry policy exists so a member on a flaky connection sees a
 * recovered screen instead of an error, without ever duplicating a write.
 */
describe("retry policy", () => {
  it("reads Retry-After as seconds", () => {
    expect(parseRetryAfter("12")).toBe(12);
    expect(parseRetryAfter("0")).toBe(0);
    expect(parseRetryAfter("  30 ")).toBe(30);
  });

  it("reads Retry-After as an HTTP date", () => {
    const now = Date.parse("2026-10-22T12:00:00Z");
    expect(parseRetryAfter("Thu, 22 Oct 2026 12:00:30 GMT", now)).toBe(30);
    // A date in the past means "now", not a negative wait.
    expect(parseRetryAfter("Thu, 22 Oct 2026 11:59:00 GMT", now)).toBe(0);
  });

  it("ignores nonsense instead of sleeping for NaN milliseconds", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("")).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
    expect(parseRetryAfter("-5")).toBeNull();
  });

  it("honours the server's wait over its own backoff", () => {
    // 2 s from the server beats 300 ms × 2^0 locally.
    expect(retryDelayMs(0, "2")).toBe(2000);
    // …but is capped so a spinner never hangs indefinitely.
    expect(retryDelayMs(0, "3600")).toBe(8000);
  });

  it("backs off exponentially with jitter when the server says nothing", () => {
    const fixed = () => 1; // maximum jitter
    expect(retryDelayMs(0, null, fixed)).toBe(450);
    expect(retryDelayMs(1, null, fixed)).toBe(900);
    expect(retryDelayMs(2, null, fixed)).toBe(1800);
    // Without jitter the same attempt is the plain base delay.
    expect(retryDelayMs(0, null, () => 0)).toBe(300);
  });

  it("retries reads on transient statuses and network failures", () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      expect(shouldRetry({ status, method: "GET", attempt: 0 })).toBe(true);
    }
    expect(shouldRetry({ method: "GET", attempt: 0 })).toBe(true);
  });

  it("never retries a write or a client mistake", () => {
    // Replaying a POST could double-charge; only idempotency-keyed calls may retry.
    expect(shouldRetry({ status: 503, method: "POST", attempt: 0 })).toBe(false);
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(shouldRetry({ status, method: "GET", attempt: 0 })).toBe(false);
    }
  });

  it("stops after the attempt cap", () => {
    expect(shouldRetry({ status: 503, method: "GET", attempt: MAX_ATTEMPTS - 1 })).toBe(true);
    expect(shouldRetry({ status: 503, method: "GET", attempt: MAX_ATTEMPTS })).toBe(false);
  });
});
