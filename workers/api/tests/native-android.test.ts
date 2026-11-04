import { describe, it, expect, vi, afterEach } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { mobileRoutes } from "../src/routes/mobile";
import { feedRoutes } from "../src/routes/feed";
import { discoverRoutes } from "../src/routes/discover";
import { searchRoutes } from "../src/routes/search";
import { reportRoutes } from "../src/routes/reports";
import { adminRoutes } from "../src/routes/admin";
import { watchRoutes } from "../src/routes/watch";
import { youtubeRoutes } from "../src/routes/youtube";
import { createTestEnv, jsonRequest, type TestEnv } from "./helpers/test-env";
import { encryptDeviceToken, decryptDeviceToken, notifyUserMobilePush } from "../src/lib/mobile-push";
import { creditCatalog } from "../src/services/play-billing";

const BASE = "https://api.test";
const route = (method: string, path: string) => mobileRoutes.find(r => r.method === method && r.path === path)!;
async function data(response: Response) { return (await response.json() as any).data; }
function post(path: string, uid: string, body: unknown) { return jsonRequest(BASE + path, uid, "POST", body); }
function billingEnv() {
  const env = createTestEnv();
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "play@test.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }), project_id: "test-project" });
  env.GOOGLE_PLAY_PACKAGE_NAME = "com.creatorloop.app";
  env.PLAY_CREDIT_PRODUCTS_JSON = JSON.stringify([{ productId: "credits_100", label: "Starter", credits: 100 }]);
  return env;
}
function mockPlay(userId: string, purchaseState = 0, consumptionState = 0) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); calls.push(url);
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "test-access", expires_in: 3600 });
    if (url.endsWith(":consume")) return new Response(null, { status: 204 });
    expect(url).toContain("/applications/com.creatorloop.app/purchases/products/credits_100/tokens/");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-access");
    return Response.json({ purchaseState, consumptionState, orderId: "GPA.1234", productId: "credits_100", obfuscatedExternalAccountId: userId });
  }));
  return calls;
}
function seedVideo(env: TestEnv, owner: string, title = "A useful creator video") {
  const id = crypto.randomUUID(), now = new Date().toISOString();
  env.sqlite.prepare(`INSERT INTO videos (id,user_id,youtube_video_id,youtube_url,title,status,created_at,updated_at)
    VALUES (?,?,?,?,?,'active',?,?)`).run(id, owner, "dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", title, now, now);
  return id;
}

afterEach(() => vi.unstubAllGlobals());

