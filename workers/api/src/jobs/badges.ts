import { Database, type Statement } from "../lib/database";
import { calculateLevel } from "../lib/utils";

interface BadgeCatalogRow {
  id: string;
  name: string;
  xp_reward: number | null;
  credit_reward: number | null;
  criteria_value: string | null;
}

interface AwardContext {
  db: Database;
  now: string;
  awarded: number;
  /** Track (user, badge) pairs this run has already queued so overlapping
   *  criteria (e.g. streak-10 and streak-50) never double-award. */
  queued: Set<string>;
}

/**
 * Insert an in-app notification for a badge award.
 */
function notifyStatement(
  ctx: AwardContext,
  userId: string,
  badge: BadgeCatalogRow,
  xpAmount: number,
  creditAmount: number,
): Statement {
  const parts: string[] = [];
  if (xpAmount > 0) parts.push(`${xpAmount} XP`);
  if (creditAmount > 0) parts.push(`${creditAmount} credits`);
  const rewards = parts.length > 0 ? ` You earned ${parts.join(" and ")}.` : "";
  return {
    sql: "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, 'BADGE_EARNED', 'Badge Earned!', ?, ?)",
    params: [ctx.db.uuid(), userId, `You unlocked the "${badge.name}" badge.${rewards}`, ctx.now],
  };
}

/**
 * Award one badge: badge row, notification, XP ledger + account, credit
 * ledger + account — all in a single D1 batch, so a crash can never leave a
 * badge granted without its rewards or rewards without a ledger row.
 */
async function awardBadge(
  ctx: AwardContext,
  userId: string,
  badge: BadgeCatalogRow,
): Promise<void> {
  const key = `${userId}:${badge.id}`;
  if (ctx.queued.has(key)) return;
  ctx.queued.add(key);

  const existing = await ctx.db.querySingle(
    "SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?",
    [userId, badge.id],
  );
  if (existing) return;

  const xpAmount = Math.max(0, Math.trunc(Number(badge.xp_reward ?? 0)));
  const creditAmount = Math.max(0, Math.trunc(Number(badge.credit_reward ?? 0)));

  const statements: Statement[] = [
    {
      sql: "INSERT INTO user_badges (id, user_id, badge_id, earned_at) VALUES (?, ?, ?, ?)",
      params: [ctx.db.uuid(), userId, badge.id, ctx.now],
    },
    notifyStatement(ctx, userId, badge, xpAmount, creditAmount),
  ];

  if (xpAmount > 0) {
    // XP: recompute the level from the curve, exactly like awardXp() does for
    // every other reward path.
    const account = await ctx.db.querySingle("SELECT total_xp FROM xp_accounts WHERE user_id = ?", [
      userId,
    ]);
    const totalXp = Math.max(0, Number(account?.total_xp ?? 0)) + xpAmount;
    const { level, xpToNextLevel } = calculateLevel(totalXp);
    statements.push(
      {
        sql: `INSERT INTO xp_accounts (id, user_id, total_xp, level, xp_to_next_level, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(user_id) DO UPDATE SET
                total_xp = excluded.total_xp,
                level = excluded.level,
                xp_to_next_level = excluded.xp_to_next_level,
                updated_at = excluded.updated_at`,
        params: [ctx.db.uuid(), userId, totalXp, level, xpToNextLevel, ctx.now, ctx.now],
      },
      {
        sql: `INSERT INTO xp_transactions (id, user_id, amount, type, description, reference_id, created_at)
              VALUES (?, ?, ?, 'bonus', ?, ?, ?)`,
        params: [ctx.db.uuid(), userId, xpAmount, `Badge: ${badge.name}`, badge.id, ctx.now],
      },
    );
  }

  if (creditAmount > 0) {
    const creditAccount = await ctx.db.querySingle(
      "SELECT balance FROM credit_accounts WHERE user_id = ?",
      [userId],
    );
    const balanceAfter = Math.max(0, Number(creditAccount?.balance ?? 0)) + creditAmount;
    statements.push(
      {
        sql: `INSERT INTO credit_accounts (id, user_id, balance, created_at, updated_at)
              VALUES (?, ?, 0, ?, ?)
              ON CONFLICT(user_id) DO NOTHING`,
        params: [ctx.db.uuid(), userId, ctx.now, ctx.now],
      },
      {
        sql: "UPDATE credit_accounts SET balance = balance + ?, updated_at = ? WHERE user_id = ?",
        params: [creditAmount, ctx.now, userId],
      },
      {
        sql: `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, reference_id, created_at)
              VALUES (?, ?, 'earned', ?, ?, ?, ?, ?)`,
        params: [
          ctx.db.uuid(),
          userId,
          creditAmount,
          balanceAfter,
          `Badge: ${badge.name}`,
          badge.id,
          ctx.now,
        ],
      },
    );
  }

  await ctx.db.batch(statements);
  ctx.awarded++;
}

