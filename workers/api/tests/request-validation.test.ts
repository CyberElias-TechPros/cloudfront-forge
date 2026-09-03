/**
 * Input-validation contracts for handlers that used to read the raw request
 * body after (or instead of) validating it.
 *
 * These are behavioural tests: they post hostile payloads and assert that the
 * handler rejects them and — where relevant — that nothing was written.
 */
import { describe, it, expect } from "vitest";
import { notificationRoutes } from "../src/routes/notifications";
import { reviewRoutes } from "../src/routes/videos";
import { userRoutes } from "../src/routes/users";
import { reportRoutes } from "../src/routes/reports";
import { createTestEnv, jsonRequest, authRequest, type TestEnv } from "./helpers/test-env";

const BASE = "https://api.test";

/**
 * Look a route up the way the router does: exact `path`, or a `pattern` that
 * matches a sample URL. Patterns are stored with escaped slashes.
 */
function find(
  routes: { method: string; path?: string; pattern?: string }[],
  method: string,
  sampleUrl: string,
) {
  const route = routes.find((r) => {
    if (r.method !== method) return false;
    if (r.path) return r.path === sampleUrl;
    if (!r.pattern) return false;
    return new RegExp(r.pattern).test(sampleUrl);
  });
  if (!route) {
    throw new Error(
      `no route for ${method} ${sampleUrl} in [${routes
        .map((r) => `${r.method} ${r.path ?? r.pattern}`)
        .join(", ")}]`,
    );
  }
  return route as any;
}

const subscribe = find(notificationRoutes, "POST", "/api/v1/notifications/push/subscribe");
const unsubscribe = find(notificationRoutes, "POST", "/api/v1/notifications/push/unsubscribe");
const answers = find(reviewRoutes, "POST", "/api/v1/reviews/review-id/answers");
const helpful = find(reviewRoutes, "POST", "/api/v1/reviews/review-id/helpful");
const connectChannel = find(userRoutes, "POST", "/api/v1/users/me/youtube-channel");
const reviewAppeal = find(reportRoutes, "POST", "/api/v1/admin/appeals/appeal-id");

async function body(response: Response) {
  return (await response.json()) as { success: boolean; error?: { code: string; message?: string } };
}

function storedPush(env: TestEnv, userId: string) {
  return env.sqlite.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?").all(userId) as {
    endpoint: string;
    p256dh: string;
    auth: string;
  }[];
}

