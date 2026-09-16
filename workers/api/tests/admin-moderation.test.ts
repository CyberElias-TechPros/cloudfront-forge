import { describe, it, expect } from "vitest";
import { adminRoutes } from "../src/routes/admin";
import { reportRoutes } from "../src/routes/reports";
import { createTestEnv, authRequest, jsonRequest } from "./helpers/test-env";

const BASE = "https://api.test";

function findAdmin(method: string, fragment: string) {
  const route = adminRoutes.find(
    (r) => r.method === method && (r.path ?? r.pattern ?? "").includes(fragment),
  );
  if (!route) throw new Error(`admin route not found: ${method} ${fragment}`);
  return route;
}

const reviewAppealRoute = reportRoutes.find(
  (r) => "pattern" in r && r.method === "POST" && (r.pattern ?? "").includes("admin/appeals"),
)!;

async function data(response: Response) {
  return (await response.json()) as { success: boolean; data?: any; error?: { code: string } };
}

function seedVideo(env: TestEnv, userId: string, communityId: string | null, id: string, status = "active") {
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      "INSERT INTO videos (id, user_id, community_id, youtube_url, title, status, created_at, updated_at) VALUES (?, ?, ?, 'https://youtu.be/z', 'Vid', ?, ?, ?)",
    )
    .run(id, userId, communityId, status, now, now);
  return id;
}

describe("admin suspension", () => {
  const suspend = findAdmin("POST", "/suspend$");
  const reinstate = findAdmin("POST", "/reinstate$");

  it("admin suspends a member and the member is notified", async () => {
    const env = createTestEnv();
    const admin = env.seedUser("admin-s");
    const target = env.seedUser("target-s");
    env.makeAdmin(admin);

    const response = await suspend.handler(
      jsonRequest(`${BASE}/api/v1/admin/users/${target}/suspend`, "admin-s", "POST", {
        reason: "cheating watches",
      }),
      env,
    );
    expect(response.status).toBe(200);
    const row = env.sqlite.prepare("SELECT status FROM users WHERE id = ?").get(target) as any;
    expect(row.status).toBe("suspended");
    const notified = env.sqlite
      .prepare("SELECT message FROM notifications WHERE user_id = ? AND type = 'ACCOUNT_SUSPENDED'")
      .get(target) as any;
    expect(notified.message).toContain("cheating watches");
  });

  it("cannot suspend yourself or a super admin", async () => {
    const env = createTestEnv();
    const admin = env.seedUser("admin-s2");
    const superAdmin = env.seedUser("super-s2");
    env.makeAdmin(admin);
    env.makeAdmin(superAdmin, "super_admin");

    const self = await suspend.handler(
      jsonRequest(`${BASE}/api/v1/admin/users/${admin}/suspend`, "admin-s2", "POST", {}),
      env,
    );
    expect(self.status).toBe(400);

    const superTarget = await suspend.handler(
      jsonRequest(`${BASE}/api/v1/admin/users/${superAdmin}/suspend`, "admin-s2", "POST", {}),
      env,
    );
    expect(superTarget.status).toBe(403);
  });

  it("non-admins are refused", async () => {
    const env = createTestEnv();
    const nobody = env.seedUser("nobody-s");
    const target = env.seedUser("target-s3");

    const response = await suspend.handler(
      jsonRequest(`${BASE}/api/v1/admin/users/${target}/suspend`, "nobody-s", "POST", {}),
      env,
    );
    expect(response.status).toBe(403);
  });

  it("reinstate only works for suspended members", async () => {
    const env = createTestEnv();
    const admin = env.seedUser("admin-r");
    const target = env.seedUser("target-r");
    env.makeAdmin(admin);

    const before = await reinstate.handler(
      jsonRequest(`${BASE}/api/v1/admin/users/${target}/reinstate`, "admin-r", "POST", {}),
      env,
    );
    expect(before.status).toBe(409);

    env.sqlite.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(target);
    const after = await reinstate.handler(
      jsonRequest(`${BASE}/api/v1/admin/users/${target}/reinstate`, "admin-r", "POST", {}),
      env,
    );
    expect(after.status).toBe(200);
    const row = env.sqlite.prepare("SELECT status FROM users WHERE id = ?").get(target) as any;
    expect(row.status).toBe("active");
  });
});