async function catalogBadges(db: Database, criteriaType: string): Promise<BadgeCatalogRow[]> {
  const result = await db.query(
    `SELECT id, name, xp_reward, credit_reward, criteria_value
     FROM badges
     WHERE criteria_type = ?
     ORDER BY CAST(criteria_value AS INTEGER) ASC`,
    [criteriaType],
  );
  return (result.results ?? []) as BadgeCatalogRow[];
}

/**
 * Award badges whose criteria the member has met.
 *
 * Criteria are read from the badge catalogue (`badges.criteria_type` +
 * `criteria_value`), so adding a badge in the DB is enough — no code change:
 * - `review_streak`: completed reviews with no skipped review ever (a skip
 *   breaks the streak), threshold = reviews completed.
 * - `review_count`: total completed reviews.
 * - `credit_purchase`: shop purchases made.
 *
 * Each award (badge row + notification + XP/credit ledgers + account updates)
 * is one atomic D1 batch — previously rewards bypassed both ledgers and the
 * statements were separate, so a crash between them could grant a badge
 * without its payout (or vice versa) and credit rewards were invisible in the
 * transaction history.
 */
export async function sweepBadgeAwards(db: Database): Promise<number> {
  const ctx: AwardContext = { db, now: new Date().toISOString(), awarded: 0, queued: new Set() };

  // Review-streak badges: reviewers with no skipped review ever.
  const streakBadges = await catalogBadges(db, "review_streak");
  if (streakBadges.length > 0) {
    const reviewers = await db.query(
      `SELECT reviewer_id as user_id, COUNT(*) as streak
       FROM reviews
       WHERE status = 'completed'
         AND reviewer_id NOT IN (
           SELECT reviewer_id FROM reviews WHERE status = 'skipped'
         )
       GROUP BY reviewer_id`,
      [],
    );
    for (const row of (reviewers.results ?? []) as Array<{ user_id: string; streak: number }>) {
      for (const badge of streakBadges) {
        const threshold = parseInt(badge.criteria_value ?? "", 10);
        if (Number.isFinite(threshold) && row.streak >= threshold) {
          await awardBadge(ctx, row.user_id, badge);
        }
      }
    }
  }

  // Review-count badges: total completed reviews.
  const countBadges = await catalogBadges(db, "review_count");
  if (countBadges.length > 0) {
    const reviewers = await db.query(
      `SELECT reviewer_id as user_id, COUNT(*) as cnt
       FROM reviews
       WHERE status = 'completed'
       GROUP BY reviewer_id`,
      [],
    );
    for (const row of (reviewers.results ?? []) as Array<{ user_id: string; cnt: number }>) {
      for (const badge of countBadges) {
        const threshold = parseInt(badge.criteria_value ?? "", 10);
        if (Number.isFinite(threshold) && row.cnt >= threshold) {
          await awardBadge(ctx, row.user_id, badge);
        }
      }
    }
  }

  // Supporter badges: any credit purchase.
  const purchaseBadges = await catalogBadges(db, "credit_purchase");
  if (purchaseBadges.length > 0) {
    const supporters = await db.query(
      "SELECT user_id, COUNT(*) as cnt FROM credit_purchases GROUP BY user_id",
      [],
    );
    for (const row of (supporters.results ?? []) as Array<{ user_id: string; cnt: number }>) {
      for (const badge of purchaseBadges) {
        const threshold = parseInt(badge.criteria_value ?? "", 10);
        if (Number.isFinite(threshold) && row.cnt >= threshold) {
          await awardBadge(ctx, row.user_id, badge);
        }
      }
    }
  }

  return ctx.awarded;
}
