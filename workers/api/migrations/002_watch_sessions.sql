-- Watch sessions: record verified watches and proof (subscribe/comment) per video per watcher
CREATE TABLE IF NOT EXISTS watch_sessions (
    id TEXT PRIMARY KEY,
    video_id TEXT REFERENCES videos(id),
    watcher_id TEXT REFERENCES users(id),
    watch_seconds INTEGER DEFAULT 0,
    status TEXT DEFAULT 'started',
    subscribed INTEGER DEFAULT 0,
    commented INTEGER DEFAULT 0,
    xp_awarded INTEGER DEFAULT 0,
    credits_awarded INTEGER DEFAULT 0,
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(video_id, watcher_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_sessions_video ON watch_sessions(video_id);
CREATE INDEX IF NOT EXISTS idx_watch_sessions_watcher ON watch_sessions(watcher_id);