describe("admin role management", () => {
  const role = findAdmin("POST", "/role$");
  const metrics = findAdmin("GET", "/metrics");
  const appeals = findAdmin("GET", "/appeals");

  it("a freshly granted moderator can moderate but not read analytics", async () => {
    const env = createTestEnv();
    const admin = env.seedUser("admin-role");
    const target = env.seedUser("target-role");
    env.makeAdmin(admin);

    const grant = await role.handler(
      jsonRequest(`${BASE}/api/v1/admin/users/${target}/role`, "admin-role", "POST", {
        role: "moderator",
      }),
      env,
    );
    expect(grant.status).toBe(200);

    // Moderation tier (appeals queue) is open to moderators…
    const asModerator = await appeals.handler(
      authRequest(`${BASE}/api/v1/admin/appeals`, "target-role"),
      env,
    );
    expect(asModerator.status).toBe(200);

    // …analytics stays admin-only.
    const analytics = await metrics.handler(
      authRequest(`${BASE}/api/v1/admin/metrics`, "target-role"),
      env,
    );
    expect(analytics.status).toBe(403);
  });

  it("plain admins cannot manage the admin tier; super admins can", async () => {
    const env = createTestEnv();
    const admin = env.seedUser("admin-tier");
    const superAdmin = env.seedUser("super-tier");
    const target = env.seedUser("target-tier");
    env.makeAdmin(admin);
    env.makeAdmin(superAdmin, "super_admin");

    const asAdmin = await role.handler(
      jsonRequest(`${BASE}/api/v1/admin/users/${target}/role`, "admin-tier", "POST", {
        role: "admin",
      }),
      env,
    );
    expect(asAdmin.status).toBe(403);

    const asSuper = await role.handler(
      jsonRequest(`${BASE}/api/v1/admin/users/${target}/role`, "super-tier", "POST", {
        role: "admin",
      }),
      env,
    );
    expect(asSuper.status).toBe(200);
    const row = env.sqlite.prepare("SELECT role FROM admin_users WHERE user_id = ?").get(target) as any;
    expect(row.role).toBe("admin");
  });

  it("revokes roles by passing null, but never touches super admins or yourself", async () => {
    const env = createTestEnv();
    const actor = env.seedUser("super-rv");
    const superTarget = env.seedUser("super-target-rv");
    const admin = env.seedUser("admin-rv");
    env.makeAdmin(actor, "super_admin");
    env.makeAdmin(superTarget, "super_admin");
    env.makeAdmin(admin);
    const target = env.seedUser("target-rv");
    env.makeAdmin(target, "admin");

    const revoke = await role.handler(
      jsonRequest(`${BASE}/api/v1/admin/users/${target}/role`, "super-rv", "POST", { role: null }),
      env,
    );
    expect(revoke.status).toBe(200);
    const row = env.sqlite.prepare("SELECT * FROM admin_users WHERE user_id = ?").get(target);
    expect(row ?? null).toBeNull();

    const self = await role.handler(
      jsonRequest(`${BASE}/api/v1/admin/users/${admin}/role`, "admin-rv", "POST", { role: null }),
      env,
    );
    expect(self.status).toBe(400);

    const invalidRole = await role.handler(
      jsonRequest(`${BASE}/api/v1/admin/users/${superTarget}/role`, "super-rv", "POST", {
        role: "member" as any,
      }),
      env,
    );
    // role:member fails validation (only moderator/admin/null)
    expect(invalidRole.status).toBe(400);

    const superRevoke = await role.handler(
      jsonRequest(`${BASE}/api/v1/admin/users/${superTarget}/role`, "super-rv", "POST", { role: null }),
      env,
    );
    expect(superRevoke.status).toBe(403);
  });
});

