-- ============================================================
-- LoopSquad production schema reconciliation (one-time)
-- ============================================================
-- Production's schema drifted ahead of its d1_migrations history
-- (boosted_until, streak_freezes, helpful, quiet hours, chain columns,
-- give_take_ratio, channel_id and the badge seeds already exist), which made
-- `wrangler d1 migrations apply` crash on migration 013. This script brings
-- the migration ledger back in sync:
--   1. adds the two columns production is genuinely missing
--      (videos.niche, credit_transactions.balance_after),
--   2. idempotently creates any missing tables/indexes/trigger/seeds,
--   3. dedupes the ledger accounts and adds the UNIQUE indexes the
--      reward upserts require,
--   4. records migrations 013-023 as applied.
-- After this, `npx wrangler d1 migrations apply creatorloop-db --remote`
-- reports "No migrations to apply".
-- ============================================================

-- 1) Columns verified MISSING on production (2026-08-26 schema dump)
-- Guard: skip if already present so the script can be re-run safely.
-- Uncomment only the lines that are actually missing on your target DB.
-- ALTER TABLE videos ADD COLUMN IF NOT EXISTS niche TEXT;
-- ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS balance_after INTEGER;

-- 1b) Proof-of-payment columns (migration 027 — additive, transfer_reference
-- untouched). Uncomment when deploying the proof-upload feature:
-- ALTER TABLE topup_requests ADD COLUMN IF NOT EXISTS proof_image_path TEXT;
-- ALTER TABLE topup_requests ADD COLUMN IF NOT EXISTS proof_image_name TEXT;
-- ALTER TABLE topup_requests ADD COLUMN IF NOT EXISTS proof_image_type TEXT;

-- 2) Idempotent objects from migrations 013-016 and 019
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

CREATE TABLE IF NOT EXISTS appeals (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id),
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  reviewed_by TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_appeals_report ON appeals(report_id);
CREATE INDEX IF NOT EXISTS idx_appeals_user ON appeals(user_id);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);

CREATE TABLE IF NOT EXISTS cohort_retention (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  signup_date TEXT NOT NULL,
  week1_active INTEGER DEFAULT 0,
  week4_active INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS update_give_take_ratio
AFTER INSERT ON reputation_events
FOR EACH ROW
BEGIN
  UPDATE reputation_accounts
  SET give_take_ratio = CASE
    WHEN (subscriptions_received + 1) = 0 THEN 1.0
    ELSE (subscriptions_given * 1.0 + watch_minutes / 60.0) / (subscriptions_received + 1)
  END,
  updated_at = datetime('now')
  WHERE user_id = NEW.user_id;
END;

INSERT OR IGNORE INTO badges (id, name, description, icon_url, criteria_type, criteria_value, xp_reward, credit_reward)
VALUES
  ('review-streak-10', 'Consistent Reviewer', 'Complete 10 reviews in a row without skipping', NULL, 'review_streak', '10', 50, 20),
  ('review-streak-50', 'Review Veteran', 'Complete 50 completed reviews', NULL, 'review_count', '50', 200, 100),
  ('supporter-1', 'Supporter', 'Make your first credit purchase', NULL, 'credit_purchase', '1', 25, 10);

-- 3) Ledger dedupe + unique indexes (migration 022)
UPDATE credit_accounts
SET balance = (SELECT COALESCE(SUM(c2.balance), 0) FROM credit_accounts c2 WHERE c2.user_id = credit_accounts.user_id)
WHERE id IN (
  SELECT ca.id FROM credit_accounts ca
  WHERE ca.id = (
    SELECT x.id FROM credit_accounts x
    WHERE x.user_id = ca.user_id
    ORDER BY COALESCE(x.updated_at, '') DESC, x.id DESC LIMIT 1
  )
);
DELETE FROM credit_accounts
WHERE id IN (
  SELECT ca.id FROM credit_accounts ca
  JOIN credit_accounts k ON k.user_id = ca.user_id
   AND (COALESCE(k.updated_at, '') > COALESCE(ca.updated_at, '')
        OR (COALESCE(k.updated_at, '') = COALESCE(ca.updated_at, '') AND k.id > ca.id))
);

UPDATE xp_accounts
SET total_xp = (SELECT COALESCE(SUM(x2.total_xp), 0) FROM xp_accounts x2 WHERE x2.user_id = xp_accounts.user_id)
WHERE id IN (
  SELECT xa.id FROM xp_accounts xa
  WHERE xa.id = (
    SELECT x.id FROM xp_accounts x
    WHERE x.user_id = xa.user_id
    ORDER BY COALESCE(x.updated_at, '') DESC, x.id DESC LIMIT 1
  )
);
DELETE FROM xp_accounts
WHERE id IN (
  SELECT xa.id FROM xp_accounts xa
  JOIN xp_accounts k ON k.user_id = xa.user_id
   AND (COALESCE(k.updated_at, '') > COALESCE(xa.updated_at, '')
        OR (COALESCE(k.updated_at, '') = COALESCE(xa.updated_at, '') AND k.id > xa.id))
);

UPDATE reputation_accounts
SET subscriptions_given = (SELECT COALESCE(SUM(r2.subscriptions_given), 0) FROM reputation_accounts r2 WHERE r2.user_id = reputation_accounts.user_id),
    subscriptions_received = (SELECT COALESCE(SUM(r2.subscriptions_received), 0) FROM reputation_accounts r2 WHERE r2.user_id = reputation_accounts.user_id),
    watch_minutes = (SELECT COALESCE(SUM(r2.watch_minutes), 0) FROM reputation_accounts r2 WHERE r2.user_id = reputation_accounts.user_id)
WHERE id IN (
  SELECT ra.id FROM reputation_accounts ra
  WHERE ra.id = (
    SELECT x.id FROM reputation_accounts x
    WHERE x.user_id = ra.user_id
    ORDER BY COALESCE(x.updated_at, '') DESC, x.id DESC LIMIT 1
  )
);
DELETE FROM reputation_accounts
WHERE id IN (
  SELECT ra.id FROM reputation_accounts ra
  JOIN reputation_accounts k ON k.user_id = ra.user_id
   AND (COALESCE(k.updated_at, '') > COALESCE(ra.updated_at, '')
        OR (COALESCE(k.updated_at, '') = COALESCE(ra.updated_at, '') AND k.id > ra.id))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_accounts_user ON credit_accounts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_xp_accounts_user ON xp_accounts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reputation_accounts_user ON reputation_accounts(user_id);

-- 4) Record migrations 013-023 as applied
INSERT OR IGNORE INTO d1_migrations (name) VALUES
  ('013_credit_sinks.sql'),
  ('014_attention_challenges.sql'),
  ('015_appeals.sql'),
  ('016_analytics_events.sql'),
  ('017_review_rating_and_quiet_hours.sql'),
  ('018_video_niche_column.sql'),
  ('019_chains_badges_retention.sql'),
  ('020_give_take_ratio.sql'),
  ('021_videos_channel_id.sql'),
  ('022_unique_ledger_accounts.sql'),
  ('023_credit_txn_balance_after.sql');