describe("native device lifecycle and consent", () => {
  it("encrypts FCM credentials at rest and transfers a device on account switch", async () => {
    const env = createTestEnv(); env.DEVICE_TOKEN_SECRET = "a-test-device-encryption-secret-32";
    env.FCM_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "a@b.test", private_key: "x", project_id: "test" });
    const a = env.seedUser("device-a"), b = env.seedUser("device-b");
    const body = { token: "fcm-token-that-is-long-enough-123456", installationId: crypto.randomUUID() };
    expect((await route("POST", "/api/v1/mobile/devices").handler(post("/api/v1/mobile/devices", "device-a", body), env)).status).toBe(200);
    await route("POST", "/api/v1/mobile/devices").handler(post("/api/v1/mobile/devices", "device-b", body), env);
    const rows = env.sqlite.prepare("SELECT * FROM mobile_devices").all() as any[];
    expect(rows).toHaveLength(1); expect(rows[0].user_id).toBe(b); expect(rows[0].encrypted_token).not.toContain(body.token);
    expect(await decryptDeviceToken(env, rows[0].encrypted_token)).toBe(body.token);
    const removed = await route("DELETE", "/api/v1/mobile/devices").handler(jsonRequest(BASE + "/api/v1/mobile/devices", "device-a", "DELETE", body), env);
    expect(removed.status).toBe(200); expect(env.sqlite.prepare("SELECT COUNT(*) c FROM mobile_devices").get()).toMatchObject({ c: 1 });
    await route("DELETE", "/api/v1/mobile/devices").handler(jsonRequest(BASE + "/api/v1/mobile/devices", "device-b", "DELETE", body), env);
    expect(a).toBeTruthy();
  });
  it("rejects incomplete consent and records a policy version idempotently", async () => {
    const env = createTestEnv(); env.seedUser("consent");
    const handler = route("POST", "/api/v1/mobile/consent").handler;
    expect((await handler(post("/api/v1/mobile/consent", "consent", { policyVersion: "2026-11-03", termsAccepted: true }), env)).status).toBe(400);
    const body = { policyVersion: "2026-11-03", termsAccepted: true, privacyAccepted: true, ageConfirmed: true };
    await handler(post("/api/v1/mobile/consent", "consent", body), env);
    await handler(post("/api/v1/mobile/consent", "consent", body), env);
    expect(env.sqlite.prepare("SELECT COUNT(*) c FROM consent_records").get()).toMatchObject({ c: 1 });
  });
  it("FCM is data-only and quiet hours suppress delivery", async () => {
    const env = createTestEnv(); env.DEVICE_TOKEN_SECRET = "a-test-device-encryption-secret-32";
    env.FCM_SERVICE_ACCOUNT_JSON = billingEnv().GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    const user = env.seedUser("push");
    env.sqlite.prepare(`INSERT INTO mobile_devices (id,user_id,installation_id,token_hash,encrypted_token,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)`).run(crypto.randomUUID(), user, crypto.randomUUID(), "hash", await encryptDeviceToken(env, "device-token"), new Date().toISOString(), new Date().toISOString());
    const fetchMock = vi.fn(async (url: any) => String(url).includes("oauth2") ? Response.json({ access_token: "x", expires_in: 3600 }) : Response.json({ name: "message-id" }));
    vi.stubGlobal("fetch", fetchMock);
    await notifyUserMobilePush(env, user, "Hello", "A review is ready", { type: "REVIEW", url: "/reviews" });
    const send = fetchMock.mock.calls.find(c => String(c[0]).includes("messages:send")) as any[];
    const payload = JSON.parse(send[1].body); expect(payload.message.data.title).toBe("Hello"); expect(payload.message.notification).toBeUndefined();
    const hour = new Date().getUTCHours();
    env.sqlite.prepare("INSERT INTO notification_preferences (id,user_id,push_enabled,quiet_hours_start,quiet_hours_end) VALUES (?,?,1,?,?)").run(crypto.randomUUID(), user, hour, (hour + 1) % 24);
    const count = fetchMock.mock.calls.length;
    await notifyUserMobilePush(env, user, "Quiet", "Not sent"); expect(fetchMock.mock.calls.length).toBe(count);
  });
});

describe("bidirectional blocking", () => {
  it("removes blocked creators from queue, discovery and search without leaking them", async () => {
    const env = createTestEnv(); const viewer = env.seedUser("viewer"), creator = env.seedUser("creator"); seedVideo(env, creator);
    env.sqlite.prepare("INSERT INTO creator_profiles (id,user_id,public_profile,looking_for) VALUES (?,?,1,'collaboration')").run(crypto.randomUUID(), creator);
    env.sqlite.prepare("INSERT INTO communities (id,name,slug,invite_code,owner_id,is_public,created_at,updated_at) VALUES (?,'Private squad','private-squad','ABCD1234',?,1,?,?)").run(crypto.randomUUID(), creator, new Date().toISOString(), new Date().toISOString());
    await route("POST", "/api/v1/users/me/blocks").handler(post("/api/v1/users/me/blocks", "viewer", { userId: creator }), env);
    const queue = await data(await feedRoutes.find(r => r.path === "/api/v1/queue")!.handler(new Request(BASE + "/api/v1/queue", { headers: { Authorization: `Bearer ${Buffer.from(JSON.stringify({ uid: "viewer" })).toString("base64url")}` } }), env));
    expect(queue.items).toHaveLength(0); expect(queue.total).toBe(0);
    const collaborators = await data(await discoverRoutes[0].handler(new Request(BASE + "/api/v1/discover/collaborators", { headers: { Authorization: `Bearer ${Buffer.from(JSON.stringify({ uid: "viewer" })).toString("base64url")}` } }), env));
    expect(collaborators.items).toHaveLength(0);
    const search = await data(await searchRoutes[0].handler(new Request(BASE + "/api/v1/search?q=creator", { headers: { Authorization: `Bearer ${Buffer.from(JSON.stringify({ uid: "viewer" })).toString("base64url")}` } }), env));
    expect(search.videos).toHaveLength(0); expect(search.communities).toHaveLength(0);
    const reverse = await data(await feedRoutes.find(r => r.path === "/api/v1/queue")!.handler(new Request(BASE + "/api/v1/queue", { headers: { Authorization: `Bearer ${Buffer.from(JSON.stringify({ uid: "creator" })).toString("base64url")}` } }), env));
    expect(reverse.items).toHaveLength(0); expect(viewer).toBeTruthy();
  });
});

