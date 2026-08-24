import { Database } from "../lib/database";

/**
 * Award badges based on earned criteria:
 * - review-streak: completed reviews without skipping
 * - review-count: total completed reviews
 * - credit_purchase: any shop purchase
 * - Other criteria_type values checked against DB
 */
export async function sweepBadgeAwards(db: Database): Promise<number> {
  const now = new Date().toISOString();
  let awarded = 0;

  // Review streak badges
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
    const badges = await db.query("SELECT criteria_value FROM badges WHERE criteria_type = 'review_streak'", []);
    for (const badge of (badges.results ?? []) as Array<{ criteria_value: string }>) {
      const threshold = parseInt(badge.criteria_value, 10);
      if (row.streak >= threshold) {
        const badgeId = `review-streak-${threshold}`;
        const existing = await db.querySingle(
          "SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?",
          [row.user_id, badgeId],
        );
        if (!existing) {
          const xp = await db.querySingle("SELECT xp_reward, credit_reward FROM badges WHERE id = ?", [badgeId]);
          await db.execute(
            "INSERT INTO user_badges (id, user_id, badge_id, earned_at) VALUES (?, ?, ?, ?)",
            [crypto.randomUUID(), row.user_id, badgeId, now],
          );
          if (xp) {
            await db.execute(
              "UPDATE xp_accounts SET total_xp = total_xp + ?, updated_at = ? WHERE user_id = ?",
              [xp.xp_reward ?? 0, now, row.user_id],
            );
            await db.execute(
              "UPDATE credit_accounts SET balance = balance + ?, updated_at = ? WHERE user_id = ?",
              [xp.credit_reward ?? 0, now, row.user_id],
            );
          }
          awarded++;
        }
      }
    }
  }

  // Review count badges (50 reviews)
  const reviewCounts = await db.query(
    `SELECT reviewer_id as user_id, COUNT(*) as cnt
     FROM reviews WHERE status = 'completed'
     GROUP BY reviewer_id HAVING cnt >= 50`,
    [],
  );
  for (const row of (reviewCounts.results ?? []) as Array<{ user_id: string }>) {
    const existing = await db.querySingle(
      "SELECT id FROM user_badges WHERE user_id = ? AND badge_id = 'review-streak-50'",
      [row.user_id],
    );
    if (!existing) {
      await db.execute(
        "INSERT INTO user_badges (id, user_id, badge_id, earned_at) VALUES (?, ?, 'review-streak-50', ?)",
        [crypto.randomUUID(), row.user_id, now],
      );
      awarded++;
    }
  }

  // Supporter badge: any credit purchase
  const supporters = await db.query(
    "SELECT DISTINCT user_id FROM credit_purchases",
    [],
  );
  for (const row of (supporters.results ?? []) as Array<{ user_id: string }>) {
    const existing = await db.querySingle(
      "SELECT id FROM user_badges WHERE user_id = ? AND badge_id = 'supporter-1'",
      [row.user_id],
    );
    if (!existing) {
      await db.execute(
        "INSERT INTO user_badges (id, user_id, badge_id, earned_at) VALUES (?, ?, 'supporter-1', ?)",
        [crypto.randomUUID(), row.user_id, now],
      );
      awarded++;
    }
  }

  return awarded;
}
