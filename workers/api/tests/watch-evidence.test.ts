/**
 * End-to-end evidence tests for the watch loop (SEC-010/011/012).
 *
 * These drive the real handlers against real SQLite: a signed session, scored
 * heartbeats, and the claim that consumes them. The point of the suite is the
 * property the product sells — a scripted claim without server-observed
 * evidence earns nothing when the deployment enforces verification.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { watchRoutes } from "../src/routes/watch";
import { createTestEnv, type TestEnv } from "./helpers/test-env";
import { resolveRequiredWatchSeconds } from "../src/lib/utils";

const BASE = "https://api.test";
const start = watchRoutes.find((r) => r.path === "/api/v1/watch/start" && r.method === "POST")!;
const heartbeat = watchRoutes.find(
  (r) => r.path === "/api/v1/watch/heartbeat" && r.method === "POST",
)!;
const claim = watchRoutes.find((r) => r.path === "/api/v1/watch" && r.method === "POST")!;

function devToken(uid: string): string {
  return Buffer.from(JSON.stringify({ uid, email: `${uid}@example.test`, emailVerified: true }))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function post(path: string, uid: string, body: unknown) {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${devToken(uid)}` },
    body: JSON.stringify(body),
  });
}

async function payload(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: Record<string, any>;
    error?: { code: string; message: string };
  };
}

function seedVideo(
  env: TestEnv,
  ownerId: string,
  durationSeconds = 900,
): { id: string; required: number } {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      `INSERT INTO videos (id, user_id, youtube_video_id, youtube_url, title, duration_seconds, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    )
    .run(
      id,
      ownerId,
      "dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "Evidence test",
      durationSeconds,
      now,
      now,
    );
  return {
    id,
    required: resolveRequiredWatchSeconds(
      id,
      durationSeconds,
      Number(env.REQUIRED_WATCH_SEC ?? 180),
    ),
  };
}

/** Insert heartbeats as if the server had scored them (accepted, honest stream). */
function seedHeartbeats(env: TestEnv, token: string, seconds: number) {
  const row = env.sqlite
    .prepare("SELECT id FROM watch_session_tokens WHERE token = ?")
    .get(token) as { id: string } | undefined;
  if (!row) throw new Error("session token not found");
  const now = Math.floor(Date.now() / 1000) - Math.ceil(seconds) - 5;
  for (let elapsed = 0; elapsed <= seconds; elapsed += 30) {
    env.sqlite
      .prepare(
        `INSERT INTO watch_heartbeats (id, session_token_id, player_time, received_at, delta_seconds, accepted)
         VALUES (?, ?, ?, ?, ?, 1)`,
      )
      .run(crypto.randomUUID(), row.id, elapsed, now + elapsed, elapsed === 0 ? 0 : 30);
  }
  return row.id;
}

async function startSession(env: TestEnv, uid: string, videoId: string): Promise<string> {
  const response = await start.handler(post("/api/v1/watch/start", uid, { videoId }), env);
  const body = await payload(response);
  expect(body.success).toBe(true);
  const token = body.data?.sessionToken as string | null;
  expect(typeof token).toBe("string");
  return token as string;
}

