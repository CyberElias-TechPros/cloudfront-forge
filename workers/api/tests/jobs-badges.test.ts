import { describe, it, expect } from "vitest";
import { sweepBadgeAwards } from "../src/jobs/badges";
import { Database } from "../src/lib/database";
import { calculateLevel } from "../src/lib/utils";
import { createTestEnv } from "./helpers/test-env";

interface Row {
  [key: string]: unknown;
}

function seedReviews(env: ReturnType<typeof createTestEnv>, reviewerId: string, count: number) {
  const now = new Date().toISOString();
  for (let i = 0; i < count; i++) {
    env.sqlite
      .prepare(
        `INSERT INTO reviews (id, video_id, reviewer_id, submitter_id, status, assigned_at, completed_at, created_at, updated_at)
         VALUES (?, NULL, ?, ?, 'completed', ?, ?, ?, ?)`,
      )
      .run(crypto.randomUUID(), reviewerId, reviewerId, now, now, now, now);
  }
}

async function countWhere(
  sqlite: ReturnType<typeof createTestEnv>["sqlite"],
  sql: string,
  ...params: unknown[]
) {
  return (sqlite.prepare(sql).get(...(params as never[])) as { count: number }).count;
}

describe("badge award job", () => {
  it("awards review-streak-10 with XP and credits recorded in the ledgers", async () => {
    const env = createTestEnv();
    const userId = env.seedUser("streak-user");
    seedReviews(env, userId, 10);

    const awarded = await sweepBadgeAwards(new Database(env));
    expect(awarded).toBe(1);

    const badge = env.sqlite
      .prepare("SELECT badge_id FROM user_badges WHERE user_id = ?")
      .get(userId) as Row;
    expect(badge.badge_id).toBe("review-streak-10");

    // XP and credits must appear in the ledgers with the same conventions as
    // every other reward path — not just in the account totals.
    const xpTxn = env.sqlite
      .prepare(
        "SELECT * FROM xp_transactions WHERE user_id = ? AND reference_id = 'review-streak-10'",
      )
      .get(userId) as Row;
    expect(xpTxn).toBeDefined();
    expect(xpTxn.type).toBe("bonus");
    expect(xpTxn.amount).toBe(50);

    const creditTxn = env.sqlite
      .prepare(
        "SELECT * FROM credit_transactions WHERE user_id = ? AND reference_id = 'review-streak-10'",
      )
      .get(userId) as Row;
    expect(creditTxn).toBeDefined();
    expect(creditTxn.type).toBe("earned");
    expect(creditTxn.amount).toBe(20);
    expect(creditTxn.balance_after).toBe(20);

    const xpAccount = env.sqlite
      .prepare("SELECT total_xp, level FROM xp_accounts WHERE user_id = ?")
      .get(userId) as Row;
    expect(xpAccount.total_xp).toBe(50);
    expect(xpAccount.level).toBe(calculateLevel(50).level);

    const creditAccount = env.sqlite
      .prepare("SELECT balance FROM credit_accounts WHERE user_id = ?")
      .get(userId) as Row;
    expect(creditAccount.balance).toBe(20);

    const notifications = await countWhere(
      env.sqlite,
      "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND type = 'BADGE_EARNED'",
      userId,
    );
    expect(notifications).toBe(1);
  });

  it("does not double-award on a second run", async () => {
    const env = createTestEnv();
    const userId = env.seedUser("rerun-user");
    seedReviews(env, userId, 10);

    const db = new Database(env);
    const first = await sweepBadgeAwards(db);
    expect(first).toBe(1);

    const second = await sweepBadgeAwards(db);
    expect(second).toBe(0);

    const rows = await countWhere(
      env.sqlite,
      "SELECT COUNT(*) AS count FROM user_badges WHERE user_id = ?",
      userId,
    );
    expect(rows).toBe(1);
    const xpRows = await countWhere(
      env.sqlite,
      "SELECT COUNT(*) AS count FROM xp_transactions WHERE user_id = ?",
      userId,
    );
    expect(xpRows).toBe(1);
  });

  it("awards the review-count badge from the catalogue threshold", async () => {
    const env = createTestEnv();
    const userId = env.seedUser("count-user");
    seedReviews(env, userId, 50);

    const awarded = await sweepBadgeAwards(new Database(env));
    // review-streak-10 (review_streak) and review-streak-50 (review_count).
    expect(awarded).toBe(2);

    const creditAccount = env.sqlite
      .prepare("SELECT balance FROM credit_accounts WHERE user_id = ?")
      .get(userId) as Row;
    expect(creditAccount.balance).toBe(20 + 100);
  });

  it("awards supporter-1 after the first shop purchase", async () => {
    const env = createTestEnv();
    const userId = env.seedUser("supporter-user");
    env.sqlite
      .prepare(
        "INSERT INTO credit_purchases (id, user_id, item_type, cost_credits, created_at) VALUES (?, ?, 'boost', 10, ?)",
      )
      .run(crypto.randomUUID(), userId, new Date().toISOString());

    const awarded = await sweepBadgeAwards(new Database(env));
    expect(awarded).toBe(1);

    const badge = env.sqlite
      .prepare("SELECT badge_id FROM user_badges WHERE user_id = ?")
      .get(userId) as Row;
    expect(badge.badge_id).toBe("supporter-1");
  });
});
