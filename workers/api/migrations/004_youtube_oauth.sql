-- YouTube OAuth tokens for subscription and watch-time verification
CREATE TABLE IF NOT EXISTS youtube_oauth_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at DATETIME NOT NULL,
    scope TEXT,
    channel_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS youtube_oauth_states (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    state TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_youtube_oauth_tokens_user_id ON youtube_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_youtube_oauth_states_state ON youtube_oauth_states(state);