describe("watch evidence — enforced deployments", () => {
  let env: TestEnv;
  let watcherId: string;
  const watcher = "watcher-uid";

  beforeEach(() => {
    env = createTestEnv({
      WATCH_SESSION_SECRET: "test-secret",
      WATCH_SESSIONS_ENABLED: "1",
      EVIDENCE_POLICY: "verified_only",
    } as Partial<TestEnv>);
    env.WATCH_SESSION_SECRET = "test-secret";
    env.WATCH_SESSIONS_ENABLED = "1";
    env.EVIDENCE_POLICY = "verified_only";
    watcherId = env.seedUser(watcher);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pays nothing for a claim with no server-observed evidence", async () => {
    const owner = env.seedUser("owner-uid");
    const video = seedVideo(env, owner);

    const response = await claim.handler(
      post("/api/v1/watch", watcher, {
        videoId: video.id,
        watchSeconds: video.required + 120,
        subscribed: false,
        commented: false,
      }),
      env,
    );
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.data?.xpAwarded).toBe(0);
    expect(body.data?.creditsAwarded).toBe(0);
    expect(body.data?.watchVerified).toBe(false);
    expect(body.data?.evidence?.level).toBe("self_report");
    expect(body.data?.evidence?.paid).toBe(false);
    // The watch is still recorded, so the member's history and the owner's
    // "someone watched" signal are honest about what happened.
    const sessionRow = env.sqlite
      .prepare("SELECT * FROM watch_sessions WHERE video_id = ? AND watcher_id = ?")
      .get(video.id, watcherId) as { watch_seconds: number; evidence_level: string } | undefined;
    expect(sessionRow?.evidence_level).toBe("self_report");
  });

  it("pays in full when the signed session verifies enough watch time", async () => {
    const owner = env.seedUser("owner-uid");
    const video = seedVideo(env, owner);
    const token = await startSession(env, watcher, video.id);
    seedHeartbeats(env, token, video.required + 30);

    const response = await claim.handler(
      post("/api/v1/watch", watcher, {
        videoId: video.id,
        // Deliberately understate the client-side number: the server decides.
        watchSeconds: 5,
        subscribed: false,
        commented: false,
        sessionToken: token,
      }),
      env,
    );
    const body = await payload(response);

    expect(response.status).toBe(200);
    expect(body.data?.evidence?.level).toBe("signed_session");
    expect(body.data?.evidence?.paid).toBe(true);
    expect(body.data?.xpAwarded).toBe(10);
    expect(body.data?.creditsAwarded).toBe(4);
    expect(body.data?.watchVerified).toBe(true);
  });

  it("does not pay twice when the same session is claimed again", async () => {
    const owner = env.seedUser("owner-uid");
    const video = seedVideo(env, owner);
    const token = await startSession(env, watcher, video.id);
    seedHeartbeats(env, token, video.required + 30);

    const body = {
      videoId: video.id,
      watchSeconds: 5,
      subscribed: false,
      commented: false,
      sessionToken: token,
    };
    const first = await payload(await claim.handler(post("/api/v1/watch", watcher, body), env));
    const second = await payload(await claim.handler(post("/api/v1/watch", watcher, body), env));

    expect(first.data?.xpAwarded).toBe(10);
    expect(second.data?.xpAwarded).toBe(0);
    expect(second.data?.creditsAwarded).toBe(0);
  });

  it("ignores another member's session token", async () => {
    const owner = env.seedUser("owner-uid");
    const other = env.seedUser("other-uid");
    const video = seedVideo(env, owner);
    const otherToken = await startSession(env, other, video.id);
    seedHeartbeats(env, otherToken, video.required + 30);

    const body = await payload(
      await claim.handler(
        post("/api/v1/watch", watcher, {
          videoId: video.id,
          watchSeconds: video.required + 30,
          subscribed: false,
          commented: false,
          sessionToken: otherToken,
        }),
        env,
      ),
    );

    expect(body.data?.evidence?.level).toBe("self_report");
    expect(body.data?.xpAwarded).toBe(0);
  });

  it("ignores a forged token", async () => {
    const owner = env.seedUser("owner-uid");
    const video = seedVideo(env, owner);
    const forged = `${watcherId}:${video.id}:1700000000:not-a-signature`;

    const body = await payload(
      await claim.handler(
        post("/api/v1/watch", watcher, {
          videoId: video.id,
          watchSeconds: video.required + 30,
          subscribed: false,
          commented: false,
          sessionToken: forged,
        }),
        env,
      ),
    );
    expect(body.data?.evidence?.level).toBe("self_report");
    expect(body.data?.xpAwarded).toBe(0);
  });

  it("ignores an expired session token", async () => {
    const owner = env.seedUser("owner-uid");
    const video = seedVideo(env, owner);
    const token = await startSession(env, watcher, video.id);
    seedHeartbeats(env, token, video.required + 30);
    env.sqlite
      .prepare("UPDATE watch_session_tokens SET expires_at = ? WHERE token = ?")
      .run(Math.floor(Date.now() / 1000) - 10, token);

    const body = await payload(
      await claim.handler(
        post("/api/v1/watch", watcher, {
          videoId: video.id,
          watchSeconds: video.required + 30,
          subscribed: false,
          commented: false,
          sessionToken: token,
        }),
        env,
      ),
    );
    expect(body.data?.xpAwarded).toBe(0);
  });
});

