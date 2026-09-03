-- Audit trail for privileged and money-moving actions.
--
-- 001_initial_schema.sql created `audit_logs`, but 005_drop_unused_tables.sql
-- removed it while nothing wrote to it. Admin actions (report resolution,
-- appeal review, NGN top-up approval/rejection, mission authoring) now write
-- here, so the table is reintroduced — without a foreign key to users(id),
-- because D1 does not persist PRAGMA foreign_keys and an unenforced FK only
-- risks insert failures.
--
-- Purely additive: creates one new table plus its indexes.
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    metadata TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
