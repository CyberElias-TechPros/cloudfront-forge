-- Attention checks: challenges issued mid-watch to verify active viewing
CREATE TABLE IF NOT EXISTS attention_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'passed', 'failed')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_attention_user_video ON attention_challenges(user_id, video_id);
