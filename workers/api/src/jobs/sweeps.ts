import { Database } from "../lib/database";
import type { Env } from "../types";
import { notifyUserPush } from "../lib/push";

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

/**
 * Recover overdue reviews: notify once, then reassign to another member.
 *
 * `sweepOverdueReviews` only flags reviews after the 48h SLA. Without a
 * recovery step the submitter waited forever. This sweep:
 *
 * 1. tells the late reviewer and the submitter once (overdue_notified guard);
 * 2. reassigns the review to the active community member with the fewest open
 *    reviews (never the submitter, never the current reviewer), resetting the
 *    SLA clock and notifying the new reviewer.
 *
 * If nobody else is available (single-member community), the review stays
 * overdue so the admin console can still see it. Returns rows processed.
 */
export async function recoverOverdueReviews(env: Env): Promise<number> {
  const db = new Database(env);
  const overdue = await db.query(
    `SELECT r.id, r.video_id, r.reviewer_id, r.submitter_id, r.overdue_notified
       FROM reviews r WHERE r.status = 'overdue'`,
    [],
  );
  if (overdue.results.length === 0) return 0;

  const now = new Date().toISOString();
  let processed = 0;

  for (const review of overdue.results as Array<{
    id: string;
    video_id: string;
    reviewer_id: string;
    submitter_id: string;
    overdue_notified: number | null;
  }>) {
    if (!review.overdue_notified) {
      await db.execute(
        "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, 'REVIEW_OVERDUE', 'Review overdue', 'A review assigned to you is more than 48 hours overdue and will be reassigned.', ?)",
        [crypto.randomUUID(), review.reviewer_id, now],
      );
      await db.execute(
        "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, 'REVIEW_OVERDUE', 'Review overdue', 'The review of your video is overdue — we are finding a new reviewer.', ?)",
        [crypto.randomUUID(), review.submitter_id, now],
      );
      await db.execute("UPDATE reviews SET overdue_notified = 1, updated_at = ? WHERE id = ?", [
        now,
        review.id,
      ]);
      processed++;
      continue; // notify this cycle, reassign the next one
    }

    const candidate = await db.querySingle(
      `SELECT cm.user_id
         FROM community_members cm
         JOIN videos v ON v.community_id = cm.community_id
        WHERE v.id = ?
          AND cm.status = 'active'
          AND cm.user_id != ?
          AND cm.user_id != ?
        ORDER BY (
          SELECT COUNT(*) FROM reviews rr
           WHERE rr.reviewer_id = cm.user_id AND rr.status IN ('assigned', 'in_progress')
        ) ASC
        LIMIT 1`,
      [review.video_id, review.reviewer_id, review.submitter_id],
    );
    if (!candidate?.user_id) continue;

    await db.execute(
      `UPDATE reviews
          SET reviewer_id = ?, status = 'assigned', assigned_at = ?, started_at = NULL,
              overdue_notified = 0, updated_at = ?
        WHERE id = ? AND status = 'overdue'`,
      [candidate.user_id, now, now, review.id],
    );
    await db.execute(
      "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, 'REVIEW_ASSIGNED', 'New review assigned', 'A review was reassigned to you after the previous reviewer missed the deadline.', ?)",
      [crypto.randomUUID(), candidate.user_id, now],
    );
    await notifyUserPush(
      env,
      candidate.user_id,
      "New review assigned",
      "A review was reassigned to you — please complete it within 48 hours.",
    );
    processed++;
  }

  return processed;
}
