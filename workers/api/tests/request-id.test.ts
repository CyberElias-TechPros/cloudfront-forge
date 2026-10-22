/**
 * Request ids (PLAT-015).
 *
 * "It failed" support tickets are only traceable if the member can quote an id
 * that also appears in the server log. The id must be present on *every*
 * response — success, error, 404, preflight, readiness — and must be safe to
 * echo: bounded, sanitised, and exposed to browser code via CORS.
 */
import { describe, it, expect, vi } from "vitest";
import worker from "../src/index";
import { createTestEnv, authRequest } from "./helpers/test-env";

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const call = (pathname: string, init: RequestInit = {}) =>
  worker.fetch(new Request(`https://api.test${pathname}`, init), createTestEnv(), ctx);

describe("X-Request-Id", () => {
  it("is generated for successful responses", async () => {
    const response = await call("/health");
    expect(response.status).toBe(200);
    const id = response.headers.get("X-Request-Id");
    expect(id).toBeTruthy();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("is generated for failures, including 404 and 401", async () => {
    for (const path of ["/api/v1/nope", "/api/v1/auth/me"]) {
      const response = await call(path);
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.headers.get("X-Request-Id")).toBeTruthy();
    }
  });

  it("is different per request", async () => {
    const first = await call("/health");
    const second = await call("/health");
    expect(first.headers.get("X-Request-Id")).not.toBe(second.headers.get("X-Request-Id"));
  });

  it("echoes a caller-supplied id so a client can correlate its own report", async () => {
    const response = await call("/health", {
      headers: { "X-Request-Id": "client-supplied-abc123" },
    });
    expect(response.headers.get("X-Request-Id")).toBe("client-supplied-abc123");
  });

  it("rejects an unsafe supplied id instead of echoing it", async () => {
    const hostile = "x".repeat(200);
    const response = await call("/health", { headers: { "X-Request-Id": hostile } });
    const id = response.headers.get("X-Request-Id") ?? "";
    expect(id).not.toBe(hostile);
    expect(id.length).toBeLessThanOrEqual(64);

    // Header values cannot contain newlines (the runtime rejects them), but
    // punctuation and separators can: the id must not smuggle log syntax in.
    const injected = await call("/health", {
      headers: { "X-Request-Id": "abc;/etc/passwd <script>" },
    });
    const echoed = injected.headers.get("X-Request-Id") ?? "";
    expect(echoed).not.toContain("/etc/passwd");
    expect(echoed).not.toContain("<");
    expect(echoed).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("is exposed to browser code through CORS", async () => {
    const env = createTestEnv();
    env.CORS_ORIGINS = "https://loop.example";
    const response = await worker.fetch(
      new Request("https://api.test/api/v1/auth/me", {
        headers: { Origin: "https://loop.example" },
      }),
      env,
      ctx,
    );
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain("X-Request-Id");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("X-Request-Id");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://loop.example");
  });

  it("appears on the preflight and on the served contract", async () => {
    const preflight = await call("/api/v1/auth/me", { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("X-Request-Id")).toBeTruthy();

    const spec = await call("/openapi.json");
    expect(spec.headers.get("X-Request-Id")).toBeTruthy();
    const document = (await spec.json()) as { info: { description: string } };
    expect(document.info.description).toContain("X-Request-Id");
  });

  it("logs one structured line per request with the id", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const env = createTestEnv();
    env.seedUser("log-member");
    const response = await worker.fetch(
      authRequest("https://api.test/api/v1/auth/me", "log-member"),
      env,
      ctx,
    );
    const id = response.headers.get("X-Request-Id");
    const logged = info.mock.calls.map(([line]) => String(line)).join("\n");
    info.mockRestore();

    expect(logged).toContain(id!);
    expect(logged).toContain("/api/v1/auth/me");
    expect(logged).toContain("durationMs");
  });
});
