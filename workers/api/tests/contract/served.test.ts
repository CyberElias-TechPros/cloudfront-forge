/**
 * The contract is served, not just committed (PLAT-004).
 *
 * Integrators (and the Android team) must be able to diff deployed reality
 * against the repository. This test drives the real Worker entry point.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import worker from "../../src/index";
import { createTestEnv } from "../helpers/test-env";

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const committed = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../src/contract/openapi.generated.json"), "utf8"),
) as Record<string, unknown>;

function call(pathname: string, init: RequestInit = {}) {
  return worker.fetch(new Request(`https://api.test${pathname}`, init), createTestEnv(), ctx);
}

describe("GET /openapi.json", () => {
  it("serves the committed document", async () => {
    const response = await call("/openapi.json");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(committed);
  });

  it("is cacheable, CORS-enabled for allow-listed origins and security-headered", async () => {
    const env = createTestEnv();
    env.CORS_ORIGINS = "https://loop.example";
    const response = await worker.fetch(
      new Request("https://api.test/openapi.json", { headers: { Origin: "https://loop.example" } }),
      env,
      ctx,
    );
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://loop.example");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });

  it("answers even when the deployment is misconfigured", async () => {
    const bare = createTestEnv();
    delete (bare as Partial<typeof bare>).FIREBASE_PROJECT_ID;
    const response = await worker.fetch(new Request("https://api.test/openapi.json"), bare, ctx);
    expect(response.status).toBe(200);
  });

  it("declares the deployed Worker origins so clients can point at them", async () => {
    const document = (await (await call("/openapi.json")).json()) as {
      servers: Array<{ url: string }>;
    };
    expect(document.servers.map((server) => server.url)).toEqual(
      expect.arrayContaining([expect.stringContaining("workers.dev")]),
    );
  });
});
