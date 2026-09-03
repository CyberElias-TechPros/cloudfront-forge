import { Database } from "../lib/database";

/**
 * Mark mission assignments expired after 7 days still in assigned/in_progress.
 * Returns processed row count.
 */
export async function sweepOverdueMissions(db: Database): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.execute(
    `UPDATE mission_assignments
       SET status = 'expired', updated_at = ?
     WHERE status IN ('assigned', 'in_progress')
       AND assigned_at < datetime(?, '-7 days')`,
    [now, now],
  );
  return result.meta?.changes ?? 0;
}

/**
 * Mark reviews overdue after 48 hours (SLA).
 */
export async function sweepOverdueReviews(db: Database): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.execute(
    `UPDATE reviews
       SET status = 'overdue', updated_at = ?
     WHERE status IN ('assigned', 'in_progress')
       AND assigned_at < datetime(?, '-2 days')`,
    [now, now],
  );
  return result.meta?.changes ?? 0;
}

/**
 * Reset stale streaks: a streak breaks after 48 hours without activity.
 *
 * Activity means a claimed watch session *or* a daily-bonus claim — the streak
 * is advanced by the daily bonus, so judging it purely on watch sessions would
 * reset members who log in and claim every day but did not watch.
 *
 * Users with streak_freezes > 0 consume one freeze instead of losing the streak.
 */
export async function sweepStreakReset(db: Database): Promise<number> {
  const rows = await db.query(
    `SELECT s.user_id, s.streak_freezes FROM streaks s
     WHERE s.current_streak > 0
       AND NOT EXISTS (
         SELECT 1 FROM watch_sessions w
         WHERE w.watcher_id = s.user_id
           AND w.status = 'claimed'
           AND w.verified_at > datetime('now', '-2 days')
       )
       AND (s.last_activity_date IS NULL
            OR s.last_activity_date < date('now', '-2 days'))`,
    [],
  );
  if (rows.results.length === 0) return 0;
  const now = new Date().toISOString();
  let resets = 0;
  for (const row of rows.results as Array<{ user_id: string; streak_freezes: number }>) {
    if ((row.streak_freezes ?? 0) > 0) {
      await db.execute(
        "UPDATE streaks SET streak_freezes = streak_freezes - 1, updated_at = ? WHERE user_id = ?",
        [now, row.user_id],
      );
    } else {
      await db.execute(
        "UPDATE streaks SET current_streak = 0, updated_at = ? WHERE user_id = ?",
        [now, row.user_id],
      );
      resets++;
    }
  }
  return resets;
}
