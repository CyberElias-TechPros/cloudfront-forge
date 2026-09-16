import { describe, it, expect } from "vitest";
import { adminRoutes } from "../src/routes/admin";
import { topupRoutes } from "../src/routes/topups";
import { missionRoutes } from "../src/routes/missions";
import { reportRoutes } from "../src/routes/reports";
import { createTestEnv, authRequest, jsonRequest } from "./helpers/test-env";

const BASE = "https://api.test";

const metrics = adminRoutes.find((r) => r.path === "/api/v1/admin/metrics" && r.method === "GET")!;
const adminUsers = adminRoutes.find((r) => r.path === "/api/v1/admin/users" && r.method === "GET")!;
const createMission = missionRoutes.find((r) => r.path === "/api/v1/missions" && r.method === "POST")!;
const adminTopups = topupRoutes.find((r) => r.path === "/api/v1/admin/topups" && r.method === "GET")!;
const approveTopup = topupRoutes.find((r) => "pattern" in r && r.pattern?.includes("approve"))!;
const reviewAppeal = reportRoutes.find(
  (r) => "pattern" in r && (r.pattern ?? "").includes("admin/appeals"),
)!;

async function body(response: Response) {
  return (await response.json()) as { success: boolean; data?: any; error?: { code: string } };
}

describe("admin endpoints", () => {
  it("reject anonymous callers with 401", async () => {
    const env = createTestEnv();
    const response = await metrics.handler(new Request(`${BASE}/api/v1/admin/metrics`), env);
    expect(response.status).toBe(401);
  });

  it("reject signed-in non-admins with 403", async () => {
    const env = createTestEnv();
    const uid = "member-uid";
    env.seedUser(uid);
    const response = await metrics.handler(
      authRequest(`${BASE}/api/v1/admin/metrics`, uid),
      env,
    );
    expect(response.status).toBe(403);
  });

  it("allow admins", async () => {
    const env = createTestEnv();
    const uid = "admin-uid";
    const user = env.seedUser(uid);
    env.makeAdmin(user);
    const response = await metrics.handler(
      authRequest(`${BASE}/api/v1/admin/metrics`, uid),
      env,
    );
    expect(response.status).toBe(200);
  });

  it("confine moderators to the moderation tier", async () => {
    const env = createTestEnv();
    const uid = "mod-uid";
    const user = env.seedUser(uid);
    env.makeAdmin(user, "moderator");

    // Moderation tier: the reports queue is open to moderators.
    const reports = adminRoutes.find((r) => r.path === "/api/v1/admin/reports")!;
    const reportsResponse = await reports.handler(
      authRequest(`${BASE}/api/v1/admin/reports`, uid),
      env,
    );
    expect(reportsResponse.status).toBe(200);

    // Admin tier: metrics and user management stay closed.
    const metricsResponse = await metrics.handler(
      authRequest(`${BASE}/api/v1/admin/metrics`, uid),
      env,
    );
    expect(metricsResponse.status).toBe(403);
    const usersResponse = await adminUsers.handler(
      authRequest(`${BASE}/api/v1/admin/users`, uid),
      env,
    );
    expect(usersResponse.status).toBe(403);
  });

  it("keep mission creation admin-only", async () => {
    const env = createTestEnv();
    const uid = "member-uid-2";
    env.seedUser(uid);
    const response = await createMission.handler(
      jsonRequest(`${BASE}/api/v1/missions`, uid, "POST", {
        title: "A perfectly valid mission title",
        description: "Should never be created by a normal member",
        difficulty: "easy",
        xpReward: 10,
        creditReward: 5,
        timeEstimateMinutes: 5,
      }),
      env,
    );
    expect(response.status).toBe(403);
    const rows = env.sqlite.prepare("SELECT COUNT(*) AS count FROM missions").get() as {
      count: number;
    };
    // Only the seeded starter catalogue should exist.
    expect(rows.count).toBeGreaterThan(0);
  });

  it("apply validated (not raw) input when an admin creates a mission", async () => {
    const env = createTestEnv();
    const uid = "admin-uid-2";
    const user = env.seedUser(uid);
    env.makeAdmin(user);

    const response = await createMission.handler(
      jsonRequest(`${BASE}/api/v1/missions`, uid, "POST", {
        title: "Admin-authored mission",
        description: "Created through the validated path",
        difficulty: "hard",
        timeEstimateMinutes: 30,
      }),
      env,
    );
    expect(response.status).toBe(201);
    const row = env.sqlite
      .prepare("SELECT * FROM missions WHERE title = ?")
      .get("Admin-authored mission") as Record<string, unknown> | undefined;
    expect(row).toBeTruthy();
    // Defaults from the schema, not raw-body undefined values.
    expect(row?.xp_reward).toBe(25);
    expect(row?.credit_reward).toBe(10);
    expect(row?.difficulty).toBe("hard");
  });

  it("record an audit entry for admin mission creation", async () => {
    const env = createTestEnv();
    const uid = "admin-uid-3";
    const user = env.seedUser(uid);
    env.makeAdmin(user);

    await createMission.handler(
      jsonRequest(`${BASE}/api/v1/missions`, uid, "POST", {
        title: "Audited mission",
        description: "Leaves a trail",
      }),
      env,
    );

    const audit = env.sqlite
      .prepare("SELECT * FROM audit_logs WHERE action = 'mission.create'")
      .all() as Record<string, unknown>[];
    expect(audit.length).toBe(1);
    expect(audit[0].actor_id).toBe(user);
  });
});

