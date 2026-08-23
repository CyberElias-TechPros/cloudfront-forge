-- OAuth state expiry as epoch INTEGER (replaces broken ISO-vs-SQLite-datetime string compare)
ALTER TABLE youtube_oauth_states ADD COLUMN expires_at INTEGER;
UPDATE youtube_oauth_states SET expires_at = CAST(strftime('%s', created_at) AS INTEGER) + 600 WHERE expires_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_youtube_oauth_states_expires ON youtube_oauth_states(expires_at);
