/**
 * The daily bonus is the only place the login streak is advanced, so these
 * tests cover the streak arithmetic as well as the payout.
 *
 * Before this behaviour existed nothing ever wrote to `streaks`: the streak
 * stayed at 0 for every member, which pinned the bonus multiplier at 1.0 and
 * made the streak-freeze shop item meaningless.
 */
import { describe, it, expect } from "vitest";
import { gamificationRoutes } from "../src/routes/gamification";
import { createTestEnv, authRequest, type TestEnv } from "./helpers/test-env";

const BASE = "https://api.test";
const bonus = gamificationRoutes.find((r) => r.path === "/api/v1/gamification/daily-bonus")!;

function claim(env: TestEnv, uid: string) {
  return bonus.handler(authRequest(`${BASE}/api/v1/gamification/daily-bonus`, uid, { method: "POST" }), env);
}

function streakRow(env: TestEnv, userId: string) {
  return env.sqlite
    .prepare("SELECT current_streak, longest_streak, last_activity_date FROM streaks WHERE user_id = ? AND streak_type = 'daily_login'")
    .get(userId) as
    | { current_streak: number; longest_streak: number; last_activity_date: string }
    | undefined;
}

function balanceOf(env: TestEnv, userId: string): number {
  const row = env.sqlite
    .prepare("SELECT balance FROM credit_accounts WHERE user_id = ?")
    .get(userId) as { balance: number } | undefined;
  return row?.balance ?? 0;
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split("T")[0];
}

/** Backdate the claim so the next one counts as the following day. */
function pretendLastClaimWasOn(env: TestEnv, userId: string, day: string) {
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      "INSERT INTO streaks (id, user_id, current_streak, longest_streak, last_activity_date, streak_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'daily_login', ?, ?) ON CONFLICT DO NOTHING",
    )
    .run(crypto.randomUUID(), userId, 1, 1, day, now, now);
  env.sqlite
    .prepare("UPDATE streaks SET last_activity_date = ? WHERE user_id = ? AND streak_type = 'daily_login'")
    .run(day, userId);
  env.sqlite
    .prepare("UPDATE credit_accounts SET last_daily_bonus_date = ? WHERE user_id = ?")
    .run(day, userId);
  env.sqlite.prepare("DELETE FROM credit_transactions WHERE user_id = ? AND description = 'daily_bonus'").run(userId);
}

function setStreak(env: TestEnv, userId: string, current: number, longest: number, day: string) {
  env.sqlite
    .prepare(
      "UPDATE streaks SET current_streak = ?, longest_streak = ?, last_activity_date = ? WHERE user_id = ? AND streak_type = 'daily_login'",
    )
    .run(current, longest, day, userId);
}

describe("daily bonus", () => {
  it("starts a streak at 1 on the first claim", async () => {
    const env = createTestEnv();
    const uid = "bonus-uid-1";
    const userId = env.seedUser(uid);

    const response = await claim(env, uid);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { credits: number; streak: number; multiplier: number } };
    expect(body.data.credits).toBe(5);
    expect(body.data.streak).toBe(1);
    expect(body.data.multiplier).toBe(1);
    expect(balanceOf(env, userId)).toBe(5);
    expect(streakRow(env, userId)).toMatchObject({ current_streak: 1, longest_streak: 1 });
  });

  it("advances the streak and the multiplier on consecutive days", async () => {
    const env = createTestEnv();
    const uid = "bonus-uid-2";
    const userId = env.seedUser(uid);

    await claim(env, uid);
    pretendLastClaimWasOn(env, userId, dateDaysAgo(1));

    const response = await claim(env, uid);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { credits: number; streak: number; multiplier: number } };
    expect(body.data.streak).toBe(2);
    expect(body.data.multiplier).toBeCloseTo(1.1, 5);
    expect(body.data.credits).toBe(6); // round(5 * 1.1)
    const row = streakRow(env, userId);
    expect(row?.current_streak).toBe(2);
    expect(row?.longest_streak).toBe(2);
    expect(row?.last_activity_date).toBe(new Date().toISOString().split("T")[0]);
  });

  it("restarts at 1 after a missed day but keeps the record", async () => {
    const env = createTestEnv();
    const uid = "bonus-uid-3";
    const userId = env.seedUser(uid);

    await claim(env, uid);
    pretendLastClaimWasOn(env, userId, dateDaysAgo(4));
    setStreak(env, userId, 9, 9, dateDaysAgo(4));

    const response = await claim(env, uid);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { credits: number; streak: number; multiplier: number } };
    // The multiplier uses the banked streak, which is still 9 → round(5 × 1.9)
    expect(body.data.multiplier).toBeCloseTo(1.9, 5);
    expect(body.data.credits).toBe(10);
    expect(body.data.streak).toBe(1);
    const row = streakRow(env, userId);
    expect(row?.current_streak).toBe(1);
    expect(row?.longest_streak).toBe(9);
  });

  it("refuses a second claim on the same day", async () => {
    const env = createTestEnv();
    const uid = "bonus-uid-4";
    const userId = env.seedUser(uid);

    expect((await claim(env, uid)).status).toBe(200);
    const second = await claim(env, uid);
    expect(second.status).toBe(409);
    expect(balanceOf(env, userId)).toBe(5);
    expect(streakRow(env, userId)?.current_streak).toBe(1);
  });

  it("grows the multiplier to the 3× cap and no further", async () => {
    const env = createTestEnv();
    const uid = "bonus-uid-5";
    const userId = env.seedUser(uid);

    await claim(env, uid);
    pretendLastClaimWasOn(env, userId, dateDaysAgo(1));
    setStreak(env, userId, 40, 40, dateDaysAgo(1));

    const response = await claim(env, uid);
    const body = (await response.json()) as { data: { credits: number; multiplier: number; streak: number } };
    expect(body.data.multiplier).toBe(3);
    expect(body.data.credits).toBe(15);
    expect(body.data.streak).toBe(41);
    expect(balanceOf(env, userId)).toBe(20); // first claim (5) + capped claim (15)
  });

  it("requires authentication", async () => {
    const env = createTestEnv();
    const response = await bonus.handler(
      new Request(`${BASE}/api/v1/gamification/daily-bonus`, { method: "POST" }),
      env,
    );
    expect(response.status).toBe(401);
  });
});
