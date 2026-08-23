-- Add updated_at to tables that the job sweeps write to
ALTER TABLE mission_assignments ADD COLUMN updated_at DATETIME;
UPDATE mission_assignments SET updated_at = completed_at WHERE updated_at IS NULL;

ALTER TABLE reviews ADD COLUMN updated_at DATETIME;
UPDATE reviews SET updated_at = completed_at WHERE updated_at IS NULL;
