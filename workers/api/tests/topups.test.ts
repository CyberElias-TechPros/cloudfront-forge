import { describe, it, expect } from "vitest";
import { topupRoutes, TOPUP_TIERS } from "../src/routes/topups";
import { createTestEnv, authRequest, jsonRequest, formRequest, type TestEnv } from "./helpers/test-env";

const BASE = "https://api.test";
const catalog = topupRoutes.find((r) => r.path === "/api/v1/topups" && r.method === "GET")!;
const uploadProof = topupRoutes.find((r) => r.path === "/api/v1/topups/proof")!;
const createTopup = topupRoutes.find((r) => r.path === "/api/v1/topups" && r.method === "POST")!;
const mine = topupRoutes.find((r) => r.path === "/api/v1/topups/mine")!;
const adminProof = topupRoutes.find((r) => "pattern" in r && (r.pattern ?? "").includes("proof"))!;

async function data(response: Response) {
  return ((await response.json()) as { data: any }).data;
}

function proofForm(type: string, name: string, bytes: Uint8Array): FormData {
  const form = new FormData();
  form.set("image", new File([bytes as BlobPart], name, { type }));
  return form;
}

function authedForm(path: string, uid: string, form: FormData): Request {
  return formRequest(`${BASE}${path}`, uid, form);
}

describe("top-up catalog", () => {
  it("publishes the naira packs and payout account", async () => {
    const env = createTestEnv();
    const uid = "buyer-uid";
    env.seedUser(uid);
    const body = await data(await catalog.handler(authRequest(`${BASE}/api/v1/topups`, uid), env));
    expect(body.tiers).toEqual(TOPUP_TIERS);
    expect(body.bank.accountNumber).toMatch(/^\d{10}$/);
    expect(body.pending).toBe(false);
  });

  it("flags an existing pending request", async () => {
    const env = createTestEnv();
    const uid = "buyer-uid-2";
    const user = env.seedUser(uid);
    env.sqlite
      .prepare(
        "INSERT INTO topup_requests (id, user_id, tier_id, ngn_amount, credits_amount, transfer_reference, status, created_at) VALUES (?, ?, 'starter', 1000, 20, 'REF-A', 'pending', ?)",
      )
      .run(crypto.randomUUID(), user, new Date().toISOString());
    const body = await data(await catalog.handler(authRequest(`${BASE}/api/v1/topups`, uid), env));
    expect(body.pending).toBe(true);
  });
});

