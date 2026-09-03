import type { Env } from "../types";
import { Database } from "./database";
import { awardXp } from "./xp";

/**
 * Daily generated quests — 3 per user per day, auto-created on first fetch.
 * Types: watch_videos (2), give_reviews (1), submit_video (1)
 */

export type QuestType = "watch_videos" | "give_reviews" | "submit_video";

const QUEST_DEFS: Record<QuestType, { target: number; xp: number; credits: number }> = {
  watch_videos: { target: 2, xp: 15, credits: 20 },
  give_reviews: { target: 1, xp: 10, credits: 15 },
  submit_video: { target: 1, xp: 20, credits: 25 },
};

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Idempotently create today's quests for a user; returns today's quest rows. */
export async function ensureDailyQuests(env: Env, userId: string): Promise<Record<string, unknown>[]> {
  const db = new Database(env);
  const date = todayUTC();
  const now = new Date().toISOString();

  for (const [type, def] of Object.entries(QUEST_DEFS)) {
    await db.execute(
      `INSERT OR IGNORE INTO daily_quests (id, user_id, quest_date, quest_type, target_count, reward_xp, reward_credits, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [crypto.randomUUID(), userId, date, type, def.target, def.xp, def.credits, now],
    );
  }

  const rows = await db.query(
    "SELECT * FROM daily_quests WHERE user_id = ? AND quest_date = ? ORDER BY quest_type",
    [userId, date],
  );
  return rows.results;
}

/**
 * Increment progress for a quest type; awards rewards when target hit.
 * Returns true if this call completed the quest.
 */
export async function progressQuest(env: Env, userId: string, type: QuestType): Promise<boolean> {
  try {
    if (!(type in QUEST_DEFS)) return false;
    const db = new Database(env);
    const date = todayUTC();

    // Atomically bump progress only while still active and below target
    const res = await db.execute(
      `UPDATE daily_quests SET progress = progress + 1,
         status = CASE WHEN progress + 1 >= target_count THEN 'completed' ELSE status END,
         completed_at = CASE WHEN progress + 1 >= target_count THEN ? ELSE completed_at END
       WHERE user_id = ? AND quest_date = ? AND quest_type = ? AND status = 'active'`,
      [new Date().toISOString(), userId, date, type],
    );
    if (!res.meta.changes) return false;

    // Check whether this bump completed it
    const row = await db.query(
      "SELECT id, status, reward_xp, reward_credits FROM daily_quests WHERE user_id = ? AND quest_date = ? AND quest_type = ?",
      [userId, date, type],
    );
    const quest = row.results[0] as any;
    if (!quest || quest.status !== "completed") return false;

    // Award XP + credits via account tables (check-then-insert; no unique idx on user_id)
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at)
       VALUES (?, ?, ?, 'bonus', 'Daily quest reward', ?)`,
      [crypto.randomUUID(), userId, quest.reward_credits ?? 0, now],
    );
    const credit = await db.querySingle("SELECT id FROM credit_accounts WHERE user_id = ?", [userId]);
    if (credit) {
      await db.execute(
        "UPDATE credit_accounts SET balance = balance + ?, updated_at = ? WHERE user_id = ?",
        [quest.reward_credits ?? 0, now, userId],
      );
    } else {
      await db.execute(
        "INSERT INTO credit_accounts (id, user_id, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [crypto.randomUUID(), userId, quest.reward_credits ?? 0, now, now],
      );
    }

    await awardXp(db, userId, quest.reward_xp ?? 0, now);

    // Mark claimed immediately (auto-claim v1)
    await db.execute("UPDATE daily_quests SET status = 'claimed', claimed_at = ? WHERE id = ?", [
      new Date().toISOString(),
      quest.id,
    ]);

    return true;
  } catch {
    return false;
  }
}
