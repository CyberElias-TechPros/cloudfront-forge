-- Job execution log (one row per sweep run; supports cursor tracking)
CREATE TABLE IF NOT EXISTS job_runs (
  id TEXT PRIMARY KEY,
  job_name TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT DEFAULT 'running' CHECK(status IN ('running','completed','failed')),
  processed_rows INTEGER DEFAULT 0,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_job_runs_name_started ON job_runs(job_name, started_at DESC);
