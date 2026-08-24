-- Appeal flow for reports
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
