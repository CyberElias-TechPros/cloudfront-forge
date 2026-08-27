-- Rebuild topup_requests (empty table — zero data risk).
--
-- 025 created the table with CREATE TABLE IF NOT EXISTS plus a partial
-- unique index. Recreate it from scratch so the definition and uniqueness
-- indexes are applied cleanly on production. Same columns the worker already
-- reads/writes, so this is backward-compatible: apply DB first, worker second.
--
-- Differences vs 025 (all compatible with the current worker):
--   * no REFERENCES users(id) — D1 does not persist PRAGMA foreign_keys, and
--     an FK here only risks insert failures if it is ever enforced
--   * unique pending-user index so the one-pending-per-user 409 is atomic,
--     matching the unique pending-reference index from 025

DROP TABLE IF EXISTS topup_requests;

CREATE TABLE topup_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tier_id TEXT NOT NULL,
    ngn_amount INTEGER NOT NULL,
    credits_amount INTEGER NOT NULL,
    transfer_reference TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    reject_reason TEXT,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME
);

CREATE INDEX idx_topup_requests_user_id ON topup_requests(user_id);
CREATE INDEX idx_topup_requests_status ON topup_requests(status);

-- A transfer reference can have at most one PENDING request at a time, so
-- resubmitting a reference is rejected clearly instead of stacking up.
CREATE UNIQUE INDEX uq_topup_requests_pending_reference
    ON topup_requests(transfer_reference) WHERE status = 'pending';

-- One pending request per user (the worker already 409s this in application
-- code; the index makes the race atomic).
CREATE UNIQUE INDEX uq_topup_requests_pending_user
    ON topup_requests(user_id) WHERE status = 'pending';
