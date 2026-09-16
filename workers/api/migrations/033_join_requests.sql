-- Join requests for public communities with owner approval enabled.
--
-- Invite-code joins stay immediate (the code is the owner's explicit consent);
-- `require_approval` gates members who discover a public community and ask to
-- join without a code. At most one pending request per member per community,
-- enforced by the partial unique index below.
CREATE TABLE IF NOT EXISTS join_requests (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL REFERENCES communities(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled')),
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    reviewed_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_join_requests_community ON join_requests(community_id, status);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON join_requests(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_join_requests_pending
    ON join_requests(community_id, user_id) WHERE status = 'pending';
