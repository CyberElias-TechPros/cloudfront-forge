import { describe, it, expect } from "vitest";
import { videoRoutes, reviewRoutes } from "../src/routes/videos";
import { createTestEnv, authRequest, jsonRequest } from "./helpers/test-env";

const BASE = "https://api.test";
const submit = videoRoutes.find((r) => r.path === "/api/v1/videos" && r.method === "POST")!;
const list = videoRoutes.find((r) => r.path === "/api/v1/videos" && r.method === "GET")!;
const complete = reviewRoutes.find(
  (r) => "pattern" in r && (r.pattern ?? "").includes("complete"),
)!;

async function data(response: Response) {
  return ((await response.json()) as { data: any }).data;
}

const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

function seedVideo(env: ReturnType<typeof createTestEnv>, ownerId: string, id = "video-1") {
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      `INSERT INTO videos (id, user_id, youtube_video_id, youtube_url, title, thumbnail_url, status, watch_target, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'A video', '', 'active', 60, ?, ?)`,
    )
    .run(id, ownerId, id, YOUTUBE_URL, now, now);
  return id;
}

function seedReview(
  env: ReturnType<typeof createTestEnv>,
  videoId: string,
  reviewerId: string,
  submitterId: string,
  id = "review-1",
) {
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      `INSERT INTO reviews (id, video_id, reviewer_id, submitter_id, status, assigned_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'assigned', ?, ?, ?)`,
    )
    .run(id, videoId, reviewerId, submitterId, now, now, now);
  return id;
}

