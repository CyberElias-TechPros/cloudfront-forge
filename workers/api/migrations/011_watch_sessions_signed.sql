-- Signed watch sessions: HMAC tokens + heartbeat log for server-side verification
CREATE TABLE IF NOT EXISTS watch_session_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  start_ts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_watch_tokens_user_video ON watch_session_tokens(user_id, video_id);

CREATE TABLE IF NOT EXISTS watch_heartbeats (
  id TEXT PRIMARY KEY,
  session_token_id TEXT NOT NULL REFERENCES watch_session_tokens(id),
  player_time REAL NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_watch_heartbeats_session ON watch_heartbeats(session_token_id);
