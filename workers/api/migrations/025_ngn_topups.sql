-- NGN top-up requests (naira point purchases).
-- Users buy credits by bank transfer to the payout account and submit the
-- transfer reference; an admin approves (credits are issued) or rejects.
CREATE TABLE IF NOT EXISTS topup_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    tier_id TEXT NOT NULL,
    ngn_amount INTEGER NOT NULL,
    credits_amount INTEGER NOT NULL,
    transfer_reference TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) NOT NULL DEFAULT 'pending',
    reject_reason TEXT,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_topup_requests_user_id ON topup_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_topup_requests_status ON topup_requests(status);

-- A transfer reference can have at most one PENDING request at a time, so
-- resubmitting a reference is rejected clearly instead of stacking up.
CREATE UNIQUE INDEX IF NOT EXISTS uq_topup_requests_pending_reference
    ON topup_requests(transfer_reference) WHERE status = 'pending';
