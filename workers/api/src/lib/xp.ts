import type { Database } from "./database";
import { calculateLevel } from "./utils";

export interface XpAccountState {
  totalXp: number;
  level: number;
  xpToNextLevel: number;
}

/**
 * Single source of truth for awarding XP.
 *
 * Before this helper, each reward path rolled its own level maths: the watch
 * claimer used `floor(totalXp / 250) + 1` while everything else used the
 * quadratic curve in `calculateLevel()`, and the mission/quest writers updated
 * `total_xp` without touching `level` at all — so a member's level depended on
 * which screen they last used and drifted out of sync. Every XP write now goes
 * through here, which also recomputes `level` (self-healing for rows written by
 * the older code).
 *
 * Returns the resulting account state so callers can report the new level.
 */
export async function awardXp(
  db: Database,
  userId: string,
  amount: number,
  now: string = new Date().toISOString(),
): Promise<XpAccountState> {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0;
  const account = await db.querySingle("SELECT total_xp FROM xp_accounts WHERE user_id = ?", [
    userId,
  ]);
  const totalXp = Math.max(0, Number(account?.total_xp ?? 0) + safeAmount);
  const { level, xpToNextLevel } = calculateLevel(totalXp);

  await db.execute(
    `INSERT INTO xp_accounts (id, user_id, total_xp, level, xp_to_next_level, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       total_xp = excluded.total_xp,
       level = excluded.level,
       xp_to_next_level = excluded.xp_to_next_level,
       updated_at = excluded.updated_at`,
    [db.uuid(), userId, totalXp, level, xpToNextLevel, now, now],
  );

  return { totalXp, level, xpToNextLevel };
}

/** Current level state for a member, without writing anything. */
export async function getXpState(db: Database, userId: string): Promise<XpAccountState> {
  const account = await db.querySingle(
    "SELECT total_xp, level, xp_to_next_level FROM xp_accounts WHERE user_id = ?",
    [userId],
  );
  const totalXp = Number(account?.total_xp ?? 0);
  const { level, xpToNextLevel } = calculateLevel(totalXp);
  return { totalXp, level, xpToNextLevel };
}