describe("push subscription validation", () => {
  it("stores a well-formed subscription", async () => {
    const env = createTestEnv();
    const uid = "push-uid";
    const userId = env.seedUser(uid);
    const response = await subscribe.handler(
      jsonRequest(`${BASE}/api/v1/notifications/push/subscribe`, uid, "POST", {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
        keys: { p256dh: "BNcRd", auth: "tBHXf" },
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(storedPush(env, userId)).toHaveLength(1);
  });

  it("rejects a non-URL endpoint", async () => {
    const env = createTestEnv();
    const uid = "push-uid-2";
    const userId = env.seedUser(uid);
    const response = await subscribe.handler(
      jsonRequest(`${BASE}/api/v1/notifications/push/subscribe`, uid, "POST", {
        endpoint: "javascript:alert(1)",
        keys: { p256dh: "BNcRd", auth: "tBHXf" },
      }),
      env,
    );
    expect(response.status).toBe(400);
    expect((await body(response)).error?.code).toBe("VALIDATION_ERROR");
    expect(storedPush(env, userId)).toHaveLength(0);
  });

  it("rejects non-base64url keys", async () => {
    const env = createTestEnv();
    const uid = "push-uid-3";
    const userId = env.seedUser(uid);
    const response = await subscribe.handler(
      jsonRequest(`${BASE}/api/v1/notifications/push/subscribe`, uid, "POST", {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
        keys: { p256dh: { nested: "object" }, auth: "tBHXf" },
      }),
      env,
    );
    expect(response.status).toBe(400);
    expect(storedPush(env, userId)).toHaveLength(0);
  });

  it("rejects an unsubscribe with a malformed endpoint", async () => {
    const env = createTestEnv();
    const uid = "push-uid-4";
    env.seedUser(uid);
    const response = await unsubscribe.handler(
      jsonRequest(`${BASE}/api/v1/notifications/push/unsubscribe`, uid, "POST", { endpoint: "not-a-url" }),
      env,
    );
    expect(response.status).toBe(400);
  });
});

describe("review answer validation", () => {
  function seedQuestion(env: TestEnv, id: string): void {
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      "INSERT INTO review_questions (id, question_text, question_type, is_required, order_index, created_at) VALUES (?, ?, 'rating', 1, 1, ?)",
    )
    .run(id, `Question ${id}`, now);
}

function seedReview(env: TestEnv, reviewerUid: string): string {
    const reviewerId = env.seedUser(reviewerUid);
    const submitterId = env.seedUser(`owner-${reviewerUid}`);
    const now = new Date().toISOString();
    const videoId = crypto.randomUUID();
    env.sqlite
      .prepare(
        "INSERT INTO videos (id, user_id, youtube_video_id, youtube_url, title, status, created_at, updated_at) VALUES (?, ?, ?, 'https://youtu.be/xxxxxxxxxxx', 'V', 'active', ?, ?)",
      )
      .run(videoId, submitterId, videoId, now, now);
    const reviewId = crypto.randomUUID();
    env.sqlite
      .prepare(
        "INSERT INTO reviews (id, video_id, reviewer_id, submitter_id, status, assigned_at, created_at) VALUES (?, ?, ?, ?, 'in_progress', ?, ?)",
      )
      .run(reviewId, videoId, reviewerId, submitterId, now, now);
    return reviewId;
  }

  it("stores sanitised answers", async () => {
    const env = createTestEnv();
    const uid = "reviewer-uid";
    const reviewId = seedReview(env, uid);
    seedQuestion(env, "q1");
    const response = await answers.handler(
      jsonRequest(`${BASE}/api/v1/reviews/${reviewId}/answers`, uid, "POST", {
        answers: [{ questionId: "q1", ratingValue: 4, textAnswer: "<b>Great</b> pacing" }],
      }),
      env,
    );
    expect(response.status).toBe(200);
    const row = env.sqlite
      .prepare("SELECT text_answer FROM review_answers WHERE review_id = ?")
      .get(reviewId) as { text_answer: string };
    expect(row.text_answer).toBe("Great pacing");
  });

  it("rejects an out-of-range rating instead of storing it", async () => {
    const env = createTestEnv();
    const uid = "reviewer-uid-2";
    const reviewId = seedReview(env, uid);
    seedQuestion(env, "q1");
    const response = await answers.handler(
      jsonRequest(`${BASE}/api/v1/reviews/${reviewId}/answers`, uid, "POST", {
        answers: [{ questionId: "q1", ratingValue: 9999 }],
      }),
      env,
    );
    expect(response.status).toBe(400);
    expect(
      env.sqlite.prepare("SELECT COUNT(*) AS c FROM review_answers WHERE review_id = ?").get(reviewId),
    ).toMatchObject({ c: 0 });
  });

  it("rejects a non-object answer entry with a 400 instead of a 500", async () => {
    const env = createTestEnv();
    const uid = "reviewer-uid-3";
    const reviewId = seedReview(env, uid);
    const response = await answers.handler(
      jsonRequest(`${BASE}/api/v1/reviews/${reviewId}/answers`, uid, "POST", {
        answers: [{ questionId: { evil: true } }],
      }),
      env,
    );
    expect(response.status).toBe(400);
  });

  it("requires a boolean for the helpful flag", async () => {
    const env = createTestEnv();
    const uid = "submitter-uid";
    const reviewId = seedReview(env, `rev-${uid}`);
    // make the seeded submitter the caller
    const submitterId = env.sqlite
      .prepare("SELECT submitter_id FROM reviews WHERE id = ?")
      .get(reviewId) as { submitter_id: string };
    env.sqlite.prepare("UPDATE users SET firebase_uid = ? WHERE id = ?").run(uid, submitterId.submitter_id);

    const bad = await helpful.handler(
      jsonRequest(`${BASE}/api/v1/reviews/${reviewId}/helpful`, uid, "POST", { helpful: "yes" }),
      env,
    );
    expect(bad.status).toBe(400);

    const ok = await helpful.handler(
      jsonRequest(`${BASE}/api/v1/reviews/${reviewId}/helpful`, uid, "POST", { helpful: true }),
      env,
    );
    expect(ok.status).toBe(200);
    // The XP ledger row must respect the xp_transactions type CHECK — an
    // unknown type used to abort this request with a 500 *after* the rating
    // had already been written.
    const ledger = env.sqlite
      .prepare("SELECT type, description FROM xp_transactions WHERE reference_id = ?")
      .all(reviewId) as { type: string; description: string }[];
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe("review");
    expect(ledger[0].description).toBe("Review rated helpful");
  });
});

describe("youtube channel connect", () => {
  it("writes the validated channel id, not the raw body", async () => {
    const env = createTestEnv();
    const uid = "channel-uid";
    const userId = env.seedUser(uid);
    const response = await connectChannel.handler(
      jsonRequest(`${BASE}/api/v1/users/me/youtube-channel`, uid, "POST", {
        channelId: "UCabcdefghijklmnopqrstu",
        channelName: "<script>alert(1)</script>My Channel",
      }),
      env,
    );
    expect(response.status).toBe(200);
    const row = env.sqlite
      .prepare("SELECT channel_id, channel_name FROM youtube_channels WHERE user_id = ?")
      .get(userId) as { channel_id: string; channel_name: string };
    expect(row.channel_id).toBe("UCabcdefghijklmnopqrstu");
    expect(row.channel_name).not.toContain("<script>");
    expect(row.channel_name).toBe("alert(1)My Channel");
  });

  it("rejects a missing channel id", async () => {
    const env = createTestEnv();
    const uid = "channel-uid-2";
    env.seedUser(uid);
    const response = await connectChannel.handler(
      jsonRequest(`${BASE}/api/v1/users/me/youtube-channel`, uid, "POST", {}),
      env,
    );
    expect(response.status).toBe(400);
  });
});

describe("admin appeal review", () => {
  function seedAppeal(env: TestEnv): string {
    const reporterId = env.seedUser("reporter-uid");
    const adminId = env.seedUser("admin-uid");
    env.makeAdmin(adminId);
    const now = new Date().toISOString();
    const reportId = crypto.randomUUID();
    env.sqlite
      .prepare(
        "INSERT INTO reports (id, reporter_id, resource_type, resource_id, reason, status, created_at, updated_at) VALUES (?, ?, 'video', ?, 'spam', 'resolved', ?, ?)",
      )
      .run(reportId, reporterId, crypto.randomUUID(), now, now);
    const appealId = crypto.randomUUID();
    env.sqlite
      .prepare(
        "INSERT INTO appeals (id, report_id, user_id, reason, status, created_at) VALUES (?, ?, ?, 'not spam', 'pending', ?)",
      )
      .run(appealId, reportId, reporterId, now);
    return appealId;
  }

  it("requires authentication", async () => {
    const env = createTestEnv();
    const response = await reviewAppeal.handler(
      new Request(`${BASE}/api/v1/admin/appeals/whatever`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      }),
      env,
    );
    expect(response.status).toBe(401);
  });

  it("rejects a status outside the whitelist", async () => {
    const env = createTestEnv();
    const appealId = seedAppeal(env);
    const response = await reviewAppeal.handler(
      jsonRequest(`${BASE}/api/v1/admin/appeals/${appealId}`, "admin-uid", "POST", { status: "maybe" }),
      env,
    );
    expect(response.status).toBe(400);
    expect((await body(response)).error?.code).toBe("VALIDATION_ERROR");
  });

  it("accepts an appeal, sanitises the note and dismisses the report", async () => {
    const env = createTestEnv();
    const appealId = seedAppeal(env);
    const response = await reviewAppeal.handler(
      jsonRequest(`${BASE}/api/v1/admin/appeals/${appealId}`, "admin-uid", "POST", {
        status: "accepted",
        note: "<b>Looks fine</b>",
      }),
      env,
    );
    expect(response.status).toBe(200);
    const appeal = env.sqlite
      .prepare("SELECT status, note FROM appeals WHERE id = ?")
      .get(appealId) as { status: string; note: string };
    expect(appeal.status).toBe("accepted");
    expect(appeal.note).toBe("Looks fine");
    const report = env.sqlite
      .prepare("SELECT status FROM reports WHERE id = (SELECT report_id FROM appeals WHERE id = ?)")
      .get(appealId) as { status: string };
    expect(report.status).toBe("dismissed");
  });

  it("rejects a note longer than the limit", async () => {
    const env = createTestEnv();
    const appealId = seedAppeal(env);
    const response = await reviewAppeal.handler(
      jsonRequest(`${BASE}/api/v1/admin/appeals/${appealId}`, "admin-uid", "POST", {
        status: "rejected",
        note: "x".repeat(2001),
      }),
      env,
    );
    expect(response.status).toBe(400);
  });
});

describe("communities join", () => {
  it("uses the validated invite code", async () => {
    const { communityRoutes } = await import("../src/routes/communities");
    const join = find(communityRoutes, "POST", "/api/v1/communities/join");
    const env = createTestEnv();
    const uid = "join-uid";
    const ownerId = env.seedUser(uid);
    const now = new Date().toISOString();
    env.sqlite
      .prepare(
        "INSERT INTO communities (id, name, slug, invite_code, is_public, owner_id, max_members, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, 50, ?, ?)",
      )
      .run(crypto.randomUUID(), "Squad", "squad", "NAIJA2026", ownerId, now, now);

    const response = await join.handler(
      jsonRequest(`${BASE}/api/v1/communities/join`, uid, "POST", { inviteCode: "naija2026" }),
      env,
    );
    // Already the owner/member via seeding? Either way it must not be a 500.
    expect([200, 409]).toContain(response.status);
  });
});

describe("unauthenticated access", () => {
  it("push subscribe requires a token", async () => {
    const env = createTestEnv();
    const response = await subscribe.handler(
      new Request(`${BASE}/api/v1/notifications/push/subscribe`, { method: "POST" }),
      env,
    );
    expect(response.status).toBe(401);
  });

  it("review answers require a token", async () => {
    const env = createTestEnv();
    const response = await answers.handler(
      authRequest(`${BASE}/api/v1/reviews/anything/answers`, "", { method: "POST" }),
      env,
    );
    expect(response.status).toBe(401);
  });
});
