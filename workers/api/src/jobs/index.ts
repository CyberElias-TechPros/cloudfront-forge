import { Database } from "../lib/database";
import type { Env } from "../types";
import { createLogger } from "../lib/logger";
import { sweepOverdueMissions, sweepOverdueReviews, sweepStreakReset } from "./sweeps";
import { sendWeeklyDigests } from "./digest";
import { sweepAnomalyScoring } from "./anomaly";
import { sweepBadgeAwards } from "./badges";

export type JobFn = (db: Database) => Promise<number>;

interface JobDef {
  name: string;
  run: JobFn;
}

const JOBS: JobDef[] = [
  { name: "overdue-missions", run: sweepOverdueMissions },
  { name: "overdue-reviews", run: sweepOverdueReviews },
  { name: "streak-reset", run: sweepStreakReset },
  { name: "anomaly-scoring", run: sweepAnomalyScoring },
  { name: "badge-awards", run: sweepBadgeAwards },
];

async function logRun(
  db: Database,
  jobName: string,
  fn: () => Promise<number>,
): Promise<{ job: string; processed: number; ok: boolean }> {
  const id = crypto.randomUUID();
  const started = Math.floor(Date.now() / 1000);
  try {
    const processed = await fn();
    const finished = Math.floor(Date.now() / 1000);
    await db.execute(
      "INSERT INTO job_runs (id, job_name, started_at, finished_at, status, processed_rows) VALUES (?,?,?,?,?,?)",
      [id, jobName, started, finished, "completed", processed],
    );
    return { job: jobName, processed, ok: true };
  } catch (err) {
    const finished = Math.floor(Date.now() / 1000);
    const message = err instanceof Error ? err.message : String(err);
    await db.execute(
      "INSERT INTO job_runs (id, job_name, started_at, finished_at, status, error_message) VALUES (?,?,?,?,?,?)",
      [id, jobName, started, finished, "failed", message],
    );
    return { job: jobName, processed: 0, ok: false };
  }
}

export async function runAllJobs(env: Env): Promise<void> {
  const logger = createLogger(env);
  const db = new Database(env);
  logger.info("cron sweep starting");

  const results = await Promise.all(
    JOBS.map((j) => logRun(db, j.name, () => j.run(db))),
  );
  for (const r of results) {
    logger.info(`sweep ${r.job}: ${r.ok ? "ok" : "FAIL"} (${r.processed} rows)`);
  }

  // Weekly digest every Sunday
  const dow = new Date().getUTCDay();
  if (dow === 0) {
    const sent = await logRun(db, "weekly-digest", () => sendWeeklyDigests(env));
    logger.info(`sweep weekly-digest: ${sent.ok ? "ok" : "FAIL"} (${sent.processed} emails)`);
  }

  logger.info("cron sweep finished");
}
