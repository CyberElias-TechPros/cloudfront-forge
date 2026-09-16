import { describe, it, expect } from "vitest";
import { videoRoutes } from "../src/routes/videos";
import { createTestEnv, jsonRequest } from "./helpers/test-env";

const BASE = "https://api.test";

const archiveRoute = videoRoutes.find(
  (r) => "pattern" in r && r.method === "POST" && (r.pattern ?? "").includes("archive"),
)!;

function seedVideo(env: TestEnv2, userId: string, id = "video-ar", status = "active") {
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      "INSERT INTO videos (id, user_id, youtube_url, title, status, created_at, updated_at) VALUES (?, ?, 'https://youtu.be/ar', 'Vid', ?, ?, ?)",
    )
    .run(id, userId, status, now, now);
  return id;
}

type TestEnv2 = ReturnType<typeof createTestEnv>;

describe("video archive", () => {
  it("owner archives an active video (conditional update)", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-var");
    seedVideo(env, owner);

    const response = await archiveRoute.handler(
      jsonRequest(`${BASE}/api/v1/videos/video-ar/archive`, "owner-var", "POST", {}),
      env,
    );
    expect(response.status).toBe(200);
    const row = env.sqlite.prepare("SELECT status FROM videos WHERE id = 'video-ar'").get() as any;
    expect(row.status).toBe("archived");

    // Archiving again is a conflict, not a silent success.
    const again = await archiveRoute.handler(
      jsonRequest(`${BASE}/api/v1/videos/video-ar/archive`, "owner-var", "POST", {}),
      env,
    );
    expect(again.status).toBe(409);
  });

  it("nobody archives someone else's video", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-var2");
    const stranger = env.seedUser("stranger-var2");
    void stranger;
    seedVideo(env, owner);

    const response = await archiveRoute.handler(
      jsonRequest(`${BASE}/api/v1/videos/video-ar/archive`, "stranger-var2", "POST", {}),
      env,
    );
    expect(response.status).toBe(403);
    const row = env.sqlite.prepare("SELECT status FROM videos WHERE id = 'video-ar'").get() as any;
    expect(row.status).toBe("active");
  });

  it("completed videos cannot be archived", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-var3");
    seedVideo(env, owner, "video-done", "completed");

    const response = await archiveRoute.handler(
      jsonRequest(`${BASE}/api/v1/videos/video-done/archive`, "owner-var3", "POST", {}),
      env,
    );
    expect(response.status).toBe(409);
  });
});
