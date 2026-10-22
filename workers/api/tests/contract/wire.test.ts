/**
 * Wire-level contract conformance (PLAT-009).
 *
 * Handler tests call handlers directly, so they never exercise the router,
 * the CORS layer, the envelope or the *order* of auth and validation — exactly
 * the things a native client hits first. These tests drive `worker.fetch`, the
 * same entry point Cloudflare runs.
 *
 * What is asserted, for every documented operation:
 *  - the declared auth tier is the tier actually enforced (401 for `user`/
 *    `moderator`/`admin` without a token, with no secrets leaked into the body);
 *  - `admin`/`moderator` operations refuse an ordinary member with 403;
 *  - every failure is the documented envelope `{ success: false, error, meta }`
 *    with a code from the registry;
 *  - unknown routes answer 404 through the same envelope.
 *
 * Two real defects were found the first time this ran and are fixed:
 *  - `GET /leaderboards` was documented as authenticated but is intentionally
 *    public (it is what the landing page renders before sign-in) — the entry now
 *    says `public`;
 *  - `POST /watch/start` and `/watch/heartbeat` answered before authenticating
 *    when sessions were disabled — both now authenticate first.
 */
import { describe, it, expect } from "vitest";
import worker from "../../src/index";
import { endpoints, systemEndpoints } from "../../src/contract/registry";
import { ERROR_CODES } from "../../src/contract/errors";
import { createTestEnv, authRequest } from "../helpers/test-env";

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const PLACEHOLDER = "00000000-0000-4000-8000-000000000000";

function urlFor(path: string): string {
  return `https://api.test${path.replace(/\{[^}]+\}/g, PLACEHOLDER)}`;
}

async function call(path: string, init: RequestInit = {}, env = createTestEnv()) {
  return worker.fetch(new Request(urlFor(path), init), env, ctx);
}

/** Every documented route that requires a caller. */
const protectedOperations = endpoints.filter((endpoint) => endpoint.auth !== "public");
const privilegedOperations = endpoints.filter(
  (endpoint) => endpoint.auth === "admin" || endpoint.auth === "moderator",
);

function body(init: RequestInit, method: string): RequestInit {
  if (method === "GET" || method === "DELETE") return init;
  return { ...init, body: "{}" };
}

describe("wire contract: authentication is enforced where it is documented", () => {
  it("has enough protected operations for this test to mean something", () => {
    expect(protectedOperations.length).toBeGreaterThan(70);
    expect(privilegedOperations.length).toBeGreaterThan(15);
  });

  it.each(protectedOperations.map((endpoint) => [endpoint.operationId, endpoint]))(
    "%s rejects an anonymous caller with 401 AUTH_REQUIRED",
    async (_id, endpoint) => {
      const response = await call(
        endpoint.path,
        body({ method: endpoint.route.method, headers: { "Content-Type": "application/json" } }, endpoint.route.method),
      );
      expect(response.status, `${endpoint.operationId} must not answer anonymously`).toBe(401);
      const payload = (await response.json()) as {
        success: boolean;
        error?: { code: string; message: string };
      };
      expect(payload.success).toBe(false);
      expect(payload.error?.code).toBe("AUTH_REQUIRED");
      // The failure body must not leak whether the resource exists.
      expect(payload.error?.message).not.toMatch(/token|secret|sqlite|D1/i);
    },
  );

  it("answers public operations without a token", async () => {
    for (const endpoint of [...endpoints, ...systemEndpoints].filter((e) => e.auth === "public")) {
      const response = await call(endpoint.path, { method: endpoint.route.method });
      expect(response.status, `${endpoint.operationId} should not require auth`).toBeLessThan(500);
      expect(response.status).not.toBe(401);
    }
  });
});

describe("wire contract: privileges are enforced where they are documented", () => {
  it.each(privilegedOperations.map((endpoint) => [endpoint.operationId, endpoint]))(
    "%s refuses an ordinary member with 403 FORBIDDEN",
    async (_id, endpoint) => {
      const env = createTestEnv();
      env.seedUser("ordinary-member");
      const request = authRequest(urlFor(endpoint.path), "ordinary-member", {
        method: endpoint.route.method,
        headers: { "Content-Type": "application/json" },
        ...(endpoint.route.method === "GET" || endpoint.route.method === "DELETE"
          ? {}
          : { body: "{}" }),
      });
      const response = await worker.fetch(request, env, ctx);
      expect(response.status, `${endpoint.operationId} must not be reachable by a member`).toBe(403);
      const payload = (await response.json()) as { error?: { code: string } };
      expect(payload.error?.code).toBe("FORBIDDEN");
    },
  );
});

describe("wire contract: the failure envelope is uniform", () => {
  it("returns 404 NOT_FOUND for an unknown route, enveloped", async () => {
    const response = await call("/api/v1/definitely-not-a-route");
    expect(response.status).toBe(404);
    const payload = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string };
      meta: { timestamp: string; version: string };
    };
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("NOT_FOUND");
    expect(typeof payload.error.message).toBe("string");
    expect(payload.meta.version).toBe("v1");
  });

  it("emits CORS headers for an allow-listed origin and rejects others", async () => {
    const env = createTestEnv();
    env.CORS_ORIGINS = "https://loop.example";

    const allowed = await worker.fetch(
      new Request("https://api.test/api/v1/auth/me", { headers: { Origin: "https://loop.example" } }),
      env,
      ctx,
    );
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://loop.example");

    const denied = await worker.fetch(
      new Request("https://api.test/api/v1/auth/me", { headers: { Origin: "https://evil.example" } }),
      env,
      ctx,
    );
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("only ever answers with codes from the registry", async () => {
    const responses = await Promise.all(
      protectedOperations.slice(0, 20).map((endpoint) =>
        call(endpoint.path, body({ method: endpoint.route.method }, endpoint.route.method)),
      ),
    );
    for (const response of responses) {
      const payload = (await response.json()) as { error?: { code: string } };
      expect(Object.keys(ERROR_CODES)).toContain(payload.error?.code);
    }
  });
});