describe("Play Billing verification", () => {
  it("does not expose an unconfigured catalog or invent prices", async () => {
    const env = createTestEnv(); env.seedUser("bill");
    expect(creditCatalog(env)).toEqual([]);
    const result = await data(await route("GET", "/api/v1/billing/products").handler(new Request(BASE + "/api/v1/billing/products", { headers: { Authorization: `Bearer ${Buffer.from(JSON.stringify({ uid: "bill" })).toString("base64url")}` } }), env));
    expect(result).toEqual({ enabled: false, products: [] }); expect(JSON.stringify(result)).not.toContain("price");
  });
  it("grants once, binds the account, consumes, and safely replays a lost response", async () => {
    const env = billingEnv(); const user = env.seedUser("buyer"); env.seedUser("other"); mockPlay(user);
    const body = { productId: "credits_100", purchaseToken: "purchase-token-1234567890" };
    const first = await data(await route("POST", "/api/v1/billing/verify").handler(post("/api/v1/billing/verify", "buyer", body), env));
    const replay = await data(await route("POST", "/api/v1/billing/verify").handler(post("/api/v1/billing/verify", "buyer", body), env));
    expect(first).toMatchObject({ credits: 100, balance: 100, alreadyGranted: false, consumed: true });
    expect(replay).toMatchObject({ balance: 100, alreadyGranted: true });
    expect(env.sqlite.prepare("SELECT balance FROM credit_accounts WHERE user_id = ?").get(user)).toMatchObject({ balance: 100 });
    expect(env.sqlite.prepare("SELECT COUNT(*) c FROM credit_transactions WHERE type = 'bonus' AND reference_id LIKE 'play:%'").get()).toMatchObject({ c: 1 });
    expect(JSON.stringify(env.sqlite.prepare("SELECT * FROM play_purchases").all())).not.toContain(body.purchaseToken);
    const stolen = await route("POST", "/api/v1/billing/verify").handler(post("/api/v1/billing/verify", "other", body), env);
    expect(stolen.status).toBe(403);
  });
  it("never grants a pending purchase", async () => {
    const env = billingEnv(); const user = env.seedUser("pending"); mockPlay(user, 1);
    const response = await route("POST", "/api/v1/billing/verify").handler(post("/api/v1/billing/verify", "pending", { productId: "credits_100", purchaseToken: "pending-token-123456" }), env);
    expect(response.status).toBe(409); expect(env.sqlite.prepare("SELECT COUNT(*) c FROM play_purchases").get()).toMatchObject({ c: 0 });
  });
});

