-- 038: Watch-evidence integrity.
--
-- Signed watch sessions existed since 011 but could not influence a payout:
-- heartbeats were written and never read, and `POST /watch` paid on the
-- client's self-reported seconds. This migration adds the columns the
-- server-side verifier needs to turn a heartbeat stream into verified watch
-- seconds (SEC-011/SEC-012) and records which evidence level each claim used
-- (SEC-010) so integrity can be measured.

-- Each heartbeat is scored when it arrives: `delta_seconds` is the amount of
-- *accepted* player time it represents, and `accepted` says whether the sample
-- survived slope/rewind/gap checks.
ALTER TABLE watch_heartbeats ADD COLUMN delta_seconds REAL NOT NULL DEFAULT 0;
ALTER TABLE watch_heartbeats ADD COLUMN accepted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE watch_heartbeats ADD COLUMN reject_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_watch_heartbeats_accepted
  ON watch_heartbeats(session_token_id, accepted);

-- Verdict of the evidence policy for each claim. `evidence_level` is one of
-- youtube_api | signed_session | self_report | none.
ALTER TABLE watch_sessions ADD COLUMN evidence_level TEXT;
ALTER TABLE watch_sessions ADD COLUMN verified_seconds REAL NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_watch_sessions_evidence
  ON watch_sessions(evidence_level, updated_at);
