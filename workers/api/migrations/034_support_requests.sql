-- Member support requests.
--
-- The app had no way for a member to ask the team for help (lost top-up,
-- wrong reward, account problem). Requests land in the admin console and can
-- optionally be emailed to the operator when RESEND_API_KEY is configured.
CREATE TABLE IF NOT EXISTS support_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    topic TEXT NOT NULL CHECK(topic IN ('account', 'credits', 'community', 'video', 'moderation', 'bug', 'other')),
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolved_by TEXT REFERENCES users(id),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests(status);
CREATE INDEX IF NOT EXISTS idx_support_requests_user ON support_requests(user_id);
