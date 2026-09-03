import { describe, it, expect } from "vitest";
import { shopRoutes } from "../src/routes/shop";
import { createTestEnv, authRequest, jsonRequest } from "./helpers/test-env";

const BASE = "https://api.test";
const catalog = shopRoutes.find((r) => r.path === "/api/v1/shop" && r.method === "GET")!;
const purchase = shopRoutes.find((r) => r.path === "/api/v1/shop/purchase")!;

async function data(response: Response) {
  return ((await response.json()) as { data: any; error?: { code: string } });
}

function giveCredits(env: ReturnType<typeof createTestEnv>, userId: string, balance: number) {
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      "INSERT INTO credit_accounts (id, user_id, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = ?",
    )
    .run(crypto.randomUUID(), userId, balance, now, now, balance);
}

function seedVideo(env: ReturnType<typeof createTestEnv>, ownerId: string, id: string, status = "active") {
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      "INSERT INTO videos (id, user_id, youtube_video_id, youtube_url, title, status, created_at, updated_at) VALUES (?, ?, ?, 'https://youtu.be/xxxxxxxxxxx', 'V', ?, ?, ?)",
    )
    .run(id, ownerId, id, status, now, now);
}

function balanceOf(env: ReturnType<typeof createTestEnv>, userId: string): number {
  const row = env.sqlite
    .prepare("SELECT balance FROM credit_accounts WHERE user_id = ?")
    .get(userId) as { balance: number } | undefined;
  return row?.balance ?? 0;
}

describe("shop catalog", () => {
  it("requires authentication", async () => {
    const env = createTestEnv();
    const response = await catalog.handler(new Request(`${BASE}/api/v1/shop`), env);
    expect(response.status).toBe(401);
  });

  it("lists the two credit sinks with their prices", async () => {
    const env = createTestEnv();
    const uid = "shopper-uid";
    env.seedUser(uid);
    const body = await data(await catalog.handler(authRequest(`${BASE}/api/v1/shop`, uid), env));
    expect(body.data.items.map((i: { id: string; cost: number }) => [i.id, i.cost])).toEqual([
      ["boost", 50],
      ["streak_freeze", 30],
    ]);
  });
});

describe("purchases", () => {
  it("charges the balance and boosts the video", async () => {
    const env = createTestEnv();
    const uid = "shopper-uid-1";
    const user = env.seedUser(uid);
    giveCredits(env, user, 100);
    seedVideo(env, user, "video-1");

    const response = await purchase.handler(
      jsonRequest(`${BASE}/api/v1/shop/purchase`, uid, "POST", {
        itemType: "boost",
        videoId: "video-1",
      }),
      env,
    );
    expect(response.status).toBe(200);
    const body = await data(response);
    expect(body.data.cost).toBe(50);
    expect(body.data.balance).toBe(50);
    expect(balanceOf(env, user)).toBe(50);

    const video = env.sqlite.prepare("SELECT boosted_until FROM videos WHERE id = ?").get("video-1") as {
      boosted_until: string;
    };
    expect(Date.parse(video.boosted_until)).toBeGreaterThan(Date.now());

    const txn = env.sqlite
      .prepare("SELECT amount, balance_after FROM credit_transactions WHERE user_id = ?")
      .get(user) as { amount: number; balance_after: number };
    expect(txn.amount).toBe(-50);
    expect(txn.balance_after).toBe(50);

    const purchaseRow = env.sqlite
      .prepare("SELECT item_type, item_ref, cost_credits FROM credit_purchases WHERE user_id = ?")
      .get(user) as { item_type: string; item_ref: string; cost_credits: number };
    expect(purchaseRow).toEqual({ item_type: "boost", item_ref: "video-1", cost_credits: 50 });
  });

  it("refuses to charge for boosting a video the member does not own", async () => {
    const env = createTestEnv();
    const uid = "shopper-uid-2";
    const user = env.seedUser(uid);
    const other = env.seedUser("other-uid-2");
    giveCredits(env, user, 100);
    seedVideo(env, other, "video-2");

    const response = await purchase.handler(
      jsonRequest(`${BASE}/api/v1/shop/purchase`, uid, "POST", {
        itemType: "boost",
        videoId: "video-2",
      }),
      env,
    );
    expect(response.status).toBe(404);
    expect(balanceOf(env, user)).toBe(100); // untouched
    const txns = env.sqlite.prepare("SELECT COUNT(*) AS c FROM credit_transactions").get() as {
      c: number;
    };
    expect(txns.c).toBe(0);
  });

  it("refuses to boost an archived video", async () => {
    const env = createTestEnv();
    const uid = "shopper-uid-3";
    const user = env.seedUser(uid);
    giveCredits(env, user, 100);
    seedVideo(env, user, "video-3", "archived");

    const response = await purchase.handler(
      jsonRequest(`${BASE}/api/v1/shop/purchase`, uid, "POST", {
        itemType: "boost",
        videoId: "video-3",
      }),
      env,
    );
    expect(response.status).toBe(404);
    expect(balanceOf(env, user)).toBe(100);
  });

  it("refuses a purchase the balance cannot cover", async () => {
    const env = createTestEnv();
    const uid = "shopper-uid-4";
    const user = env.seedUser(uid);
    giveCredits(env, user, 10);
    seedVideo(env, user, "video-4");

    const response = await purchase.handler(
      jsonRequest(`${BASE}/api/v1/shop/purchase`, uid, "POST", {
        itemType: "boost",
        videoId: "video-4",
      }),
      env,
    );
    expect(response.status).toBe(400);
    expect((await data(response)).error?.code).toBe("INSUFFICIENT_CREDITS");
    expect(balanceOf(env, user)).toBe(10);
  });

  it("credits a streak freeze even for a member with no streak row", async () => {
    const env = createTestEnv();
    const uid = "shopper-uid-5";
    const user = env.seedUser(uid);
    giveCredits(env, user, 40);

    const response = await purchase.handler(
      jsonRequest(`${BASE}/api/v1/shop/purchase`, uid, "POST", { itemType: "streak_freeze" }),
      env,
    );
    expect(response.status).toBe(200);
    expect(balanceOf(env, user)).toBe(10);

    const streak = env.sqlite
      .prepare("SELECT streak_freezes FROM streaks WHERE user_id = ? AND streak_type = 'daily_login'")
      .get(user) as { streak_freezes: number };
    expect(streak.streak_freezes).toBe(1);
  });

  it("rejects an unknown item", async () => {
    const env = createTestEnv();
    const uid = "shopper-uid-6";
    env.seedUser(uid);
    const response = await purchase.handler(
      jsonRequest(`${BASE}/api/v1/shop/purchase`, uid, "POST", { itemType: "unlimited_power" }),
      env,
    );
    expect(response.status).toBe(400);
  });
});
