import { describe, it, expect } from "vitest";
import { userRoutes } from "../src/routes/users";
import { communityRoutes } from "../src/routes/communities";
import { notificationRoutes } from "../src/routes/notifications";
import { createTestEnv, authRequest, jsonRequest } from "./helpers/test-env";

const BASE = "https://api.test";
const getUser = userRoutes.find((r) => "pattern" in r)!;
const getProfile = userRoutes.find((r) => r.path === "/api/v1/users/me/profile")!;
const putProfile = userRoutes.find((r) => r.path === "/api/v1/users/me/profile" && r.method === "PUT")!;
const listCommunities = communityRoutes.find((r) => r.path === "/api/v1/communities")!;
const members = communityRoutes.find(
  (r) => "pattern" in r && (r.pattern ?? "").includes("members"),
)!;
const settings = communityRoutes.find(
  (r) => "pattern" in r && (r.pattern ?? "").includes("settings"),
)!;
const listNotifications = notificationRoutes.find(
  (r) => r.path === "/api/v1/notifications" && r.method === "GET",
)!;
const createNotification = notificationRoutes.find(
  (r) => r.path === "/api/v1/notifications" && r.method === "POST",
)!;
const readAll = notificationRoutes.find((r) => r.path === "/api/v1/notifications/read-all")!;
const deleteNotification = notificationRoutes.find(
  (r) => "pattern" in r && r.method === "DELETE",
)!;
const subscribe = notificationRoutes.find((r) => r.path === "/api/v1/notifications/push/subscribe")!;

async function data(response: Response) {
  return ((await response.json()) as { data: any }).data;
}

