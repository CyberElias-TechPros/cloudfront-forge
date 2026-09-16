import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { accountRoutes } from "../src/routes/account";
import { createTestEnv, authRequest, type TestEnv } from "./helpers/test-env";

const BASE = "https://api.test";

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const deleteAccount = accountRoutes.find((r) => r.path === "/api/v1/users/me")!;

async function data(response: Response) {
  return (await response.json()) as { success: boolean; data?: any; error?: { code: string; message: string } };
}

function seedCommunity(env: TestEnv, ownerId: string, id = "community-acc") {
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      `INSERT INTO communities (id, name, slug, invite_code, is_public, owner_id, created_at, updated_at)
       VALUES (?, 'Squad', ?, ?, 1, ?, ?, ?)`,
    )
    .run(id, `slug-${id}`, `CODE-${id}`, ownerId, now, now);
  env.sqlite
    .prepare(
      "INSERT INTO community_members (id, community_id, user_id, role, joined_at, status) VALUES (?, ?, ?, 'owner', ?, 'active')",
    )
    .run(crypto.randomUUID(), id, ownerId, now);
  return id;
}

describe("account deletion", () => {
  it("closes every open loop at once", async () => {
    const env = createTestEnv();
    const uid = "delete-me";
    const userId = env.seedUser(uid);
    const other = env.seedUser("other-uid");
    const communityId = seedCommunity(env, other);
    const now = new Date().toISOString();

    // Member row in someone else's community
    env.sqlite
      .prepare(
        "INSERT INTO community_members (id, community_id, user_id, role, joined_at, status) VALUES (?, ?, ?, 'member', ?, 'active')",
      )
      .run(crypto.randomUUID(), communityId, userId, now);
    // Active video
    env.sqlite
      .prepare(
        "INSERT INTO videos (id, user_id, community_id, youtube_url, title, status, created_at, updated_at) VALUES (?, ?, ?, 'https://youtu.be/x', 'Vid', 'active', ?, ?)",
      )
      .run("video-acc", userId, communityId, now, now);
    // Open review assigned to the member (for another submitter)
    env.sqlite
      .prepare(
        "INSERT INTO reviews (id, video_id, reviewer_id, submitter_id, status, assigned_at, created_at) VALUES (?, 'video-acc', ?, ?, 'assigned', ?, ?)",
      )
      .run("review-acc", userId, other, now, now);
    // Pending join request, pending top-up, push subscription, open watch session
    env.sqlite
      .prepare(
        "INSERT INTO join_requests (id, community_id, user_id, status, requested_at, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?, ?)",
      )
      .run("jr-acc", communityId, userId, now, now, now);
    env.sqlite
      .prepare(
        "INSERT INTO topup_requests (id, user_id, tier_id, ngn_amount, credits_amount, transfer_reference, status, created_at) VALUES (?, ?, 'tier-1', 1000, 100, 'REF-ACC', 'pending', ?)",
      )
      .run("topup-acc", userId, now);
    env.sqlite
      .prepare(
        "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, 'https://push.example/x', 'k', 'a', ?)",
      )
      .run("push-acc", userId, now);
    env.sqlite
      .prepare(
        "INSERT INTO watch_sessions (id, video_id, watcher_id, status, created_at) VALUES (?, 'video-acc', ?, 'started', ?)",
      )
      .run("ws-acc", userId, now);

    const response = await deleteAccount.handler(
      authRequest(`${BASE}/api/v1/users/me`, uid, { method: "DELETE" }),
      env,
    );
    expect(response.status).toBe(200);

    const user = env.sqlite.prepare("SELECT deleted_at FROM users WHERE id = ?").get(userId) as any;
    expect(user.deleted_at).toBeTruthy();

    const membership = env.sqlite
      .prepare("SELECT status FROM community_members WHERE community_id = ? AND user_id = ?")
      .get(communityId, userId) as any;
    expect(membership.status).toBe("left");

    const video = env.sqlite.prepare("SELECT status FROM videos WHERE id = 'video-acc'").get() as any;
    expect(video.status).toBe("archived");

    const review = env.sqlite.prepare("SELECT status FROM reviews WHERE id = 'review-acc'").get() as any;
    expect(review.status).toBe("skipped");

    const submitterNotified = env.sqlite
      .prepare(
        "SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND type = 'REVIEW_UNAVAILABLE'",
      )
      .get(other) as any;
    expect(submitterNotified.c).toBe(1);

    const joinRequest = env.sqlite
      .prepare("SELECT status FROM join_requests WHERE id = 'jr-acc'")
      .get() as any;
    expect(joinRequest.status).toBe("cancelled");

    const topup = env.sqlite
      .prepare("SELECT status, reject_reason FROM topup_requests WHERE id = 'topup-acc'")
      .get() as any;
    expect(topup.status).toBe("rejected");
    expect(topup.reject_reason).toBe("Account deleted");

    const push = env.sqlite
      .prepare("SELECT COUNT(*) as c FROM push_subscriptions WHERE user_id = ?")
      .get(userId) as any;
    expect(push.c).toBe(0);

    const session = env.sqlite
      .prepare("SELECT status FROM watch_sessions WHERE id = 'ws-acc'")
      .get() as any;
    expect(session.status).toBe("expired");
  });

  it("rejects every later request with ACCOUNT_DELETED", async () => {
    const env = createTestEnv();
    const uid = "ghost-uid";
    env.seedUser(uid);
    await deleteAccount.handler(
      authRequest(`${BASE}/api/v1/users/me`, uid, { method: "DELETE" }),
      env,
    );

    const response = await worker.fetch(
      authRequest(`${BASE}/api/v1/credits`, uid),
      env,
      ctx,
    );
    expect(response.status).toBe(403);
    const body = await data(response);
    expect(body.error?.code).toBe("ACCOUNT_DELETED");
  });
});

describe("moderated accounts at the entry gate", () => {
  it("blocks suspended members with ACCOUNT_SUSPENDED on every route", async () => {
    const env = createTestEnv();
    const uid = "suspended-uid";
    const userId = env.seedUser(uid);
    env.sqlite.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(userId);

    const response = await worker.fetch(authRequest(`${BASE}/api/v1/credits`, uid), env, ctx);
    expect(response.status).toBe(403);
    const body = await data(response);
    expect(body.error?.code).toBe("ACCOUNT_SUSPENDED");
    expect(body.error?.message).toMatch(/suspended/i);
  });

  it("blocks banned members with ACCOUNT_BANNED", async () => {
    const env = createTestEnv();
    const uid = "banned-uid";
    const userId = env.seedUser(uid);
    env.sqlite.prepare("UPDATE users SET status = 'banned' WHERE id = ?").run(userId);

    const response = await worker.fetch(authRequest(`${BASE}/api/v1/credits`, uid), env, ctx);
    expect(response.status).toBe(403);
    const body = await data(response);
    expect(body.error?.code).toBe("ACCOUNT_BANNED");
  });

  it("still serves health checks while accounts are moderated", async () => {
    const env = createTestEnv();
    const response = await worker.fetch(new Request(`${BASE}/health`), env, ctx);
    expect(response.status).toBe(200);
  });
});
