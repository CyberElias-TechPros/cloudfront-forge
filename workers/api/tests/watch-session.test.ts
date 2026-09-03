import { describe, it, expect } from "vitest";
import { watchRoutes, watchSessionSecret } from "../src/routes/watch";
import { createTestEnv, authRequest, jsonRequest } from "./helpers/test-env";

const BASE = "https://api.test";
const start = watchRoutes.find((r) => r.path === "/api/v1/watch/start")!;
const heartbeat = watchRoutes.find((r) => r.path === "/api/v1/watch/heartbeat")!;

async function body(response: Response) {
  return ((await response.json()) as { data: any; error?: { code: string } });
}

describe("watch session tokens", () => {
  it("issues a token signed with the configured secret", async () => {
    const env = createTestEnv();
    env.WATCH_SESSION_SECRET = "test-signing-key";
    env.WATCH_SESSIONS_ENABLED = "true";
    const uid = "watcher-uid";
    env.seedUser(uid);

    const response = await start.handler(
      jsonRequest(`${BASE}/api/v1/watch/start`, uid, "POST", { videoId: "video-1" }),
      env,
    );
    expect(response.status).toBe(200);
    const payload = (await body(response)).data;
    expect(payload.enabled).toBe(true);
    // Token payload is `userId:videoId:startTs:signature` (internal user id).
    expect(payload.sessionToken.split(":")[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.sessionToken.split(":")[1]).toBe("video-1");
  });

  it("refuses to sign with a fallback secret in production", () => {
    const env = createTestEnv();
    env.ENVIRONMENT = "production";
    delete (env as Partial<typeof env>).WATCH_SESSION_SECRET;
    // The worker entry point turns MISSING_ENV into a 503 (worker-entry test).
    expect(() => watchSessionSecret(env)).toThrow(/MISSING_ENV: WATCH_SESSION_SECRET/);
  });

  it("uses a clearly-labelled development key outside production", () => {
    const dev = createTestEnv();
    delete (dev as Partial<typeof dev>).WATCH_SESSION_SECRET;
    expect(watchSessionSecret(dev)).toContain("development-only");

    const configured = createTestEnv();
    configured.WATCH_SESSION_SECRET = "rotated-key";
    expect(watchSessionSecret(configured)).toBe("rotated-key");
  });

  it("accepts a heartbeat for a live token and rejects a forged one", async () => {
    const env = createTestEnv();
    env.WATCH_SESSION_SECRET = "test-signing-key";
    env.WATCH_SESSIONS_ENABLED = "true";
    const uid = "watcher-uid-3";
    env.seedUser(uid);

    const issued = await body(
      await start.handler(
        jsonRequest(`${BASE}/api/v1/watch/start`, uid, "POST", { videoId: "video-1" }),
        env,
      ),
    );
    const token = issued.data.sessionToken as string;

    const ok = await heartbeat.handler(
      jsonRequest(`${BASE}/api/v1/watch/heartbeat`, uid, "POST", {
        sessionToken: token,
        playerTime: 42,
      }),
      env,
    );
    expect(ok.status).toBe(200);

    const forged = await heartbeat.handler(
      jsonRequest(`${BASE}/api/v1/watch/heartbeat`, uid, "POST", {
        sessionToken: `${uid}:video-1:${Math.floor(Date.now() / 1000)}:forged-signature`,
        playerTime: 42,
      }),
      env,
    );
    expect(forged.status).toBe(401);
  });

  it("does not accept another member's token", async () => {
    const env = createTestEnv();
    env.WATCH_SESSION_SECRET = "test-signing-key";
    env.WATCH_SESSIONS_ENABLED = "true";
    const owner = env.seedUser("watcher-uid-4");
    env.seedUser("watcher-uid-5");

    const issued = await body(
      await start.handler(
        jsonRequest(`${BASE}/api/v1/watch/start`, owner, "POST", { videoId: "video-1" }),
        env,
      ),
    );

    const response = await heartbeat.handler(
      jsonRequest(`${BASE}/api/v1/watch/heartbeat`, "watcher-uid-5", "POST", {
        sessionToken: issued.data.sessionToken,
        playerTime: 10,
      }),
      env,
    );
    expect(response.status).toBe(401);
  });

  it("requires authentication to start a session", async () => {
    const env = createTestEnv();
    env.WATCH_SESSIONS_ENABLED = "true";
    const response = await start.handler(
      new Request(`${BASE}/api/v1/watch/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: "video-1" }),
      }),
      env,
    );
    expect(response.status).toBe(401);
  });
});