describe("top-up requests", () => {
  it("prices from the server-side tier, never from the request body", async () => {
    const env = createTestEnv();
    const uid = "buyer-uid-3";
    const user = env.seedUser(uid);

    const response = await createTopup.handler(
      jsonRequest(`${BASE}/api/v1/topups`, uid, "POST", {
        tierId: "creator",
        transferReference: "REF-2024-001",
        // A hostile client trying to buy 100000 credits for ₦1.
        ngnAmount: 1,
        creditsAmount: 100000,
      }),
      env,
    );
    expect(response.status).toBe(201);

    const row = env.sqlite
      .prepare("SELECT * FROM topup_requests WHERE user_id = ?")
      .get(user) as Record<string, unknown>;
    const tier = TOPUP_TIERS.find((t) => t.id === "creator")!;
    expect(row.ngn_amount).toBe(tier.ngn);
    expect(row.credits_amount).toBe(tier.credits);
    expect(row.status).toBe("pending");
  });

  it("rejects an unknown pack", async () => {
    const env = createTestEnv();
    const uid = "buyer-uid-4";
    env.seedUser(uid);
    const response = await createTopup.handler(
      jsonRequest(`${BASE}/api/v1/topups`, uid, "POST", {
        tierId: "unlimited",
        transferReference: "REF-2024-002",
      }),
      env,
    );
    expect(response.status).toBe(400);
  });

  it("requires either a receipt or a transfer reference", async () => {
    const env = createTestEnv();
    const uid = "buyer-uid-5";
    env.seedUser(uid);
    const response = await createTopup.handler(
      jsonRequest(`${BASE}/api/v1/topups`, uid, "POST", { tierId: "starter" }),
      env,
    );
    expect(response.status).toBe(400);
  });

  it("rejects a malformed transfer reference", async () => {
    const env = createTestEnv();
    const uid = "buyer-uid-6";
    env.seedUser(uid);
    const response = await createTopup.handler(
      jsonRequest(`${BASE}/api/v1/topups`, uid, "POST", {
        tierId: "starter",
        transferReference: "REF <script>alert(1)</script>",
      }),
      env,
    );
    expect(response.status).toBe(400);
  });

  it("allows only one pending request per member", async () => {
    const env = createTestEnv();
    const uid = "buyer-uid-7";
    env.seedUser(uid);
    const first = await createTopup.handler(
      jsonRequest(`${BASE}/api/v1/topups`, uid, "POST", {
        tierId: "starter",
        transferReference: "REF-ONE",
      }),
      env,
    );
    expect(first.status).toBe(201);

    const second = await createTopup.handler(
      jsonRequest(`${BASE}/api/v1/topups`, uid, "POST", {
        tierId: "starter",
        transferReference: "REF-TWO",
      }),
      env,
    );
    expect(second.status).toBe(409);
  });

  it("reuses a reference only after the previous request is settled", async () => {
    const env = createTestEnv();
    const firstUid = "buyer-uid-8";
    const secondUid = "buyer-uid-9";
    env.seedUser(firstUid);
    env.seedUser(secondUid);

    await createTopup.handler(
      jsonRequest(`${BASE}/api/v1/topups`, firstUid, "POST", {
        tierId: "starter",
        transferReference: "SHARED-REF",
      }),
      env,
    );
    const duplicate = await createTopup.handler(
      jsonRequest(`${BASE}/api/v1/topups`, secondUid, "POST", {
        tierId: "starter",
        transferReference: "SHARED-REF",
      }),
      env,
    );
    // The unique pending-reference index must surface as a clean 409, not a
    // 500 caused by an unhandled constraint error.
    expect(duplicate.status).toBe(409);

    // Once the first request is approved the reference is free again.
    env.sqlite
      .prepare("UPDATE topup_requests SET status = 'approved'")
      .run();
    const reuse = await createTopup.handler(
      jsonRequest(`${BASE}/api/v1/topups`, secondUid, "POST", {
        tierId: "starter",
        transferReference: "SHARED-REF",
      }),
      env,
    );
    expect(reuse.status).toBe(201);
  });

  it("lists only the caller's requests", async () => {
    const env = createTestEnv();
    const uid = "buyer-uid-10";
    const user = env.seedUser(uid);
    const other = env.seedUser("buyer-uid-11");
    const now = new Date().toISOString();
    // Only one *pending* request per member is allowed, so the history mixes
    // statuses the way production would.
    const insert = env.sqlite.prepare(
      "INSERT INTO topup_requests (id, user_id, tier_id, ngn_amount, credits_amount, transfer_reference, status, created_at) VALUES (?, ?, 'starter', 1000, 20, ?, ?, ?)",
    );
    insert.run(crypto.randomUUID(), user, "MINE-1", "pending", now);
    insert.run(crypto.randomUUID(), user, "MINE-2", "approved", now);
    insert.run(crypto.randomUUID(), other, "THEIRS-1", "pending", now);

    const body = await data(await mine.handler(authRequest(`${BASE}/api/v1/topups/mine`, uid), env));
    expect(body.items).toHaveLength(2);
    expect(body.items.every((r: { transferReference: string }) => r.transferReference.startsWith("MINE"))).toBe(true);
  });
});