function seedCommunity(
  env: ReturnType<typeof createTestEnv>,
  ownerId: string,
  isPublic = false,
  id = "community-1",
) {
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      `INSERT INTO communities (id, name, description, slug, invite_code, is_public, owner_id, created_at, updated_at)
       VALUES (?, 'Loop Squad', 'Private creator circle', ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, `slug-${id}`, `INVITE-${id}`, isPublic ? 1 : 0, ownerId, now, now);
  env.sqlite
    .prepare(
      "INSERT INTO community_members (id, community_id, user_id, role, joined_at, status) VALUES (?, ?, ?, 'owner', ?, 'active')",
    )
    .run(crypto.randomUUID(), id, ownerId, now);
  return id;
}

function seedNotification(
  env: ReturnType<typeof createTestEnv>,
  userId: string,
  id = "notification-1",
) {
  env.sqlite
    .prepare(
      "INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at) VALUES (?, ?, 'SYSTEM', 'Hello', 'World', 0, ?)",
    )
    .run(id, userId, new Date().toISOString());
  return id;
}

describe("user profiles", () => {
  it("requires a signed-in member before exposing another member", async () => {
    const env = createTestEnv();
    const target = env.seedUser("target-uid");
    const anon = await getUser.handler(new Request(`${BASE}/api/v1/users/${target}`), env);
    expect(anon.status).toBe(401);
  });

  it("returns 404 for an unknown member", async () => {
    const env = createTestEnv();
    env.seedUser("caller-uid");
    const response = await getUser.handler(
      authRequest(`${BASE}/api/v1/users/does-not-exist`, "caller-uid"),
      env,
    );
    expect(response.status).toBe(404);
  });

  it("persists the display name (not just the creator profile)", async () => {
    const env = createTestEnv();
    const uid = "profile-uid";
    const user = env.seedUser(uid);

    const response = await putProfile.handler(
      jsonRequest(`${BASE}/api/v1/users/me/profile`, uid, "PUT", {
        displayName: "Ada Lovelace",
        bio: "Building things",
        niche: "Tech education",
        experienceLevel: "intermediate",
      }),
      env,
    );
    expect(response.status).toBe(200);

    const stored = env.sqlite.prepare("SELECT display_name FROM users WHERE id = ?").get(user) as {
      display_name: string;
    };
    expect(stored.display_name).toBe("Ada Lovelace");

    const profile = await data(
      await getProfile.handler(authRequest(`${BASE}/api/v1/users/me/profile`, uid), env),
    );
    expect(profile.displayName).toBe("Ada Lovelace");
    expect(profile.profile.bio).toBe("Building things");
    expect(profile.profile.niche).toBe("Tech education");
  });

  it("strips markup from profile text instead of storing it verbatim", async () => {
    const env = createTestEnv();
    const uid = "profile-uid-2";
    const user = env.seedUser(uid);

    await putProfile.handler(
      jsonRequest(`${BASE}/api/v1/users/me/profile`, uid, "PUT", {
        displayName: "<script>alert(1)</script>Ada",
        bio: "<b>Bold</b> bio",
      }),
      env,
    );

    const stored = env.sqlite.prepare("SELECT display_name FROM users WHERE id = ?").get(user) as {
      display_name: string;
    };
    expect(stored.display_name).toBe("alert(1)Ada");
    const row = env.sqlite
      .prepare("SELECT bio FROM creator_profiles WHERE user_id = ?")
      .get(user) as { bio: string };
    expect(row.bio).toBe("Bold bio");
  });

  it("refuses an over-long display name", async () => {
    const env = createTestEnv();
    const uid = "profile-uid-3";
    env.seedUser(uid);
    const response = await putProfile.handler(
      jsonRequest(`${BASE}/api/v1/users/me/profile`, uid, "PUT", {
        displayName: "x".repeat(200),
      }),
      env,
    );
    expect(response.status).toBe(400);
  });
});

describe("communities", () => {
  it("keeps a private community roster for members only", async () => {
    const env = createTestEnv();
    const ownerUid = "owner-uid";
    const owner = env.seedUser(ownerUid);
    const communityId = seedCommunity(env, owner, false);

    const outsiderUid = "outsider-uid";
    env.seedUser(outsiderUid);
    const denied = await members.handler(
      authRequest(`${BASE}/api/v1/communities/${communityId}/members`, outsiderUid),
      env,
    );
    expect(denied.status).toBe(403);

    const allowed = await members.handler(
      authRequest(`${BASE}/api/v1/communities/${communityId}/members`, ownerUid),
      env,
    );
    expect(allowed.status).toBe(200);
    expect((await data(allowed)).members).toHaveLength(1);
  });

  it("lets anyone read a public community roster", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-uid-2");
    const communityId = seedCommunity(env, owner, true, "community-public");
    const outsiderUid = "outsider-uid-2";
    env.seedUser(outsiderUid);

    const response = await members.handler(
      authRequest(`${BASE}/api/v1/communities/${communityId}/members`, outsiderUid),
      env,
    );
    expect(response.status).toBe(200);
  });

  it("restricts community settings to the owner", async () => {
    const env = createTestEnv();
    const ownerUid = "owner-uid-3";
    const owner = env.seedUser(ownerUid);
    const communityId = seedCommunity(env, owner, false, "community-3");
    const memberUid = "member-uid-3";
    env.seedUser(memberUid);

    const denied = await settings.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/settings`, memberUid, "PUT", {
        allowPeerReview: false,
      }),
      env,
    );
    expect(denied.status).toBe(403);

    const allowed = await settings.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/settings`, ownerUid, "PUT", {
        allowPeerReview: false,
        defaultLanguage: "en",
      }),
      env,
    );
    expect(allowed.status).toBe(200);
    const stored = env.sqlite
      .prepare("SELECT * FROM community_settings WHERE community_id = ?")
      .get(communityId) as { allow_peer_review: number; default_language: string };
    expect(stored.allow_peer_review).toBe(0);
    expect(stored.default_language).toBe("en");
  });

  it("only lists the communities the caller belongs to", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-uid-4");
    const other = env.seedUser("other-uid-4");
    seedCommunity(env, owner, false, "community-4");
    seedCommunity(env, other, false, "community-5");

    const body = await data(
      await listCommunities.handler(
        authRequest(`${BASE}/api/v1/communities`, "owner-uid-4"),
        env,
      ),
    );
    const ids = body.items.map((c: { id: string }) => c.id);
    expect(ids).toEqual(["community-4"]);
  });
});

describe("notifications", () => {
  it("only shows and clears the caller's notifications", async () => {
    const env = createTestEnv();
    const me = env.seedUser("me-uid");
    const other = env.seedUser("other-uid");
    seedNotification(env, me, "n-mine-1");
    seedNotification(env, me, "n-mine-2");
    const theirs = seedNotification(env, other, "n-theirs");

    const list = await data(
      await listNotifications.handler(authRequest(`${BASE}/api/v1/notifications`, "me-uid"), env),
    );
    expect(list.total).toBe(2);

    await readAll.handler(
      authRequest(`${BASE}/api/v1/notifications/read-all`, "me-uid", { method: "POST" }),
      env,
    );
    const unread = env.sqlite
      .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0")
      .get(other) as { c: number };
    expect(unread.c).toBe(1); // untouched

    // Deleting someone else's notification is a no-op, not an error.
    const del = await deleteNotification.handler(
      authRequest(`${BASE}/api/v1/notifications/${theirs}`, "me-uid", { method: "DELETE" }),
      env,
    );
    expect(del.status).toBe(200);
    const stillThere = env.sqlite
      .prepare("SELECT COUNT(*) AS c FROM notifications WHERE id = ?")
      .get(theirs) as { c: number };
    expect(stillThere.c).toBe(1);
  });

  it("sanitises notification text", async () => {
    const env = createTestEnv();
    const uid = "notify-uid";
    env.seedUser(uid);
    const response = await createNotification.handler(
      jsonRequest(`${BASE}/api/v1/notifications`, uid, "POST", {
        type: "SYSTEM",
        title: "<img src=x onerror=alert(1)>Hi",
        message: "You earned <b>50</b> credits",
      }),
      env,
    );
    expect(response.status).toBe(201);
    const row = env.sqlite
      .prepare("SELECT title, message FROM notifications ORDER BY created_at DESC LIMIT 1")
      .get() as { title: string; message: string };
    expect(row.title).toBe("Hi"); // the whole <img ...> tag is stripped
    expect(row.message).toBe("You earned 50 credits");
  });

  it("stores a push subscription once per endpoint", async () => {
    const env = createTestEnv();
    const uid = "push-sub-uid";
    const user = env.seedUser(uid);
    // Shape the browser sends (see src/hooks/use-push.ts).
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    };

    const first = await subscribe.handler(
      jsonRequest(`${BASE}/api/v1/notifications/push/subscribe`, uid, "POST", subscription),
      env,
    );
    expect(first.status).toBe(200);
    await subscribe.handler(
      jsonRequest(`${BASE}/api/v1/notifications/push/subscribe`, uid, "POST", subscription),
      env,
    );
    const rows = env.sqlite
      .prepare("SELECT COUNT(*) AS c FROM push_subscriptions WHERE user_id = ?")
      .get(user) as { c: number };
    expect(rows.c).toBe(1);
  });

  it("rejects a malformed push subscription", async () => {
    const env = createTestEnv();
    const uid = "push-sub-uid-2";
    env.seedUser(uid);
    const response = await subscribe.handler(
      jsonRequest(`${BASE}/api/v1/notifications/push/subscribe`, uid, "POST", {
        endpoint: "https://fcm.googleapis.com/fcm/send/x",
      }),
      env,
    );
    expect(response.status).toBe(400);
  });
});
