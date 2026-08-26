-- Add updated_at to tables that the job sweeps write to.
-- Note: `reviews.updated_at` already exists in 001_initial_schema.sql, so it is
-- deliberately NOT re-added here (re-adding broke fresh database setups with
-- SQLITE_ERROR "duplicate column name: updated_at").
ALTER TABLE mission_assignments ADD COLUMN updated_at DATETIME;
UPDATE mission_assignments SET updated_at = completed_at WHERE updated_at IS NULL;
