-- Account moderation status.
--
-- `active` is the only state that may use the API. `suspended` is reversible
-- (an admin reinstates the member); `banned` is the terminal moderation state.
-- Deletion stays soft through the pre-existing `users.deleted_at` column.
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
