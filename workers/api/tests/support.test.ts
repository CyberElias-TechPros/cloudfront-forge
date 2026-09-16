import { describe, it, expect } from "vitest";
import { supportRoutes } from "../src/routes/support";
import { createTestEnv, authRequest, jsonRequest } from "./helpers/test-env";

const BASE = "https://api.test";

const createSupport = supportRoutes.find((r) => r.path === "/api/v1/support")!;
const listSupport = supportRoutes.find((r) => r.path === "/api/v1/admin/support")!;
const resolveSupport = supportRoutes.find((r) => "pattern" in r)!;

async function data(response: Response) {
  return (await response.json()) as { success: boolean; data?: any; error?: { code: string } };
}

describe("member support channel", () => {
  it("validates the message and stores a request", async () => {
    const env = createTestEnv();
    const member = env.seedUser("member-sup");
    void member;

    const tooShort = await createSupport.handler(
      jsonRequest(`${BASE}/api/v1/support`, "member-sup", "POST", {
        topic: "credits",
        message: "help",
      }),
      env,
    );
    expect(tooShort.status).toBe(400);

    const badTopic = await createSupport.handler(
      jsonRequest(`${BASE}/api/v1/support`, "member-sup", "POST", {
        topic: "hacking",
        message: "please give me free credits right now",
      }),
      env,
    );
    expect(badTopic.status).toBe(400);

    const ok = await createSupport.handler(
      jsonRequest(`${BASE}/api/v1/support`, "member-sup", "POST", {
        topic: "credits",
        message: "I transferred 5,000 naira yesterday and my credits never arrived.",
      }),
      env,
    );
    expect(ok.status).toBe(201);
    const row = env.sqlite
      .prepare("SELECT topic, status FROM support_requests WHERE user_id = ?")
      .get(member) as any;
    expect(row.topic).toBe("credits");
    expect(row.status).toBe("open");
  });

  it("admins are listed, notified and can resolve once", async () => {
    const env = createTestEnv();
    const member = env.seedUser("member-sup2");
    const admin = env.seedUser("admin-sup");
    env.makeAdmin(admin);

    await createSupport.handler(
      jsonRequest(`${BASE}/api/v1/support`, "member-sup2", "POST", {
        topic: "bug",
        message: "The queue keeps showing me videos I already watched.",
      }),
      env,
    );

    const notified = env.sqlite
      .prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND type = 'SUPPORT_REQUEST'")
      .get(admin) as any;
    expect(notified.c).toBe(1);

    const list = await listSupport.handler(
      authRequest(`${BASE}/api/v1/admin/support?status=open`, "admin-sup"),
      env,
    );
    expect(list.status).toBe(200);
    const body = await data(list);
    expect(body.data.items).toHaveLength(1);
    const supportId = body.data.items[0].id;

    const resolve = await resolveSupport.handler(
      jsonRequest(`${BASE}/api/v1/admin/support/${supportId}/resolve`, "admin-sup", "POST", {}),
      env,
    );
    expect(resolve.status).toBe(200);

    const row = env.sqlite.prepare("SELECT status FROM support_requests WHERE id = ?").get(supportId) as any;
    expect(row.status).toBe("resolved");

    const memberNotified = env.sqlite
      .prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND type = 'SUPPORT_RESOLVED'")
      .get(member) as any;
    expect(memberNotified.c).toBe(1);

    const replay = await resolveSupport.handler(
      jsonRequest(`${BASE}/api/v1/admin/support/${supportId}/resolve`, "admin-sup", "POST", {}),
      env,
    );
    expect(replay.status).toBe(409);
  });

  it("non-admins cannot read or resolve the queue", async () => {
    const env = createTestEnv();
    const member = env.seedUser("member-sup3");
    void member;

    const list = await listSupport.handler(
      authRequest(`${BASE}/api/v1/admin/support?status=open`, "member-sup3"),
      env,
    );
    expect(list.status).toBe(403);

    const resolve = await resolveSupport.handler(
      jsonRequest(`${BASE}/api/v1/admin/support/anything/resolve`, "member-sup3", "POST", {}),
      env,
    );
    expect(resolve.status).toBe(403);
  });
});