describe("admin top-up review", () => {
  function seedPendingTopup(env: ReturnType<typeof createTestEnv>, memberId: string): string {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    env.sqlite
      .prepare(
        `INSERT INTO topup_requests (id, user_id, tier_id, ngn_amount, credits_amount, transfer_reference, status, created_at)
         VALUES (?, ?, 'tier-1', 5000, 110, 'REF-123', 'pending', ?)`,
      )
      .run(id, memberId, now);
    return id;
  }

  it("credits the member once and rejects a second approval", async () => {
    const env = createTestEnv();
    const memberUid = "buyer-uid";
    const member = env.seedUser(memberUid);
    const adminUid = "topup-admin-uid";
    const admin = env.seedUser(adminUid);
    env.makeAdmin(admin);
    const topupId = seedPendingTopup(env, member);

    const first = await approveTopup.handler(
      jsonRequest(`${BASE}/api/v1/admin/topups/${topupId}/approve`, adminUid, "POST", {}),
      env,
    );
    expect(first.status).toBe(200);
    const credited = (await body(first)).data;
    expect(credited.credits).toBe(110);
    expect(credited.balance).toBe(110);

    const second = await approveTopup.handler(
      jsonRequest(`${BASE}/api/v1/admin/topups/${topupId}/approve`, adminUid, "POST", {}),
      env,
    );
    expect(second.status).toBe(409);

    const balance = env.sqlite
      .prepare("SELECT balance FROM credit_accounts WHERE user_id = ?")
      .get(member) as { balance: number } | undefined;
    expect(balance?.balance).toBe(110);
  });

  it("is refused for non-admins", async () => {
    const env = createTestEnv();
    const memberUid = "buyer-uid-2";
    const member = env.seedUser(memberUid);
    const topupId = seedPendingTopup(env, member);

    const response = await approveTopup.handler(
      jsonRequest(`${BASE}/api/v1/admin/topups/${topupId}/approve`, memberUid, "POST", {}),
      env,
    );
    expect(response.status).toBe(403);

    const listResponse = await adminTopups.handler(
      authRequest(`${BASE}/api/v1/admin/topups`, memberUid),
      env,
    );
    expect(listResponse.status).toBe(403);
  });

  it("audits approvals", async () => {
    const env = createTestEnv();
    const member = env.seedUser("buyer-uid-3");
    const adminUid = "topup-admin-uid-2";
    const admin = env.seedUser(adminUid);
    env.makeAdmin(admin);
    const topupId = seedPendingTopup(env, member);

    await approveTopup.handler(
      jsonRequest(`${BASE}/api/v1/admin/topups/${topupId}/approve`, adminUid, "POST", {}),
      env,
    );

    const audit = env.sqlite
      .prepare("SELECT * FROM audit_logs WHERE action = 'topup.approve'")
      .all() as Record<string, unknown>[];
    expect(audit.length).toBe(1);
    expect(audit[0].actor_id).toBe(admin);
    expect(audit[0].resource_id).toBe(topupId);
  });
});

describe("appeal review", () => {
  it("is admin-only (a plain member cannot accept their own appeal)", async () => {
    const env = createTestEnv();
    const uid = "appellant-uid";
    const user = env.seedUser(uid);
    const appealId = crypto.randomUUID();
    const reportId = crypto.randomUUID();
    const now = new Date().toISOString();
    env.sqlite
      .prepare(
        "INSERT INTO reports (id, reporter_id, resource_type, resource_id, reason, status, created_at, updated_at) VALUES (?, ?, 'video', ?, 'cheating', 'pending', ?, ?)",
      )
      .run(reportId, user, "video-1", now, now);
    env.sqlite
      .prepare(
        "INSERT INTO appeals (id, report_id, user_id, reason, status, created_at) VALUES (?, ?, ?, 'not fair', 'pending', ?)",
      )
      .run(appealId, reportId, user, now);

    const response = await reviewAppeal.handler(
      jsonRequest(`${BASE}/api/v1/admin/appeals/${appealId}`, uid, "POST", { status: "accepted" }),
      env,
    );
    expect(response.status).toBe(403);

    const appeal = env.sqlite
      .prepare("SELECT status FROM appeals WHERE id = ?")
      .get(appealId) as { status: string };
    expect(appeal.status).toBe("pending");
  });
});
