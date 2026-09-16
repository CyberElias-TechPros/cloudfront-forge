-- Community lifecycle.
--
-- Owners archive a community instead of hard-deleting it: videos, reviews and
-- ledger history stay intact for audits, while the community disappears from
-- every list, queue and search result.
ALTER TABLE communities ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_communities_status ON communities(status);
