import { describe, it, expect } from "vitest";
import { recoverOverdueReviews, sweepOverdueReviews } from "../src/jobs/sweeps";
import { Database } from "../src/lib/database";
import { createTestEnv, type TestEnv } from "./helpers/test-env";

function seedWorld(env: TestEnv, { members }: { members: number }) {
  const now = new Date().toISOString();
  const owner = env.seedUser("owner-rr");
  env.sqlite
    .prepare(
      "INSERT INTO communities (id, name, slug, invite_code, is_public, owner_id, created_at, updated_at) VALUES ('c-rr', 'Squad', 'slug-rr', 'CODE-RR', 1, ?, ?, ?)",
    )
    .run(owner, now, now);
  env.sqlite
    .prepare(
      "INSERT INTO community_members (id, community_id, user_id, role, joined_at, status) VALUES (?, 'c-rr', ?, 'owner', ?, 'active')",
    )
    .run(crypto.randomUUID(), owner, now);

  const ids: string[] = [owner];
  for (let i = 1; i < members; i++) {
    const uid = env.seedUser(`member-rr-${i}`);
    env.sqlite
      .prepare(
        "INSERT INTO community_members (id, community_id, user_id, role, joined_at, status) VALUES (?, 'c-rr', ?, 'member', ?, 'active')",
      )
      .run(crypto.randomUUID(), uid, now);
    ids.push(uid);
  }

  env.sqlite
    .prepare(
      "INSERT INTO videos (id, user_id, community_id, youtube_url, title, status, created_at, updated_at) VALUES ('v-rr', ?, 'c-rr', 'https://youtu.be/rr', 'Vid', 'active', ?, ?)",
    )
    .run(owner, now, now);
  return ids;
}

function seedOverdueReview(env: TestEnv, reviewerId: string, submitterId: string, notified = false) {
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      "INSERT INTO reviews (id, video_id, reviewer_id, submitter_id, status, assigned_at, overdue_notified, created_at, updated_at) VALUES ('review-rr', 'v-rr', ?, ?, 'overdue', datetime('now', '-3 days'), ?, ?, ?)",
    )
    .run(reviewerId, submitterId, notified ? 1 : 0, now, now);
}

describe("overdue review marking", () => {
  it("marks assigned reviews overdue after the 48h SLA", async () => {
    const env = createTestEnv();
    const ids = seedWorld(env, { members: 2 });
    const now = new Date().toISOString();
    env.sqlite
      .prepare(
        "INSERT INTO reviews (id, video_id, reviewer_id, submitter_id, status, assigned_at, created_at) VALUES ('review-late', 'v-rr', ?, ?, 'assigned', datetime('now', '-3 days'), ?)",
      )
      .run(ids[1], ids[0], now);

    const db = new Database(env);
    const marked = await sweepOverdueReviews(db);
    expect(marked).toBe(1);
    const row = env.sqlite.prepare("SELECT status FROM reviews WHERE id = 'review-late'").get() as any;
    expect(row.status).toBe("overdue");
  });
});

describe("overdue review recovery", () => {
  it("notifies once, then reassigns to another member on the next run", async () => {
    const env = createTestEnv();
    const ids = seedWorld(env, { members: 3 });
    seedOverdueReview(env, ids[1], ids[0], false);

    // First run: notification only.
    const first = await recoverOverdueReviews(env);
    expect(first).toBe(1);

    const lateReviewerNotified = env.sqlite
      .prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND type = 'REVIEW_OVERDUE'")
      .get(ids[1]) as any;
    expect(lateReviewerNotified.c).toBe(1);
    const submitterNotified = env.sqlite
      .prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND type = 'REVIEW_OVERDUE'")
      .get(ids[0]) as any;
    expect(submitterNotified.c).toBe(1);

    const stillOverdue = env.sqlite
      .prepare("SELECT reviewer_id, overdue_notified FROM reviews WHERE id = 'review-rr'")
      .get() as any;
    expect(stillOverdue.reviewer_id).toBe(ids[1]);
    expect(stillOverdue.overdue_notified).toBe(1);

    // Second run: reassignment.
    const second = await recoverOverdueReviews(env);
    expect(second).toBe(1);

    const reassigned = env.sqlite
      .prepare("SELECT reviewer_id, status FROM reviews WHERE id = 'review-rr'")
      .get() as any;
    expect(reassigned.status).toBe("assigned");
    expect(reassigned.reviewer_id).not.toBe(ids[1]);
    expect(reassigned.reviewer_id).not.toBe(ids[0]);

    const newReviewerNotified = env.sqlite
      .prepare(
        "SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND type = 'REVIEW_ASSIGNED'",
      )
      .get(reassigned.reviewer_id) as any;
    expect(newReviewerNotified.c).toBe(1);
  });

  it("keeps the review overdue when nobody else can take it", async () => {
    const env = createTestEnv();
    const ids = seedWorld(env, { members: 1 });
    seedOverdueReview(env, ids[0], ids[0], true);

    const processed = await recoverOverdueReviews(env);
    expect(processed).toBe(0);

    const row = env.sqlite
      .prepare("SELECT reviewer_id, status FROM reviews WHERE id = 'review-rr'")
      .get() as any;
    expect(row.status).toBe("overdue");
    expect(row.reviewer_id).toBe(ids[0]);
  });

  it("does nothing when no reviews are overdue", async () => {
    const env = createTestEnv();
    seedWorld(env, { members: 2 });
    const processed = await recoverOverdueReviews(env);
    expect(processed).toBe(0);
  });
});
