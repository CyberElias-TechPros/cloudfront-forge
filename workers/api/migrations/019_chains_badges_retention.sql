-- Mission chains: 3-step storylines per niche
ALTER TABLE missions ADD COLUMN chain_id TEXT;
ALTER TABLE missions ADD COLUMN chain_step INTEGER;

-- Badge definitions for automated awarding
INSERT INTO badges (id, name, description, icon_url, criteria_type, criteria_value, xp_reward, credit_reward)
VALUES
  ('review-streak-10', 'Consistent Reviewer', 'Complete 10 reviews in a row without skipping', NULL, 'review_streak', '10', 50, 20),
  ('review-streak-50', 'Review Veteran', 'Complete 50 reviews', NULL, 'review_count', '50', 200, 100),
  ('supporter-1', 'Supporter', 'Make your first credit purchase', NULL, 'credit_purchase', '1', 25, 10);

-- Cohort retention: track signup dates and week 1/week 4 activity
CREATE TABLE IF NOT EXISTS cohort_retention (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  signup_date TEXT NOT NULL,
  week1_active INTEGER DEFAULT 0,
  week4_active INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