describe("proof upload", () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it("stores a JPEG/PNG/WebP receipt in R2 under the member's prefix", async () => {
    const env = createTestEnv();
    const uid = "uploader-uid";
    const user = env.seedUser(uid);

    const response = await uploadProof.handler(
      authedForm("/api/v1/topups/proof", uid, proofForm("image/png", "receipt.png", PNG)),
      env,
    );
    expect(response.status).toBe(201);
    const body = await data(response);
    expect(body.path).toMatch(/^topup-proofs\//);
    expect(body.path).toContain(user);
    expect(body.type).toBe("image/png");

    const stored = await env.ASSETS_BUCKET.get(body.path);
    expect(stored).toBeTruthy();
    expect(stored?.httpMetadata?.contentType).toBe("image/png");
  });

  it("refuses anything that is not an image", async () => {
    const env = createTestEnv();
    const uid = "uploader-uid-2";
    env.seedUser(uid);
    const response = await uploadProof.handler(
      authedForm(
        "/api/v1/topups/proof",
        uid,
        proofForm("application/pdf", "receipt.pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46])),
      ),
      env,
    );
    expect(response.status).toBe(400);
  });

  it("refuses oversized uploads", async () => {
    const env = createTestEnv();
    const uid = "uploader-uid-3";
    env.seedUser(uid);
    const response = await uploadProof.handler(
      authedForm(
        "/api/v1/topups/proof",
        uid,
        proofForm("image/png", "huge.png", new Uint8Array(5 * 1024 * 1024 + 1)),
      ),
      env,
    );
    expect(response.status).toBe(400);
  });

  it("requires authentication", async () => {
    const env = createTestEnv();
    const form = proofForm("image/png", "receipt.png", PNG);
    const response = await uploadProof.handler(
      new Request(`${BASE}/api/v1/topups/proof`, { method: "POST", body: form }),
      env,
    );
    expect(response.status).toBe(401);
  });
});

describe("admin proof review", () => {
  it("serves the receipt to admins only", async () => {
    const env: TestEnv = createTestEnv();
    const member = env.seedUser("member-uid");
    const adminUid = "admin-uid";
    const admin = env.seedUser(adminUid);
    env.makeAdmin(admin);

    const topupId = crypto.randomUUID();
    const path = `topup-proofs/${member}/receipt.png`;
    env.sqlite
      .prepare(
        "INSERT INTO topup_requests (id, user_id, tier_id, ngn_amount, credits_amount, transfer_reference, proof_image_path, status, created_at) VALUES (?, ?, 'starter', 1000, 20, 'REF-PROOF', ?, 'pending', ?)",
      )
      .run(topupId, member, path, new Date().toISOString());
    await env.ASSETS_BUCKET.put(path, new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
      httpMetadata: { contentType: "image/png" },
    });

    const denied = await adminProof.handler(
      authRequest(`${BASE}/api/v1/admin/topups/${topupId}/proof`, "member-uid"),
      env,
    );
    expect(denied.status).toBe(403);

    const allowed = await adminProof.handler(
      authRequest(`${BASE}/api/v1/admin/topups/${topupId}/proof`, adminUid),
      env,
    );
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("Content-Type")).toBe("image/png");
  });

  it("404s when there is no receipt", async () => {
    const env = createTestEnv();
    const adminUid = "admin-uid-2";
    const admin = env.seedUser(adminUid);
    env.makeAdmin(admin);
    const member = env.seedUser("member-uid-2");
    const topupId = crypto.randomUUID();
    env.sqlite
      .prepare(
        "INSERT INTO topup_requests (id, user_id, tier_id, ngn_amount, credits_amount, transfer_reference, status, created_at) VALUES (?, ?, 'starter', 1000, 20, 'REF-NONE', 'pending', ?)",
      )
      .run(topupId, member, new Date().toISOString());

    const response = await adminProof.handler(
      authRequest(`${BASE}/api/v1/admin/topups/${topupId}/proof`, adminUid),
      env,
    );
    expect(response.status).toBe(404);
  });
});
