import { describe, it, expect } from "vitest";
import { missionRoutes } from "../src/routes/missions";
import { createTestEnv, authRequest, jsonRequest } from "./helpers/test-env";

const BASE = "https://api.test";
const list = missionRoutes.find((r) => r.path === "/api/v1/missions" && r.method === "GET")!;
const assign = missionRoutes.find(
  (r) => "pattern" in r && (r.pattern ?? "").includes("assign$"),
)!;
const assignments = missionRoutes.find((r) => r.path === "/api/v1/missions/assignments")!;
const complete = missionRoutes.find(
  (r) => "pattern" in r && (r.pattern ?? "").includes("complete$"),
)!;

async function body(response: Response) {
  return (await response.json()) as { data?: any; error?: { code: string } };
}

function seedMission(
  env: ReturnType<typeof createTestEnv>,
  { xp = 50, credits = 10 } = {},
  id = "mission-1",
) {
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      `INSERT INTO missions (id, title, description, difficulty, xp_reward, credit_reward, time_estimate_minutes, is_active, valid_from, created_at, updated_at)
       VALUES (?, 'Watch three videos', 'Give honest feedback', 'easy', ?, ?, 15, 1, ?, ?, ?)`,
    )
    .run(id, xp, credits, now, now, now);
  return id;
}

function assignmentIdFor(env: ReturnType<typeof createTestEnv>, userId: string): string {
  const row = env.sqlite
    .prepare("SELECT id FROM mission_assignments WHERE user_id = ?")
    .get(userId) as { id: string };
  return row.id;
}

describe("missions", () => {
  it("lists the seeded starter missions for signed-in members", async () => {
    const env = createTestEnv();
    const uid = "member-uid";
    env.seedUser(uid);
    const response = await list.handler(authRequest(`${BASE}/api/v1/missions`, uid), env);
    expect(response.status).toBe(200);
    const payload = await body(response);
    expect(payload.data.total).toBeGreaterThan(0);
    expect(payload.data.items[0]).toHaveProperty("isAssigned");
  });

  it("requires authentication", async () => {
    const env = createTestEnv();
    const response = await list.handler(new Request(`${BASE}/api/v1/missions`), env);
    expect(response.status).toBe(401);
  });

  it("404s for an unknown mission instead of failing on the insert", async () => {
    const env = createTestEnv();
    const uid = "member-uid-2";
    env.seedUser(uid);
    const response = await assign.handler(
      authRequest(`${BASE}/api/v1/missions/does-not-exist/assign`, uid, { method: "POST" }),
      env,
    );
    expect(response.status).toBe(404);
  });

  it("assigns once and reuses the existing assignment on a second call", async () => {
    const env = createTestEnv();
    const uid = "member-uid-3";
    const user = env.seedUser(uid);
    const missionId = seedMission(env);

    const first = await assign.handler(
      authRequest(`${BASE}/api/v1/missions/${missionId}/assign`, uid, { method: "POST" }),
      env,
    );
    expect(first.status).toBe(200);

    const second = await assign.handler(
      authRequest(`${BASE}/api/v1/missions/${missionId}/assign`, uid, { method: "POST" }),
      env,
    );
    expect(second.status).toBe(200);
    const rows = env.sqlite
      .prepare("SELECT COUNT(*) AS c FROM mission_assignments WHERE user_id = ? AND mission_id = ?")
      .get(user, missionId) as { c: number };
    expect(rows.c).toBe(1);
  });

  it("pays XP and credits exactly once", async () => {
    const env = createTestEnv();
    const uid = "member-uid-4";
    const user = env.seedUser(uid);
    const missionId = seedMission(env, { xp: 50, credits: 10 });

    await assign.handler(
      authRequest(`${BASE}/api/v1/missions/${missionId}/assign`, uid, { method: "POST" }),
      env,
    );
    const assignmentId = assignmentIdFor(env, user);

    const first = await complete.handler(
      jsonRequest(`${BASE}/api/v1/missions/assignments/${assignmentId}/complete`, uid, "POST", {}),
      env,
    );
    expect(first.status).toBe(200);
    const rewards = (await body(first)).data;
    expect(rewards.xpEarned ?? rewards.xp).toBe(50);
    expect(rewards.creditsEarned ?? rewards.credits).toBe(10);

    const balance = env.sqlite
      .prepare("SELECT balance FROM credit_accounts WHERE user_id = ?")
      .get(user) as { balance: number };
    expect(balance.balance).toBe(10);

    const xp = env.sqlite
      .prepare("SELECT SUM(amount) AS total FROM xp_transactions WHERE user_id = ?")
      .get(user) as { total: number };
    expect(xp.total).toBe(50);

    const second = await complete.handler(
      jsonRequest(`${BASE}/api/v1/missions/assignments/${assignmentId}/complete`, uid, "POST", {}),
      env,
    );
    expect(second.status).toBe(409);

    const balanceAfter = env.sqlite
      .prepare("SELECT balance FROM credit_accounts WHERE user_id = ?")
      .get(user) as { balance: number };
    expect(balanceAfter.balance).toBe(10);
  });

  it("hides other members' assignments", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("member-uid-5");
    env.seedUser("intruder-uid-5");
    const missionId = seedMission(env);
    await assign.handler(
      authRequest(`${BASE}/api/v1/missions/${missionId}/assign`, "member-uid-5", {
        method: "POST",
      }),
      env,
    );
    const assignmentId = assignmentIdFor(env, owner);

    const response = await complete.handler(
      jsonRequest(
        `${BASE}/api/v1/missions/assignments/${assignmentId}/complete`,
        "intruder-uid-5",
        "POST",
        {},
      ),
      env,
    );
    expect(response.status).toBe(404);
  });

  it("lists assignments with a due date", async () => {
    const env = createTestEnv();
    const uid = "member-uid-6";
    env.seedUser(uid);
    const missionId = seedMission(env);
    await assign.handler(
      authRequest(`${BASE}/api/v1/missions/${missionId}/assign`, uid, { method: "POST" }),
      env,
    );

    const response = await assignments.handler(
      authRequest(`${BASE}/api/v1/missions/assignments`, uid),
      env,
    );
    expect(response.status).toBe(200);
    const payload = await body(response);
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.items[0].dueAt).toBeTruthy();
  });
});