describe("appeals make members whole", () => {
  function seedAppealCase(env: TestEnv) {
    const reporter = env.seedUser("reporter");
    const reported = env.seedUser("reported");
    const admin = env.seedUser("admin-app");
    env.makeAdmin(admin);
    const now = new Date().toISOString();

    env.sqlite
      .prepare(
        "INSERT INTO reputation_accounts (id, user_id, score, created_at, updated_at) VALUES (?, ?, 90, ?, ?)",
      )
      .run(crypto.randomUUID(), reported, now, now);
    env.sqlite
      .prepare(
        "INSERT INTO reports (id, reporter_id, reported_user_id, resource_type, resource_id, reason, status, created_at, updated_at) VALUES ('report-app', ?, ?, 'video', 'video-app', 'misleading', 'resolved', ?, ?)",
      )
      .run(reporter, reported, now, now);
    env.sqlite
      .prepare(
        "INSERT INTO videos (id, user_id, youtube_url, title, status, created_at, updated_at) VALUES ('video-app', ?, 'https://youtu.be/q', 'Vid', 'removed', ?, ?)",
      )
      .run(reported, now, now);
    env.sqlite
      .prepare(
        "INSERT INTO appeals (id, report_id, user_id, reason, status, created_at) VALUES ('appeal-app', 'report-app', ?, 'I did nothing wrong and can prove it', 'pending', ?)",
      )
      .run(reported, now);
    return { reporter, reported, admin };
  }

  it("lists pending appeals for admins", async () => {
    const env = createTestEnv();
    const { admin } = seedAppealCase(env);
    void admin;
    const list = findAdmin("GET", "/appeals");

    const response = await list.handler(
      authRequest(`${BASE}/api/v1/admin/appeals?status=pending`, "admin-app"),
      env,
    );
    expect(response.status).toBe(200);
    const body = await data(response);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].id).toBe("appeal-app");
    expect(body.data.items[0].reportReason).toBe("misleading");
  });

  it("accepting an appeal dismisses the report, restores trust, restores the video and notifies", async () => {
    const env = createTestEnv();
    const { reported } = seedAppealCase(env);

    const response = await reviewAppealRoute.handler(
      jsonRequest(`${BASE}/api/v1/admin/appeals/appeal-app`, "admin-app", "POST", {
        status: "accepted",
      }),
      env,
    );
    expect(response.status).toBe(200);

    const report = env.sqlite.prepare("SELECT status FROM reports WHERE id = 'report-app'").get() as any;
    expect(report.status).toBe("dismissed");

    const reputation = env.sqlite
      .prepare("SELECT score FROM reputation_accounts WHERE user_id = ?")
      .get(reported) as any;
    expect(reputation.score).toBe(100); // 90 + 10 restored, capped at 100

    const video = env.sqlite.prepare("SELECT status FROM videos WHERE id = 'video-app'").get() as any;
    expect(video.status).toBe("active");

    const notified = env.sqlite
      .prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND type = 'APPEAL_ACCEPTED'")
      .get(reported) as any;
    expect(notified.c).toBe(1);

    // Replay loses: the appeal is no longer pending.
    const replay = await reviewAppealRoute.handler(
      jsonRequest(`${BASE}/api/v1/admin/appeals/appeal-app`, "admin-app", "POST", {
        status: "accepted",
      }),
      env,
    );
    expect(replay.status).toBe(409);
  });

  it("rejecting an appeal keeps the penalty but notifies the appellant", async () => {
    const env = createTestEnv();
    const { reported } = seedAppealCase(env);

    const response = await reviewAppealRoute.handler(
      jsonRequest(`${BASE}/api/v1/admin/appeals/appeal-app`, "admin-app", "POST", {
        status: "rejected",
        note: "Evidence confirms the report",
      }),
      env,
    );
    expect(response.status).toBe(200);

    const reputation = env.sqlite
      .prepare("SELECT score FROM reputation_accounts WHERE user_id = ?")
      .get(reported) as any;
    expect(reputation.score).toBe(90);

    const notified = env.sqlite
      .prepare("SELECT message FROM notifications WHERE user_id = ? AND type = 'APPEAL_REJECTED'")
      .get(reported) as any;
    expect(notified.message).toContain("Evidence confirms");
  });
});

