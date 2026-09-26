import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import worker from "../src/index";
import { createTestEnv, authRequest, type TestEnv } from "./helpers/test-env";
import { errorHandler } from "../src/middleware/errorHandler";
import { DatabaseError } from "../src/lib/database";

const BASE = "https://api.test";

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

function call(env: TestEnv, path: string, init: RequestInit = {}) {
  return worker.fetch(new Request(`${BASE}${path}`, init), env, ctx);
}

async function json(response: Response) {
  return (await response.json()) as { status?: string; error?: { code: string }; data?: unknown };
}

describe("worker entry point", () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createTestEnv();
    env.CORS_ORIGINS = "https://loop.vercel.app,*.preview.vercel.app";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers /health even when the environment is incomplete", async () => {
    const bare = createTestEnv();
    delete (bare as Partial<TestEnv>).FIREBASE_PROJECT_ID;
    const response = await call(bare, "/health");
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.status).toBe("ok");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("reports a missing secret as a 503 instead of silently misbehaving", async () => {
    vi.resetModules();
    const fresh = (await import("../src/index")).default;
    const bare = createTestEnv();
    delete (bare as Partial<TestEnv>).FIREBASE_PROJECT_ID;
    const response = await fresh.fetch(new Request(`${BASE}/api/v1/users/me/profile`), bare, ctx);
    expect(response.status).toBe(503);
    const body = await json(response);
    expect(body.error?.code).toBe("MISSING_ENV");
  });

  it("reports ready only after the current D1 schema is present", async () => {
    const response = await call(env, "/ready");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { status: string; schemaVersion: string };
    };
    expect(body.data).toMatchObject({ status: "ready", schemaVersion: "037" });
  });

  it("fails readiness when a required migration object is missing", async () => {
    env.sqlite.exec("DROP TABLE support_requests");
    const response = await call(env, "/ready");
    expect(response.status).toBe(503);
    expect((await json(response)).error?.code).toBe("NOT_READY");
  });

  it("answers preflight requests", async () => {
    const response = await call(env, "/api/v1/auth/me", {
      method: "OPTIONS",
      headers: { Origin: "https://loop.vercel.app" },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://loop.vercel.app");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("does not echo a CORS header for origins outside the allow-list", async () => {
    const response = await call(env, "/api/v1/auth/me", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example" },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("matches *. subdomain entries in the allow-list", async () => {
    const response = await call(env, "/api/v1/auth/me", {
      method: "OPTIONS",
      headers: { Origin: "https://pr-123.preview.vercel.app" },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://pr-123.preview.vercel.app",
    );
  });

  it("returns 404 JSON for unknown routes", async () => {
    const response = await call(env, "/api/v1/nope");
    expect(response.status).toBe(404);
    expect((await json(response)).error?.code).toBe("NOT_FOUND");
  });

  it("adds security headers to every response", async () => {
    const response = await call(env, "/api/v1/nope");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBeTruthy();
    expect(response.headers.get("X-Frame-Options")).toBeTruthy();
  });

  it("rate-limits auth endpoints per IP", async () => {
    const limited = createTestEnv();
    limited.AUTH_RATE_LIMIT_MAX_REQUESTS = "2";
    const request = () =>
      call(limited, "/api/v1/auth/me", {
        headers: { "CF-Connecting-IP": "203.0.113.9" },
      });

    await request();
    await request();
    const third = await request();
    expect(third.status).toBe(429);
    expect((await json(third)).error?.code).toBe("RATE_LIMITED");
  });

  it("tracks rate limits per IP, not globally", async () => {
    const limited = createTestEnv();
    limited.AUTH_RATE_LIMIT_MAX_REQUESTS = "1";
    const hit = (ip: string) =>
      call(limited, "/api/v1/auth/me", { headers: { "CF-Connecting-IP": ip } });

    expect((await hit("203.0.113.1")).status).not.toBe(429);
    expect((await hit("203.0.113.2")).status).not.toBe(429);
    expect((await hit("203.0.113.1")).status).toBe(429);
  });

  it("routes /api/v1/leaderboards to the gamification handler", async () => {
    const response = await call(env, "/api/v1/leaderboards?timeframe=weekly");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { timeframe: string; items: unknown[] } };
    expect(body.data.timeframe).toBe("weekly");
  });

  it("rejects an unknown HTTP method on a known path", async () => {
    const response = await call(env, "/api/v1/leaderboards", { method: "DELETE" });
    expect(response.status).toBe(404);
  });
  describe("schema drift (Worker deployed ahead of D1 migrations)", () => {
    function dropUserStatusColumn() {
      // Recreates production before migration 031: no users.status column.
      env.sqlite.exec("DROP INDEX IF EXISTS idx_users_status");
      env.sqlite.exec("ALTER TABLE users DROP COLUMN status");
    }

    it("still lets members register and sign in when users.status is missing", async () => {
      dropUserStatusColumn();
      vi.spyOn(console, "error").mockImplementation(() => {});
      const response = await worker.fetch(
        authRequest(`${BASE}/api/v1/auth/register`, "uid-drift", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: "Drift Tester" }),
        }),
        env,
        ctx,
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { data: { user: { displayName: string } } };
      expect(body.data.user.displayName).toBe("Drift Tester");
    });

    it("keeps rejecting deleted accounts on the fallback path", async () => {
      const uid = "uid-drift-deleted";
      const id = env.seedUser(uid);
      env.sqlite
        .prepare("UPDATE users SET deleted_at = ? WHERE id = ?")
        .run(new Date().toISOString(), id);
      dropUserStatusColumn();
      vi.spyOn(console, "error").mockImplementation(() => {});
      const response = await worker.fetch(authRequest(`${BASE}/api/v1/auth/me`, uid), env, ctx);
      expect(response.status).toBe(403);
      expect((await json(response)).error?.code).toBe("ACCOUNT_DELETED");
    });

    it("fails readiness until the newest migration (037) is applied", async () => {
      env.sqlite.exec("ALTER TABLE users DROP COLUMN welcome_sent_at");
      vi.spyOn(console, "error").mockImplementation(() => {});
      const response = await call(env, "/ready");
      expect(response.status).toBe(503);
    });

    it("maps missing tables/columns to 503 SCHEMA_OUT_OF_DATE, not a generic 500", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const drift = errorHandler(
        new DatabaseError("D1_ERROR: no such column: status: SQLITE_ERROR", "SELECT status"),
      );
      expect(drift.status).toBe(503);
      expect(drift.headers.get("Retry-After")).toBe("60");
      expect((await json(drift)).error?.code).toBe("SCHEMA_OUT_OF_DATE");

      const other = errorHandler(new DatabaseError("UNIQUE constraint failed: users.id"));
      expect(other.status).toBe(500);
      expect((await json(other)).error?.code).toBe("DATABASE_ERROR");
    });
  });
});
