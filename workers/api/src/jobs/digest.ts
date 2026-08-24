import { Database } from "../lib/database";
import { sendEmail } from "../lib/email";
import type { Env } from "../types";

interface DigestRow {
  user_id: string;
  email: string;
  display_name: string | null;
  videos_submitted: number;
  videos_watched: number;
  reviews_done: number;
  xp_earned: number;
  credits_earned: number;
  current_streak: number;
}

function renderDigestHtml(name: string, row: DigestRow): string {
  const displayName = name || "Creator";
  const streak = row.current_streak ?? 0;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0a0a;color:#e5e5e5;">
  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="font-size:24px;color:#fff;margin-bottom:4px;">LoopSquad Weekly Recap</h1>
    <p style="color:#a1a1aa;font-size:14px;">Your growth at a glance</p>
  </div>

  <div style="background:#18181b;border-radius:12px;padding:24px;margin-bottom:16px;">
    <p style="font-size:16px;margin:0 0 16px;color:#fff;">Hey ${displayName}, here's what you accomplished this week:</p>

    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 0;color:#a1a1aa;">Videos submitted</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#22c55e;">${row.videos_submitted}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#a1a1aa;">Videos watched</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#3b82f6;">${row.videos_watched}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#a1a1aa;">Reviews completed</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#a855f7;">${row.reviews_done}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#a1a1aa;">XP earned</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#eab308;">${row.xp_earned}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#a1a1aa;">Credits earned</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#f97316;">${row.credits_earned}</td>
      </tr>
      ${streak > 0 ? `
      <tr>
        <td style="padding:8px 0;color:#a1a1aa;">Current streak</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#ef4444;">🔥 ${streak} days</td>
      </tr>` : ""}
    </table>
  </div>

  <div style="text-align:center;margin-top:24px;">
    <a href="https://loop.freegameplay.site/gamification" style="display:inline-block;background:#6d28d9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View Dashboard</a>
  </div>

  <p style="text-align:center;color:#52525b;font-size:12px;margin-top:32px;">
    You're receiving this because you're a LoopSquad member. <a href="https://loop.freegameplay.site/settings" style="color:#7c3aed;">Manage preferences</a>
  </p>
</body>
</html>`;
}

export async function sendWeeklyDigests(env: Env): Promise<number> {
  const db = new Database(env);
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const rows = await db.query<DigestRow>(
    `SELECT
       u.id as user_id,
       u.email,
       u.display_name,
       (SELECT COUNT(*) FROM videos v WHERE v.user_id = u.id AND v.created_at >= ?) as videos_submitted,
       (SELECT COUNT(*) FROM watch_sessions w WHERE w.watcher_id = u.id AND w.verified_at >= ?) as videos_watched,
       (SELECT COUNT(*) FROM reviews r WHERE r.reviewer_id = u.id AND r.completed_at >= ?) as reviews_done,
       COALESCE((SELECT SUM(xt.amount) FROM xp_transactions xt WHERE xt.user_id = u.id AND xt.created_at >= ?), 0) as xp_earned,
       COALESCE((SELECT SUM(ct.amount) FROM credit_transactions ct WHERE ct.user_id = u.id AND ct.type = 'earned' AND ct.created_at >= ?), 0) as credits_earned,
       COALESCE((SELECT s.current_streak FROM streaks s WHERE s.user_id = u.id AND s.streak_type = 'daily_login'), 0) as current_streak
     FROM users u
     WHERE u.email IS NOT NULL
       AND u.email_verified = 1
       AND u.deleted_at IS NULL
       AND EXISTS (
         SELECT 1 FROM notification_preferences np
         WHERE np.user_id = u.id AND np.email_enabled = 1
       )`,
    [oneWeekAgo, oneWeekAgo, oneWeekAgo, oneWeekAgo, oneWeekAgo],
  );

  let sent = 0;
  for (const row of rows.results as DigestRow[]) {
    if (!row.email) continue;
    const name = row.display_name ?? "Creator";
    const html = renderDigestHtml(name, row);
    const ok = await sendEmail(env, {
      to: row.email,
      subject: `🔥 Your LoopSquad Weekly Recap`,
      html,
    });
    if (ok) sent++;
  }
  return sent;
}