describe("watch evidence — rollout modes", () => {
  it("legacy keeps paying self-reported watch time (no silent behaviour change)", async () => {
    const env = createTestEnv();
    env.EVIDENCE_POLICY = "legacy";
    const watcher = "legacy-watcher";
    const uid = env.seedUser(watcher);
    const owner = env.seedUser("owner-uid");
    const video = seedVideo(env, owner);

    const body = await payload(
      await claim.handler(
        post("/api/v1/watch", watcher, {
          videoId: video.id,
          watchSeconds: video.required + 30,
          subscribed: false,
          commented: false,
        }),
        env,
      ),
    );
    expect(body.data?.xpAwarded).toBe(10);
    expect(body.data?.evidence?.level).toBe("self_report");
    expect(body.data?.evidence?.paid).toBe(true);
    expect(uid).toBeTruthy();
  });

  it("capped pays the configured share of the watch reward", async () => {
    const env = createTestEnv();
    env.EVIDENCE_POLICY = "self_report_capped";
    env.EVIDENCE_SELF_REPORT_SHARE = "0.5";
    const watcher = "capped-watcher";
    env.seedUser(watcher);
    const owner = env.seedUser("capped-owner");
    const video = seedVideo(env, owner);

    const body = await payload(
      await claim.handler(
        post("/api/v1/watch", watcher, {
          videoId: video.id,
          watchSeconds: video.required + 30,
          subscribed: false,
          commented: false,
        }),
        env,
      ),
    );
    // 10 XP → 5, 4 credits → 2 (rounded down, never up).
    expect(body.data?.xpAwarded).toBe(5);
    expect(body.data?.creditsAwarded).toBe(2);
    expect(body.data?.evidence?.level).toBe("self_report");
  });
});

describe("heartbeat endpoint — server-side scoring", () => {
  let env: TestEnv;
  const watcher = "hb-watcher";

  beforeEach(() => {
    env = createTestEnv();
    env.WATCH_SESSION_SECRET = "test-secret";
    env.WATCH_SESSIONS_ENABLED = "1";
    env.seedUser(watcher);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("credits honest samples and rejects rewinds", async () => {
    const owner = env.seedUser("hb-owner");
    const video = seedVideo(env, owner);
    const token = await startSession(env, watcher, video.id);

    const send = async (playerTime: number) => {
      const response = await heartbeat.handler(
        post("/api/v1/watch/heartbeat", watcher, { sessionToken: token, playerTime }),
        env,
      );
      return (await payload(response)).data!;
    };

    const baseline = await send(0);
    expect(baseline.accepted).toBe(true);
    expect(baseline.deltaSeconds).toBe(0);

    vi.advanceTimersByTime(30_000);
    const first = await send(30);
    expect(first.accepted).toBe(true);
    expect(first.deltaSeconds).toBeCloseTo(30, 5);
    expect(first.verifiedSeconds).toBeCloseTo(30, 5);

    vi.advanceTimersByTime(30_000);
    const rewind = await send(5);
    expect(rewind.accepted).toBe(false);
    expect(rewind.rejectReason).toBe("non_monotonic");
    expect(rewind.verifiedSeconds).toBeCloseTo(30, 5);

    vi.advanceTimersByTime(30_000);
    const fastForward = await send(500);
    expect(fastForward.accepted).toBe(false);
    expect(fastForward.rejectReason).toBe("rate_exceeded");

    vi.advanceTimersByTime(5 * 60_000);
    const gap = await send(530);
    expect(gap.accepted).toBe(false);
    expect(gap.rejectReason).toBe("gap_too_large");
  });

  it("rejects a token that belongs to someone else", async () => {
    const owner = env.seedUser("hb-owner2");
    const video = seedVideo(env, owner);
    env.seedUser("someone-else");
    const token = await startSession(env, "someone-else", video.id);

    const response = await heartbeat.handler(
      post("/api/v1/watch/heartbeat", watcher, { sessionToken: token, playerTime: 10 }),
      env,
    );
    expect(response.status).toBe(401);
    expect((await payload(response)).error?.code).toBe("UNAUTHORIZED");
  });

  it("validates the payload instead of trusting it", async () => {
    const response = await heartbeat.handler(
      post("/api/v1/watch/heartbeat", watcher, { playerTime: -5 }),
      env,
    );
    expect(response.status).toBe(400);
    expect((await payload(response)).error?.code).toBe("VALIDATION_ERROR");
  });
});