describe("mobile-era integrity and safety regressions", () => {
  it("serialises concurrent watch claims so a retry cannot double-pay", async () => {
    const env = createTestEnv(); env.WATCH_SESSIONS_ENABLED = "true"; env.WATCH_SESSION_SECRET = "test-secret"; env.EVIDENCE_POLICY = "verified_only";
    const watcher = env.seedUser("watcher"), owner = env.seedUser("owner");
    env.sqlite.prepare(`INSERT INTO videos (id,user_id,youtube_video_id,youtube_url,title,duration_seconds,status,created_at,updated_at)
      VALUES (?,?,?,?,?,300,'active',?,?)`).run("video-lock", owner, "dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "Short", new Date().toISOString(), new Date().toISOString());
    const issued = await data(await watchRoutes.find(r => r.path === "/api/v1/watch/start")!.handler(post("/api/v1/watch/start", "watcher", { videoId: "video-lock" }), env));
    const session = env.sqlite.prepare("SELECT id FROM watch_session_tokens WHERE token = ?").get(issued.sessionToken) as any;
    env.sqlite.prepare("INSERT INTO watch_heartbeats (id,session_token_id,player_time,received_at,delta_seconds,accepted) VALUES (?,?,200,?,200,1)").run(crypto.randomUUID(), session.id, Math.floor(Date.now() / 1000));
    const claim = watchRoutes.find(r => r.path === "/api/v1/watch")!;
    const responses = await Promise.all([1,2].map(() => claim.handler(post("/api/v1/watch", "watcher", { videoId: "video-lock", watchSeconds: 200, sessionToken: issued.sessionToken }), env)));
    expect(responses.map(r => r.status).sort()).toEqual([200,409]);
    expect(env.sqlite.prepare("SELECT credits_awarded FROM watch_sessions WHERE watcher_id = ?").get(watcher)).toMatchObject({ credits_awarded: Number(env.WATCH_REWARD_CREDITS) });
    expect(env.sqlite.prepare("SELECT COUNT(*) c FROM mobile_operation_locks").get()).toMatchObject({ c: 0 });
  });
  it("a report is not a penalty until a moderator resolves it, once", async () => {
    const env = createTestEnv(); env.seedUser("reporter"); const target = env.seedUser("target"); const admin = env.seedUser("admin"); env.makeAdmin(admin);
    const filed = await data(await reportRoutes.find(r => r.path === "/api/v1/reports" && r.method === "POST")!.handler(post("/api/v1/reports", "reporter", { resourceType: "user", resourceId: target, reportedUserId: target, reason: "harassment" }), env));
    expect(env.sqlite.prepare("SELECT COUNT(*) c FROM reputation_events").get()).toMatchObject({ c: 0 });
    const resolve = adminRoutes.find(r => r.pattern?.includes("/admin/reports/"))!;
    const path = `/api/v1/admin/reports/${filed.reportId}/resolve`;
    expect((await resolve.handler(post(path, "admin", { status: "resolved", resolutionNotes: "Reviewed evidence" }), env)).status).toBe(200);
    expect((await resolve.handler(post(path, "admin", { status: "resolved" }), env)).status).toBe(409);
    expect(env.sqlite.prepare("SELECT COUNT(*) c FROM reputation_events WHERE user_id = ?").get(target)).toMatchObject({ c: 1 });
  });
  it("native OAuth returns only a result and consumes state before redirecting", async () => {
    const env = createTestEnv(); env.seedUser("oauth"); env.YOUTUBE_OAUTH_CLIENT_ID = "client"; env.YOUTUBE_OAUTH_CLIENT_SECRET = "secret"; env.YOUTUBE_OAUTH_REDIRECT_URI = "https://api.test/api/v1/youtube/oauth/callback";
    const start = await data(await youtubeRoutes.find(r => r.path === "/api/v1/youtube/oauth/authorize")!.handler(new Request(BASE + "/api/v1/youtube/oauth/authorize?client=android", { headers: { Authorization: `Bearer ${Buffer.from(JSON.stringify({ uid: "oauth" })).toString("base64url")}` } }), env));
    const state = new URL(start.authUrl).searchParams.get("state");
    const callback = youtubeRoutes.find(r => r.path === "/api/v1/youtube/oauth/callback" && r.method === "GET")!;
    const response = await callback.handler(new Request(BASE + `/api/v1/youtube/oauth/callback?state=${state}&error=access_denied`), env);
    expect(response.status).toBe(302); expect(response.headers.get("Location")).toBe("creatorloop://youtube?result=cancelled");
    const replay = await callback.handler(new Request(BASE + `/api/v1/youtube/oauth/callback?state=${state}&code=forged`), env);
    expect(replay.headers.get("Location")).toContain("expired");
  });
});
