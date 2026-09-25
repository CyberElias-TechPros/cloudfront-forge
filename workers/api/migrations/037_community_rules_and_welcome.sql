-- Community rules + welcome-email bookkeeping.
--
-- 1. `communities.rules` closes the "per-community custom rules — coming soon"
--    promise on the rules page: owners write their squad's rules, members see
--    them on the community page, and the platform defaults remain the fallback.
-- 2. `users.welcome_sent_at` makes the welcome email exactly-once: the claim
--    is a conditional `UPDATE ... WHERE welcome_sent_at IS NULL`, so two
--    concurrent first logins can never both send.
ALTER TABLE communities ADD COLUMN rules TEXT;

ALTER TABLE users ADD COLUMN welcome_sent_at DATETIME;

-- One preferences row per member. The PUT handler is check-then-insert, so
-- without this index two concurrent preference saves could leave duplicate
-- rows and every preference read would arbitrarily take the first one.
DELETE FROM notification_preferences
 WHERE rowid NOT IN (
   SELECT MIN(rowid) FROM notification_preferences GROUP BY user_id
 );

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_preferences_user_id
  ON notification_preferences(user_id);
