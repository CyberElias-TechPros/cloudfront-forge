/**
 * Idempotent writes (PLAT-010).
 *
 * The case that matters is a mobile client that never saw the response: it
 * retries the same request and must get the same answer without a second write.
 */
import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { beginIdempotentRequest, pruneIdempotencyKeys } from "../src/middleware/idempotency";
import { createTestEnv, authRequest } from "./helpers/test-env";

const BASE = "https://api.test";
const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

function giveCredits(env: ReturnType<typeof createTestEnv>, userId: string, balance: number) {
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      "INSERT INTO credit_accounts (id, user_id, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = ?",
    )
    .run(crypto.randomUUID(), userId, balance, now, now, balance);
}

function balanceOf(env: ReturnType<typeof createTestEnv>, userId: string): number {
  const row = env.sqlite
    .prepare("SELECT balance FROM credit_accounts WHERE user_id = ?")
    .get(userId) as { balance: number } | undefined;
  return row?.balance ?? 0;
}

function purchase(env: ReturnType<typeof createTestEnv>, uid: string, key?: string) {
  const request = authRequest(`${BASE}/api/v1/shop/purchase`, uid, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify({ itemType: "streak_freeze" }),
  });
  return worker.fetch(request, env, ctx);
}

/** A JSON request that carries an idempotency key (and a unique body when asked). */
function keyedRequest(uid: string, key: string, body: unknown = { a: 1 }) {
  return authRequest(`${BASE}/api/v1/watch`, uid, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}

function purchasedCount(env: ReturnType<typeof createTestEnv>, userId: string): number {
  const row = env.sqlite
    .prepare("SELECT COUNT(*) as n FROM credit_transactions WHERE user_id = ? AND amount < 0")
    .get(userId) as { n: number } | undefined;
  return row?.n ?? 0;
}

describe("idempotent writes", () => {
  it("replays the first outcome instead of spending twice", async () => {
    const env = createTestEnv();
    const internalId = env.seedUser("idem-member");
    giveCredits(env, internalId, 100);

    const first = await purchase(env, "idem-member", "key-repeat-0001");
    const second = await purchase(env, "idem-member", "key-repeat-0001");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers.get("Idempotent-Replay")).toBe("true");
    expect(await second.json()).toEqual(await first.json());
    expect(balanceOf(env, internalId)).toBe(70); // charged once
    expect(purchasedCount(env, internalId)).toBe(1);
  });

  it("behaves exactly as before without the header (retries do repeat)", async () => {
    const env = createTestEnv();
    const internalId = env.seedUser("idem-member-2");
    giveCredits(env, internalId, 100);

    await purchase(env, "idem-member-2");
    await purchase(env, "idem-member-2");

    expect(balanceOf(env, internalId)).toBe(40);
    expect(purchasedCount(env, internalId)).toBe(2);
  });

  it("refuses to replay for a different body", async () => {
    const env = createTestEnv();
    const internalId = env.seedUser("idem-member-3");
    giveCredits(env, internalId, 100);

    const first = await purchase(env, "idem-member-3", "key-repeat-shared");
    expect(first.status).toBe(200);

    // Same key, different payload: silently replaying would perform the wrong
    // action, so this must be a distinguishable conflict.
    const other = await worker.fetch(
      authRequest(`${BASE}/api/v1/shop/purchase`, "idem-member-3", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "key-repeat-shared" },
        body: JSON.stringify({ itemType: "boost", videoId: "some-video" }),
      }),
      env,
      ctx,
    );
    expect(other.status).toBe(409);
    const payload = (await other.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(balanceOf(env, internalId)).toBe(70);
  });

  it("scopes keys per member, so two members may use the same key", async () => {
    const env = createTestEnv();
    const a = env.seedUser("idem-a");
    const b = env.seedUser("idem-b");
    giveCredits(env, a, 100);
    giveCredits(env, b, 100);

    expect((await purchase(env, "idem-a", "shared-client-key")).status).toBe(200);
    const second = await purchase(env, "idem-b", "shared-client-key");
    expect(second.status).toBe(200);
    expect(second.headers.get("Idempotent-Replay")).toBeNull();
    expect(balanceOf(env, a)).toBe(70);
    expect(balanceOf(env, b)).toBe(70);
  });

  it("does not cache failures, so a corrected retry works", async () => {
    const env = createTestEnv();
    const internalId = env.seedUser("idem-broke");

    const failed = await purchase(env, "idem-broke", "key-broke-0001");
    expect(failed.status).toBe(400);

    giveCredits(env, internalId, 100);
    const retried = await purchase(env, "idem-broke", "key-broke-0001");
    expect(retried.status).toBe(200);
    expect(retried.headers.get("Idempotent-Replay")).toBeNull();
    expect(balanceOf(env, internalId)).toBe(70);
  });

  it("rejects a malformed key before doing any work", async () => {
    const env = createTestEnv();
    const internalId = env.seedUser("idem-bad-key");
    giveCredits(env, internalId, 100);

    const response = await purchase(env, "idem-bad-key", "short");
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(balanceOf(env, internalId)).toBe(100);
  });

  it("treats an expired key as unused", async () => {
    const env = createTestEnv();
    const userId = env.seedUser("idem-expired");
    const request = keyedRequest("idem-expired", "key-expiry-0001");

    const idem = await beginIdempotentRequest(request, env, { userId, scope: "test.scope" });
    expect(idem.key).toBeTruthy();
    await idem.finish(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(env.sqlite.prepare("SELECT COUNT(*) as n FROM idempotency_keys").get()).toEqual({
      n: 1,
    });

    // Move the row into the past: the key must be usable again, not stuck.
    env.sqlite
      .prepare("UPDATE idempotency_keys SET expires_at = ?")
      .run(new Date(Date.now() - 60_000).toISOString());

    const second = await beginIdempotentRequest(request, env, { userId, scope: "test.scope" });
    expect(second.replay).toBeUndefined();
  });

  it("stores only successful responses", async () => {
    const env = createTestEnv();
    const userId = env.seedUser("idem-status");
    const request = keyedRequest("idem-status", "key-status-0001");

    const idem = await beginIdempotentRequest(request, env, { userId, scope: "test.status" });
    await idem.finish(new Response("{}", { status: 500 }));
    await idem.finish(new Response("{}", { status: 400 }));
    expect(env.sqlite.prepare("SELECT COUNT(*) as n FROM idempotency_keys").get()).toEqual({
      n: 0,
    });

    await idem.finish(
      new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    expect(env.sqlite.prepare("SELECT COUNT(*) as n FROM idempotency_keys").get()).toEqual({
      n: 1,
    });
  });

  it("prunes expired keys without touching live ones", async () => {
    const env = createTestEnv();
    const userId = env.seedUser("idem-prune");
    const request = keyedRequest("idem-prune", "key-prune-0001");
    const idem = await beginIdempotentRequest(request, env, { userId, scope: "test.prune" });
    await idem.finish(
      new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    expect(await pruneIdempotencyKeys(env)).toBe(0);
    env.sqlite
      .prepare("UPDATE idempotency_keys SET expires_at = ?")
      .run(new Date(Date.now() - 1000).toISOString());
    expect(await pruneIdempotencyKeys(env)).toBe(1);
  });

  it("documents the header and the conflict on the four money/content writes", async () => {
    const { endpoints } = await import("../src/contract/registry");
    const scoped = endpoints.filter((endpoint) =>
      endpoint.headers?.some((header) => header.name === "Idempotency-Key"),
    );
    expect(scoped.map((endpoint) => endpoint.operationId).sort()).toEqual([
      "claimWatch",
      "purchaseShopItem",
      "requestTopup",
      "submitVideo",
    ]);
    for (const endpoint of scoped) {
      expect(endpoint.errors).toContain("IDEMPOTENCY_CONFLICT");
    }
  });
});
