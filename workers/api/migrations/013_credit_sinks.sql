-- Credit sinks: video boosts + streak freezes
ALTER TABLE videos ADD COLUMN boosted_until TEXT;

ALTER TABLE streaks ADD COLUMN streak_freezes INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS credit_purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('boost', 'streak_freeze')),
  item_ref TEXT,
  cost_credits INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_user ON credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_boosted ON videos(boosted_until);
