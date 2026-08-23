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
 * Reset stale streaks: streak breaks if no claim in last 48 hours.
 */
export async function sweepStreakReset(db: Database): Promise<number> {
  const rows = await db.query(
    `SELECT s.user_id FROM streaks s
     WHERE s.current_streak > 0
       AND NOT EXISTS (
         SELECT 1 FROM watch_sessions w
         WHERE w.watcher_id = s.user_id
           AND w.status = 'claimed'
           AND w.verified_at > datetime('now', '-2 days')
       )`,
    [],
  );
  if (rows.results.length === 0) return 0;
  const now = new Date().toISOString();
  const ids = rows.results.map((r: any) => r.user_id as string);
  await db.execute(
    `UPDATE streaks SET current_streak = 0, updated_at = ? WHERE user_id IN (${ids.map(() => "?").join(",")})`,
    [now, ...ids],
  );
  return ids.length;
}
