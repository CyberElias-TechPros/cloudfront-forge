-- Remove orphaned schema that is never referenced by any route, service, or migration.
-- (pods/pod_members, challenges/challenge_entries/challenge_votes, audit_logs)
DROP TABLE IF EXISTS challenge_votes;
DROP TABLE IF EXISTS challenge_entries;
DROP TABLE IF EXISTS challenges;
DROP TABLE IF EXISTS pod_members;
DROP TABLE IF EXISTS pods;
DROP TABLE IF EXISTS audit_logs;
