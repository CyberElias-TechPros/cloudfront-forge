import { Database } from "../lib/database";

/**
 * Nightly anomaly scoring: flag users whose watch-claim cadence is > 3σ
 * off the cohort mean. Softly adjusts reputation_accounts.score.
 */
export async function sweepAnomalyScoring(db: Database): Promise<number> {
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  // Get per-user claim counts in the past 7 days
  const claimCounts = await db.query<{ user_id: string; claim_count: number }>(
    `SELECT watcher_id as user_id, COUNT(*) as claim_count
     FROM watch_sessions
     WHERE status = 'claimed' AND verified_at >= ?
     GROUP BY watcher_id`,
    [oneWeekAgo],
  );

  const counts = (claimCounts.results ?? []) as Array<{ user_id: string; claim_count: number }>;
  if (counts.length < 5) return 0; // Not enough data for meaningful stats

  // Calculate mean and stddev
  const values = counts.map((c) => c.claim_count);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);

  if (stddev < 1) return 0; // Very uniform behavior — no anomalies

  const threshold = mean + 3 * stddev;
  const now = new Date().toISOString();
  let flagged = 0;

  for (const row of counts) {
    if (row.claim_count > threshold) {
      // Soft penalty: deduct 2 points, minimum score 0
      await db.execute(
        `INSERT INTO reputation_events (id, user_id, event_type, points_change, description, created_at)
         VALUES (?, ?, 'anomaly', -2, ?, ?)`,
        [
          crypto.randomUUID(),
          row.user_id,
          `Claim rate ${(row.claim_count / 7).toFixed(1)}/day exceeds 3σ threshold`,
          now,
        ],
      );
      await db.execute(
        `UPDATE reputation_accounts
         SET score = MAX(0, score - 2), updated_at = ?
         WHERE user_id = ?`,
        [now, row.user_id],
      );
      flagged++;
    }
  }

  return flagged;
}
