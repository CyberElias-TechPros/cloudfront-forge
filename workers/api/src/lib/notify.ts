import type { Env } from "../types";
import { Database } from "./database";
import { createLogger } from "./logger";
import { renderNotificationEmail, renderWelcomeEmail, sendEmail } from "./email";
import { notifyUserPush } from "./push";

/**
 * Central notification fan-out.
 *
 * Every user-visible event that leaves the database through here respects the
 * member's `notification_preferences` row on every channel:
 *
 * - category gates (`review_requests`, `mission_reminders`, `community_updates`)
 *   suppress the whole event when that category is switched off;
 * - `in_app_enabled` gates the inbox row;
 * - `push_enabled` + quiet hours gate Web Push (enforced again inside
 *   `notifyUserPush`, which other legacy call sites use directly);
 * - `email_enabled` gates the transactional email for the categories important
 *   enough to reach an inbox (money, account, moderation, review, mission,
 *   support).
 *
 * Missing preference rows mean "everything on" — a brand-new member has never
 * opted out of anything. Failures are logged and swallowed: a broken push or
 * email provider must never fail the request that triggered the event.
 */

export type NotificationCategory =
  | "review"
  | "mission"
  | "community"
  | "money"
  | "account"
  | "moderation"
  | "support"
  | "social"
  | "system";

export interface NotifyOptions {
  /** Stable machine type stored on the notification row (e.g. `TOPUP_APPROVED`). */
  type: string;
  title: string;
  message: string;
  category: NotificationCategory;
  /** Optional JSON payload the UI can deep-link with. */
  data?: Record<string, unknown>;
  /** Deep link used by push and the email call-to-action. */
  url?: string;
  /**
   * Set to false when the caller already wrote the in-app row (typically
   * inside an atomic D1 batch) so the inbox does not get a duplicate.
   */
  inApp?: boolean;
  /** Override the email subject (defaults to `title`). */
  emailSubject?: string;
}

/** Which category preference (when present) switches an event off entirely. */
const CATEGORY_PREFERENCE: Record<
  NotificationCategory,
  "reviewRequests" | "missionReminders" | "communityUpdates" | null
> = {
  review: "reviewRequests",
  mission: "missionReminders",
  community: "communityUpdates",
  // Transactional categories are never gated by a category toggle: a member
  // who turned off mission reminders must still learn that their top-up was
  // rejected or their account suspended.
  money: null,
  account: null,
  moderation: null,
  support: null,
  social: null,
  system: null,
};

/** Categories whose events are important enough to also send an email. */
const EMAIL_CATEGORIES: ReadonlySet<NotificationCategory> = new Set([
  "money",
  "account",
  "moderation",
  "review",
  "mission",
  "support",
]);

interface Preferences {
  inApp: boolean;
  push: boolean;
  email: boolean;
  reviewRequests: boolean;
  missionReminders: boolean;
  communityUpdates: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  inApp: true,
  push: true,
  email: true,
  reviewRequests: true,
  missionReminders: true,
  communityUpdates: true,
};

function enabled(value: unknown, fallback: boolean): boolean {
  if (value === null || value === undefined) return fallback;
  return value !== 0 && value !== false;
}

async function loadPreferences(db: Database, userId: string): Promise<Preferences> {
  const row = await db.querySingle(
    `SELECT in_app_enabled, push_enabled, email_enabled,
            review_requests, mission_reminders, community_updates
       FROM notification_preferences WHERE user_id = ?`,
    [userId],
  );
  if (!row) return DEFAULT_PREFERENCES;
  return {
    inApp: enabled(row.in_app_enabled, true),
    push: enabled(row.push_enabled, true),
    email: enabled(row.email_enabled, true),
    reviewRequests: enabled(row.review_requests, true),
    missionReminders: enabled(row.mission_reminders, true),
    communityUpdates: enabled(row.community_updates, true),
  };
}

/**
 * Fan an event out to every channel the member still wants it on.
 *
 * Never throws — callers fire it right after the state change that caused it
 * and must not be rolled back by a broken notification provider.
 */
export async function notify(env: Env, userId: string, options: NotifyOptions): Promise<void> {
  try {
    const db = new Database(env);
    const prefs = await loadPreferences(db, userId);

    const categoryKey = CATEGORY_PREFERENCE[options.category];
    if (categoryKey && !prefs[categoryKey]) return;

    const now = db.now();
    if (options.inApp !== false && prefs.inApp) {
      await db.execute(
        `INSERT INTO notifications (id, user_id, type, title, message, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          db.uuid(),
          userId,
          options.type,
          options.title,
          options.message,
          options.data ? JSON.stringify(options.data) : null,
          now,
        ],
      );
    }

    if (prefs.push) {
      await notifyUserPush(env, userId, options.title, options.message);
    }

    if (prefs.email && EMAIL_CATEGORIES.has(options.category)) {
      const user = await db.querySingle("SELECT email FROM users WHERE id = ?", [userId]);
      if (user?.email) {
        await sendEmail(env, {
          to: user.email,
          subject: options.emailSubject ?? options.title,
          html: renderNotificationEmail({
            title: options.emailSubject ?? options.title,
            intro: options.message,
            ctaUrl: options.url,
            baseUrl: env.SITE_URL,
          }),
        });
      }
    }
  } catch (error) {
    createLogger(env).error("notify failed", error, {
      userId,
      type: options.type,
      category: options.category,
    });
  }
}

/**
 * Exactly-once welcome email.
 *
 * The claim is the write: only the caller whose conditional UPDATE flips
 * `welcome_sent_at` from NULL gets to send, so concurrent first logins and
 * replayed requests cannot double-send. Callers invoke this right after a row
 * is first created, so steady-state requests never pay for the extra write.
 */
export async function maybeSendWelcomeEmail(env: Env, userId: string): Promise<void> {
  try {
    const db = new Database(env);
    const claimed = await db.execute(
      "UPDATE users SET welcome_sent_at = ? WHERE id = ? AND welcome_sent_at IS NULL",
      [db.now(), userId],
    );
    if ((claimed.meta?.changes ?? 0) === 0) return;

    const user = await db.querySingle("SELECT email, display_name FROM users WHERE id = ?", [
      userId,
    ]);
    if (!user?.email) return;

    await sendEmail(env, {
      to: user.email,
      subject: "Welcome to LoopSquad — here's your first loop",
      html: renderWelcomeEmail(user.display_name, env.SITE_URL),
    });
  } catch (error) {
    createLogger(env).error("welcome email failed", error, { userId });
  }
}
