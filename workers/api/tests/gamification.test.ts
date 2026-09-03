import { describe, it, expect } from "vitest";
import { gamificationRoutes } from "../src/routes/gamification";
import { createTestEnv, authRequest, jsonRequest, type TestEnv } from "./helpers/test-env";

const bonus = gamificationRoutes.find((r) => r.path === "/api/v1/gamification/daily-bonus");
const leaderboard = gamificationRoutes.find((r) => r.path === "/api/v1/leaderboards");
const credits = gamificationRoutes.find((r) => r.path === "/api/v1/credits");
if (!bonus || !leaderboard || !credits) throw new Error("gamification routes missing");

const BASE = "https://api.test";

async function data(response: Response) {
  return ((await response.json()) as { data: any }).data;
}

async function seedXp(env: TestEnv, userId: string, amount: number, daysAgo = 0): Promise<void> {
  env.sqlite
    .prepare(
      "INSERT INTO xp_transactions (id, user_id, amount, type, description, created_at) VALUES (?, ?, ?, 'bonus', 'test', datetime('now', ?))",
    )
    .run(crypto.randomUUID(), userId, amount, `-${daysAgo} days`);
  env.sqlite
    .prepare(
      "INSERT INTO xp_accounts (id, user_id, total_xp, level, xp_to_next_level, created_at, updated_at) VALUES (?, ?, ?, 1, 100, datetime('now'), datetime('now')) ON CONFLICT(user_id) DO UPDATE SET total_xp = total_xp + ?",
    )
    .run(crypto.randomUUID(), userId, amount, amount);
}

describe("daily bonus", () => {
  it("pays once per day and 409s on a repeat claim (even concurrently)", async () => {
    const env = createTestEnv();
    const uid = "bonus-uid";
    env.seedUser(uid);

    // Two concurrent claims on a pristine account: exactly one may win.
    const [a, b] = await Promise.all([
      bonus!.handler(
        authRequest(`${BASE}/api/v1/gamification/daily-bonus`, uid, { method: "POST" }),
        env,
      ),
      bonus!.handler(
        authRequest(`${BASE}/api/v1/gamification/daily-bonus`, uid, { method: "POST" }),
        env,
      ),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = a.status === 200 ? a : b;
    const firstBody = await data(winner);
    expect(firstBody.credits).toBeGreaterThan(0);

    // And a later claim the same day is refused.
    const third = await bonus!.handler(
      authRequest(`${BASE}/api/v1/gamification/daily-bonus`, uid, { method: "POST" }),
      env,
    );
    expect(third.status).toBe(409);
  });

  it("reports the credited balance", async () => {
    const env = createTestEnv();
    const uid = "bonus-uid-2";
    env.seedUser(uid);
    const claim = await data(
      await bonus!.handler(
        authRequest(`${BASE}/api/v1/gamification/daily-bonus`, uid, { method: "POST" }),
        env,
      ),
    );
    const summary = await data(
      await credits!.handler(authRequest(`${BASE}/api/v1/credits`, uid), env),
    );
    expect(summary.balance).toBe(claim.credits);
    expect(summary.totalEarned).toBe(claim.credits);
  });
});

describe("leaderboard", () => {
  it("honours the timeframe filter", async () => {
    const env = createTestEnv();
    const viewerUid = "viewer-uid";
    env.seedUser(viewerUid);
    const recent = env.seedUser("recent-uid");
    const old = env.seedUser("old-uid");

    seedXp(env, recent, 500, 1); // inside the weekly window
    seedXp(env, old, 900, 40); // outside every window

    const weekly = await data(
      await leaderboard!.handler(
        authRequest(`${BASE}/api/v1/leaderboards?timeframe=weekly`, viewerUid),
        env,
      ),
    );
    expect(weekly.timeframe).toBe("weekly");
    const weeklyIds = weekly.items.map((row: { id: string }) => row.id);
    expect(weeklyIds).toContain(recent);

    const weeklyRecent = weekly.items.find((row: { id: string }) => row.id === recent);
    const weeklyOld = weekly.items.find((row: { id: string }) => row.id === old);
    expect(weeklyRecent.totalXp).toBe(500);
    expect(weeklyOld.totalXp).toBe(0);

    const allTime = await data(
      await leaderboard!.handler(
        authRequest(`${BASE}/api/v1/leaderboards?timeframe=all`, viewerUid),
        env,
      ),
    );
    const allTimeOld = allTime.items.find((row: { id: string }) => row.id === old);
    expect(allTimeOld.totalXp).toBe(900);
  });

  it("ranks members by the weighted score and reports ranks", async () => {
    const env = createTestEnv();
    const viewerUid = "viewer-uid-2";
    env.seedUser(viewerUid);
    const top = env.seedUser("top-uid");
    seedXp(env, top, 1000, 1);

    const body = await data(
      await leaderboard!.handler(
        authRequest(`${BASE}/api/v1/leaderboards?timeframe=weekly`, viewerUid),
        env,
      ),
    );
    expect(body.items[0].id).toBe(top);
    expect(body.items[0].rank).toBe(1);
    const scores = body.items.map((row: { weightedScore: number }) => row.weightedScore);
    expect([...scores].sort((a: number, b: number) => b - a)).toEqual(scores);
  });

  it("is public so the landing page can render it before sign-in", async () => {
    const env = createTestEnv();
    const response = await leaderboard!.handler(
      new Request(`${BASE}/api/v1/leaderboards`),
      env,
    );
    expect(response.status).toBe(200);
  });
});

describe("credits", () => {
  it("separates earned from spent", async () => {
    const env = createTestEnv();
    const uid = "credits-uid";
    const user = env.seedUser(uid);
    const now = new Date().toISOString();
    env.sqlite
      .prepare(
        "INSERT INTO credit_transactions (id, user_id, amount, type, description, balance_after, created_at) VALUES (?, ?, 100, 'earned', 'test', 100, ?)",
      )
      .run(crypto.randomUUID(), user, now);
    env.sqlite
      .prepare(
        "INSERT INTO credit_transactions (id, user_id, amount, type, description, balance_after, created_at) VALUES (?, ?, -40, 'spent', 'test', 60, ?)",
      )
      .run(crypto.randomUUID(), user, now);

    const summary = await data(await credits!.handler(authRequest(`${BASE}/api/v1/credits`, uid), env));
    expect(summary.totalEarned).toBe(100);
    expect(summary.totalSpent).toBe(40);
  });
});

describe("profile XP endpoint", () => {
  it("reports a level consistent with total XP", async () => {
    const env = createTestEnv();
    const uid = "xp-uid";
    const user = env.seedUser(uid);
    seedXp(env, user, 1000, 1);
    const xpRoute = gamificationRoutes.find((r) => r.path === "/api/v1/xp");
    const body = await data(await xpRoute!.handler(authRequest(`${BASE}/api/v1/xp`, uid), env));
    expect(body.totalXp).toBe(1000);
    expect(body.currentLevel).toBeGreaterThan(1);
    expect(body.xpToNextLevel).toBeGreaterThan(0);
  });
});