describe("video submission", () => {
  it("rejects non-YouTube links", async () => {
    const env = createTestEnv();
    const uid = "submitter-uid";
    env.seedUser(uid);
    const response = await submit.handler(
      jsonRequest(`${BASE}/api/v1/videos`, uid, "POST", {
        youtubeUrl: "https://vimeo.com/12345",
        title: "Not a youtube video",
      }),
      env,
    );
    expect(response.status).toBe(400);
    const stored = env.sqlite.prepare("SELECT COUNT(*) AS c FROM videos").get() as { c: number };
    expect(stored.c).toBe(0);
  });

  it("accepts a YouTube link, storing the extracted id and a canonical thumbnail", async () => {
    const env = createTestEnv();
    const uid = "submitter-uid-2";
    const user = env.seedUser(uid);
    const response = await submit.handler(
      jsonRequest(`${BASE}/api/v1/videos`, uid, "POST", {
        youtubeUrl: YOUTUBE_URL,
        title: "My first upload",
      }),
      env,
    );
    expect(response.status).toBe(200);
    const created = await data(response);
    expect(created.videoId).toBeTruthy();
    // Offline fallback (no YOUTUBE_API_KEY in the test env), but it must be
    // the canonical thumbnail for the extracted id.
    expect(created.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");

    const stored = env.sqlite.prepare("SELECT * FROM videos WHERE id = ?").get(created.videoId) as
      | Record<string, unknown>
      | undefined;
    expect(stored?.user_id).toBe(user);
    expect(stored?.youtube_video_id).toBe("dQw4w9WgXcQ");
    expect(stored?.thumbnail_url).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
  });

  it("refuses a second active submission of the same video", async () => {
    const env = createTestEnv();
    const uid = "submitter-uid-3";
    env.seedUser(uid);
    const first = await submit.handler(
      jsonRequest(`${BASE}/api/v1/videos`, uid, "POST", {
        youtubeUrl: YOUTUBE_URL,
        title: "Original",
      }),
      env,
    );
    expect(first.status).toBe(200);

    const second = await submit.handler(
      jsonRequest(`${BASE}/api/v1/videos`, uid, "POST", {
        youtubeUrl: "https://youtu.be/dQw4w9WgXcQ?t=30",
        title: "Duplicate via short URL",
      }),
      env,
    );
    expect(second.status).toBe(409);
  });

  it("enforces one submission per member per 24 hours", async () => {
    const env = createTestEnv();
    const uid = "submitter-uid-4";
    env.seedUser(uid);
    await submit.handler(
      jsonRequest(`${BASE}/api/v1/videos`, uid, "POST", {
        youtubeUrl: YOUTUBE_URL,
        title: "First today",
      }),
      env,
    );
    const second = await submit.handler(
      jsonRequest(`${BASE}/api/v1/videos`, uid, "POST", {
        youtubeUrl: "https://www.youtube.com/watch?v=oHg5SJYRHA0",
        title: "Too soon",
      }),
      env,
    );
    expect(second.status).toBe(429);
  });

  it("requires authentication", async () => {
    const env = createTestEnv();
    const response = await submit.handler(
      new Request(`${BASE}/api/v1/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: YOUTUBE_URL, title: "Anon" }),
      }),
      env,
    );
    expect(response.status).toBe(401);
  });

  it("lists only the caller's videos", async () => {
    const env = createTestEnv();
    const me = env.seedUser("me-uid");
    const other = env.seedUser("other-uid");
    seedVideo(env, me, "video-mine");
    seedVideo(env, other, "video-theirs");

    const feed = await data(await list.handler(authRequest(`${BASE}/api/v1/videos`, "me-uid"), env));
    const ids = feed.items.map((v: { id: string }) => v.id);
    expect(ids).toEqual(["video-mine"]);
    expect(feed.total).toBe(1);
  });
});

describe("review completion", () => {
  it("pays the reviewer once and records the score", async () => {
    const env = createTestEnv();
    const reviewerUid = "reviewer-uid";
    const reviewer = env.seedUser(reviewerUid);
    const submitter = env.seedUser("submitter-uid");
    const videoId = seedVideo(env, submitter);
    const reviewId = seedReview(env, videoId, reviewer, submitter);

    const first = await complete.handler(
      jsonRequest(`${BASE}/api/v1/reviews/${reviewId}/complete`, reviewerUid, "POST", {
        score: 4,
        feedbackText: "Nice pacing",
        answers: [{ questionId: "q1", ratingValue: 5 }],
      }),
      env,
    );
    expect(first.status).toBe(200);
    const body = await data(first);
    expect(body.xpEarned).toBe(20);
    expect(body.creditsEarned).toBe(5);

    const review = env.sqlite.prepare("SELECT * FROM reviews WHERE id = ?").get(reviewId) as {
      status: string;
      score: number | null;
      feedback_text: string | null;
    };
    expect(review.status).toBe("completed");
    // Score comes from the validated answer average when answers are given.
    expect(review.score).toBe(5);
    expect(review.feedback_text).toBe("Nice pacing");

    const xp = env.sqlite
      .prepare("SELECT SUM(amount) AS total FROM xp_transactions WHERE user_id = ?")
      .get(reviewer) as { total: number };
    expect(xp.total).toBe(20);
  });

  it("stores answers for real questions and ignores unknown ones", async () => {
    const env = createTestEnv();
    const reviewerUid = "reviewer-uid-5";
    const reviewer = env.seedUser(reviewerUid);
    const submitter = env.seedUser("submitter-uid-5");
    const videoId = seedVideo(env, submitter);
    const reviewId = seedReview(env, videoId, reviewer, submitter, "review-5");
    const questionId = crypto.randomUUID();
    env.sqlite
      .prepare(
        "INSERT INTO review_questions (id, question_text, question_type, created_at) VALUES (?, 'Was the pacing good?', 'rating', ?)",
      )
      .run(questionId, new Date().toISOString());

    const response = await complete.handler(
      jsonRequest(`${BASE}/api/v1/reviews/${reviewId}/complete`, reviewerUid, "POST", {
        answers: [
          { questionId, ratingValue: 4, textAnswer: "yes" },
          { questionId: "question-that-does-not-exist", ratingValue: 1 },
        ],
      }),
      env,
    );
    expect(response.status).toBe(200);

    const stored = env.sqlite
      .prepare("SELECT * FROM review_answers WHERE review_id = ?")
      .all("review-5") as Record<string, unknown>[];
    expect(stored.length).toBe(1);
    expect(stored[0].question_id).toBe(questionId);
    expect(stored[0].rating_value).toBe(4);
    expect(stored[0].text_answer).toBe("yes");
  });

  it("does not pay again for an already completed review", async () => {
    const env = createTestEnv();
    const reviewerUid = "reviewer-uid-2";
    const reviewer = env.seedUser(reviewerUid);
    const submitter = env.seedUser("submitter-uid-2");
    const videoId = seedVideo(env, submitter);
    const reviewId = seedReview(env, videoId, reviewer, submitter);

    await complete.handler(
      jsonRequest(`${BASE}/api/v1/reviews/${reviewId}/complete`, reviewerUid, "POST", {
        score: 3,
      }),
      env,
    );
    const second = await complete.handler(
      jsonRequest(`${BASE}/api/v1/reviews/${reviewId}/complete`, reviewerUid, "POST", {
        score: 3,
      }),
      env,
    );
    expect(second.status).toBe(200);
    const body = await data(second);
    expect(body.xpEarned).toBe(0);
    expect(body.creditsEarned).toBe(0);
  });

  it("hides other members' reviews", async () => {
    const env = createTestEnv();
    const reviewer = env.seedUser("reviewer-uid-3");
    const intruderUid = "intruder-uid";
    env.seedUser(intruderUid);
    const submitter = env.seedUser("submitter-uid-3");
    const videoId = seedVideo(env, submitter);
    const reviewId = seedReview(env, videoId, reviewer, submitter);

    const response = await complete.handler(
      jsonRequest(`${BASE}/api/v1/reviews/${reviewId}/complete`, intruderUid, "POST", {
        score: 1,
      }),
      env,
    );
    expect(response.status).toBe(404);
    const review = env.sqlite.prepare("SELECT status FROM reviews WHERE id = ?").get(reviewId) as {
      status: string;
    };
    expect(review.status).toBe("assigned");
  });

  it("validates the score range", async () => {
    const env = createTestEnv();
    const reviewerUid = "reviewer-uid-4";
    const reviewer = env.seedUser(reviewerUid);
    const submitter = env.seedUser("submitter-uid-4");
    const videoId = seedVideo(env, submitter);
    const reviewId = seedReview(env, videoId, reviewer, submitter);

    const response = await complete.handler(
      jsonRequest(`${BASE}/api/v1/reviews/${reviewId}/complete`, reviewerUid, "POST", {
        score: 99,
      }),
      env,
    );
    expect(response.status).toBe(400);
  });
});
