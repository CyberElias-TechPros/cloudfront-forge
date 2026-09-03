import { describe, it, expect } from "vitest";
import { watchRoutes } from "../src/routes/watch";
import { createTestEnv, type TestEnv } from "./helpers/test-env";
import { calculateLevel } from "../src/lib/utils";

const claim = watchRoutes.find((r) => r.path === "/api/v1/watch" && r.method === "POST");
if (!claim) throw new Error("POST /api/v1/watch route is missing");

const URL = "https://api.test/api/v1/watch";

function seedVideo(env: TestEnv, ownerId: string, durationSeconds = 600): string {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      `INSERT INTO videos (id, user_id, youtube_video_id, youtube_url, title, duration_seconds, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    )
    .run(id, ownerId, "dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "Test video", durationSeconds, now, now);
  return id;
}

function postClaim(env: TestEnv, firebaseUid: string, body: unknown) {
  const request = new Request(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${devToken(firebaseUid)}` },
    body: JSON.stringify(body),
  });
  return claim!.handler(request, env);
}

function devToken(uid: string): string {
  return Buffer.from(JSON.stringify({ uid, email: `${uid}@example.test`, emailVerified: true }))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function xpRow(env: TestEnv, userId: string) {
  return env.sqlite.prepare("SELECT * FROM xp_accounts WHERE user_id = ?").get(userId) as
    | { total_xp: number; level: number }
    | undefined;
}

describe("POST /api/v1/watch", () => {
  it("rejects anonymous callers", async () => {
    const env = createTestEnv();
    const owner = env.seedUser();
    const videoId = seedVideo(env, owner);
    const response = await claim!.handler(
      new Request(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, watchSeconds: 200, subscribed: false, commented: false }),
      }),
      env,
    );
    expect(response.status).toBe(401);
  });

  it("rejects invalid payloads", async () => {
    const env = createTestEnv();
    const watcher = env.seedUser();
    const response = await postClaim(env, `uid-${watcher}`, {
      videoId: "",
      watchSeconds: -5,
    });
    expect(response.status).toBe(400);
  });

  it("pays the watch reward exactly once when the claim is repeated", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-uid");
    const watcherUid = "watcher-uid";
    const watcher = env.seedUser(watcherUid);
    const videoId = seedVideo(env, owner);

    const first = await postClaim(env, watcherUid, {
      videoId,
      watchSeconds: 600,
      subscribed: false,
      commented: false,
    });
    expect(first.status).toBe(200);
    const firstBody = ((await first.json()) as { data: any }).data;
    expect(firstBody.watchVerified).toBe(true);
    expect(firstBody.xpAwarded).toBe(10); // WATCH_REWARD_XP
    expect(firstBody.creditsAwarded).toBe(4); // WATCH_REWARD_CREDITS

    // Same claim again (double-click / retry): no second payout.
    const second = await postClaim(env, watcherUid, {
      videoId,
      watchSeconds: 600,
      subscribed: false,
      commented: false,
    });
    const secondBody = ((await second.json()) as { data: any }).data;
    expect(secondBody.xpAwarded).toBe(0);
    expect(secondBody.creditsAwarded).toBe(0);

    const account = await xpRow(env, watcher);
    expect(account?.total_xp).toBe(10);
  });

  it("pays the feedback component only after the watch component", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-uid-2");
    const watcherUid = "watcher-uid-2";
    const watcher = env.seedUser(watcherUid);
    const videoId = seedVideo(env, owner);

    await postClaim(env, watcherUid, { videoId, watchSeconds: 600, subscribed: false, commented: false });
    const withComment = await postClaim(env, watcherUid, {
      videoId,
      watchSeconds: 600,
      subscribed: false,
      commented: true,
    });
    const body = ((await withComment.json()) as { data: any }).data;
    expect(body.xpAwarded).toBe(10); // comment component only (watch already paid)
    expect(body.status).toBe("claimed");

    const account = await xpRow(env, watcher);
    expect(account?.total_xp).toBe(20);
  });

  it("does not pay for a partial watch", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-uid-3");
    const watcherUid = "watcher-uid-3";
    const videoId = seedVideo(env, owner);

    const response = await postClaim(env, watcherUid, {
      videoId,
      watchSeconds: 10,
      subscribed: false,
      commented: false,
    });
    const body = ((await response.json()) as { data: any }).data;
    expect(body.watchVerified).toBe(false);
    expect(body.xpAwarded).toBe(0);
  });

  it("refuses a claim on your own video", async () => {
    const env = createTestEnv();
    const ownerUid = "owner-uid-4";
    const owner = env.seedUser(ownerUid);
    const videoId = seedVideo(env, owner);

    const response = await postClaim(env, ownerUid, {
      videoId,
      watchSeconds: 600,
      subscribed: false,
      commented: false,
    });
    expect(response.status).toBe(403);
  });

  it("keeps the stored level on the canonical curve", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-uid-5");
    const watcherUid = "watcher-uid-5";
    const watcher = env.seedUser(watcherUid);

    // Claim five different videos: 5 x 10 XP and 5 x 10 XP feedback = 100 XP.
    for (let i = 0; i < 5; i++) {
      const videoId = seedVideo(env, owner);
      await postClaim(env, watcherUid, {
        videoId,
        watchSeconds: 600,
        subscribed: false,
        commented: true,
      });
    }

    const account = await xpRow(env, watcher);
    expect(account?.total_xp).toBe(100);
    expect(account?.level).toBe(calculateLevel(100).level);
    expect(account?.level).not.toBe(Math.floor(100 / 250) + 1); // the legacy, drifting formula
  });

  it("stops paying watch rewards once the daily ceiling is hit", async () => {
    const env = createTestEnv({ DAILY_CLAIM_LIMIT: "2" } as never);
    const owner = env.seedUser("owner-uid-6");
    const watcherUid = "watcher-uid-6";
    env.seedUser(watcherUid);

    for (let i = 0; i < 2; i++) {
      const videoId = seedVideo(env, owner);
      const response = await postClaim(env, watcherUid, {
        videoId,
        watchSeconds: 600,
        subscribed: false,
        commented: false,
      });
      expect(response.status).toBe(200);
    }

    const third = seedVideo(env, owner);
    const limited = await postClaim(env, watcherUid, {
      videoId: third,
      watchSeconds: 600,
      subscribed: false,
      commented: false,
    });
    expect(limited.status).toBe(429);
  });
});
