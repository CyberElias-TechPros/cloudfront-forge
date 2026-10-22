/**
 * PLAT-012 — rate limiting by identity, with a budget the client can see.
 *
 * The old limiter keyed on IP only and returned a bare boolean. These tests pin
 * the two things that changed: a member is limited on their own budget (so a
 * carrier-NAT neighbourhood does not share one counter), and both the allowed
 * and refused responses publish `X-RateLimit-*` / `Retry-After` so a mobile
 * client can back off without guessing (PLAT-011).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import worker from "../src/index";
import { createTestEnv, type TestEnv } from "./helpers/test-env";

const BASE = "https://api.test";
const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

/** `/auth/me` is the cheapest authenticated endpoint: no D1 work on failure. */
function call(env: TestEnv, headers: Record<string, string> = {}) {
  return worker.fetch(new Request(`${BASE}/api/v1/auth/me`, { headers }), env, ctx);
}

describe("rate limit v2", () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createTestEnv();
    env.AUTH_RATE_LIMIT_MAX_REQUESTS = "2";
    env.RATE_LIMIT_WINDOW = "60";
  });

  it("publishes the budget on successful responses", async () => {
    const response = await call(env, { "CF-Connecting-IP": "203.0.113.10" });
    expect(response.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("1");
    expect(Number(response.headers.get("X-RateLimit-Reset"))).toBeGreaterThan(
      Math.floor(Date.now() / 1000),
    );
    // Nothing is being refused yet, so a client should not be told to wait.
    expect(response.headers.get("Retry-After")).toBeNull();
  });

  it("returns Retry-After on a 429 so the client knows when to come back", async () => {
    const headers = { "CF-Connecting-IP": "203.0.113.11" };
    await call(env, headers);
    await call(env, headers);
    const refused = await call(env, headers);

    expect(refused.status).toBe(429);
    const retryAfter = Number(refused.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
    expect(refused.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(refused.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(((await refused.json()) as { error: { code: string } }).error.code).toBe("RATE_LIMITED");
  });

  it("exposes the new headers to browser clients", async () => {
    const response = await call(env, {
      Origin: "http://localhost:5173",
      "CF-Connecting-IP": "203.0.113.12",
    });
    const exposed = response.headers.get("Access-Control-Expose-Headers") ?? "";
    expect(exposed).toContain("X-RateLimit-Limit");
    expect(exposed).toContain("X-RateLimit-Reset");
    expect(exposed).toContain("Retry-After");
  });

  it("gives each identity its own budget behind one shared IP", async () => {
    // Mobile carriers put thousands of subscribers behind one address. If the
    // IP were the only key, one person's retries would lock out the street.
    const ip = "203.0.113.13";
    for (const member of ["member-a", "member-b", "member-c"]) {
      const first = await call(env, {
        "CF-Connecting-IP": ip,
        Authorization: `Bearer ${member}-token`,
      });
      const second = await call(env, {
        "CF-Connecting-IP": ip,
        Authorization: `Bearer ${member}-token`,
      });
      expect(first.status).not.toBe(429);
      expect(second.status).not.toBe(429);
    }
  });

  it("still caps the shared IP so unlimited free accounts cannot bypass it", async () => {
    const ip = "203.0.113.14";
    // Wide subject allowance (2) × 4 = 8 requests from one address.
    const statuses: number[] = [];
    for (let index = 0; index < 10; index += 1) {
      const response = await call(env, {
        "CF-Connecting-IP": ip,
        Authorization: `Bearer member-${index}-token`,
      });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 8)).not.toContain(429);
    expect(statuses.slice(8)).toEqual([429, 429]);
  });

  it("does not count one identity against another's remaining allowance", async () => {
    const ip = "203.0.113.15";
    await call(env, { "CF-Connecting-IP": ip, Authorization: "Bearer alpha-token" });
    await call(env, { "CF-Connecting-IP": ip, Authorization: "Bearer alpha-token" });

    const other = await call(env, { "CF-Connecting-IP": ip, Authorization: "Bearer beta-token" });
    expect(other.status).not.toBe(429);
    expect(other.headers.get("X-RateLimit-Remaining")).toBe("1");

    // …while the exhausted identity stays exhausted.
    const alpha = await call(env, { "CF-Connecting-IP": ip, Authorization: "Bearer alpha-token" });
    expect(alpha.status).toBe(429);
  });

  it("treats a malformed Authorization header as anonymous rather than crashing", async () => {
    const response = await call(env, {
      Authorization: "Bearer",
      "CF-Connecting-IP": "203.0.113.16",
    });
    expect(response.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(response.status).not.toBe(500);
  });
});

describe("Retry-After on service-unavailable responses (PLAT-011)", () => {
  it("tells a client to wait when the deployment is missing configuration", async () => {
    // `validateEnv` runs once per isolate, so this needs a fresh module graph.
    vi.resetModules();
    const fresh = (await import("../src/index")).default;
    const env = createTestEnv();
    delete (env as Partial<TestEnv>).FIREBASE_PROJECT_ID;
    const response = await fresh.fetch(new Request(`${BASE}/api/v1/users/me/profile`), env, ctx);
    expect(response.status).toBe(503);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("documents Retry-After on 429 and 503 in the published contract", async () => {
    const { buildOpenApiDocument } = await import("../src/contract/openapi");
    const document = buildOpenApiDocument();
    const responses = document.paths["/api/v1/videos"]?.post?.responses as unknown as Record<
      string,
      { headers?: Record<string, unknown> }
    >;
    expect(Object.keys(responses["429"]?.headers ?? {})).toContain("Retry-After");
    expect(Object.keys(responses["503"]?.headers ?? {})).toContain("Retry-After");
  });
});