describe("reports against me (appeal entry point)", () => {
  const mine = reportRoutes.find((r) => r.path === "/api/v1/reports/mine")!;

  it("lists only the caller's reports with appeal state", async () => {
    const env = createTestEnv();
    const reporter = env.seedUser("reporter-mine");
    const reported = env.seedUser("reported-mine");
    const bystander = env.seedUser("bystander-mine");
    void bystander;
    const now = new Date().toISOString();
    env.sqlite
      .prepare(
        "INSERT INTO reports (id, reporter_id, reported_user_id, resource_type, resource_id, reason, status, created_at, updated_at) VALUES ('report-mine', ?, ?, 'user', ?, 'spam', 'pending', ?, ?)",
      )
      .run(reporter, reported, reported, now, now);

    const asReported = await mine.handler(
      authRequest(`${BASE}/api/v1/reports/mine`, "reported-mine"),
      env,
    );
    expect(asReported.status).toBe(200);
    const body = await data(asReported);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].id).toBe("report-mine");
    expect(body.data.items[0].appealed).toBeFalsy();

    // A member with no reports against them sees an empty list, not others'.
    const asBystander = await mine.handler(
      authRequest(`${BASE}/api/v1/reports/mine`, "bystander-mine"),
      env,
    );
    const bystanderBody = await data(asBystander);
    expect(bystanderBody.data.items).toHaveLength(0);
  });
});

describe("admin video restore", () => {
  const restore = findAdmin("POST", "/restore$");

  it("restores removed and archived videos, refuses active ones", async () => {
    const env = createTestEnv();
    const admin = env.seedUser("admin-vr");
    const creator = env.seedUser("creator-vr");
    env.makeAdmin(admin);
    seedVideo(env, creator, null, "video-removed", "removed");
    seedVideo(env, creator, null, "video-active", "active");

    const restored = await restore.handler(
      jsonRequest(`${BASE}/api/v1/admin/videos/video-removed/restore`, "admin-vr", "POST", {}),
      env,
    );
    expect(restored.status).toBe(200);
    const row = env.sqlite.prepare("SELECT status FROM videos WHERE id = 'video-removed'").get() as any;
    expect(row.status).toBe("active");

    const again = await restore.handler(
      jsonRequest(`${BASE}/api/v1/admin/videos/video-active/restore`, "admin-vr", "POST", {}),
      env,
    );
    expect(again.status).toBe(409);
  });
});

describe("admin user listing exposes moderation state", () => {
  const users = findAdmin("GET", "/users");

  it("filters by status and exposes platform roles", async () => {
    const env = createTestEnv();
    const admin = env.seedUser("admin-ul");
    const good = env.seedUser("good-ul");
    const bad = env.seedUser("bad-ul");
    env.makeAdmin(admin);
    env.makeAdmin(good, "moderator");
    env.sqlite.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(bad);

    const active = await users.handler(
      authRequest(`${BASE}/api/v1/admin/users?status=active`, "admin-ul"),
      env,
    );
    const activeBody = await data(active);
    const ids = activeBody.data.map((u: any) => u.id);
    expect(ids).toContain(good);
    expect(ids).not.toContain(bad);
    const goodEntry = activeBody.data.find((u: any) => u.id === good);
    expect(goodEntry.platformRole).toBe("moderator");

    const suspended = await users.handler(
      authRequest(`${BASE}/api/v1/admin/users?status=suspended`, "admin-ul"),
      env,
    );
    const suspendedBody = await data(suspended);
    expect(suspendedBody.data.map((u: any) => u.id)).toContain(bad);
  });
});
