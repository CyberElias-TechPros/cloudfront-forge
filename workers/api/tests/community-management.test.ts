import { describe, it, expect } from "vitest";
import { communityRoutes } from "../src/routes/communities";
import { communityManagementRoutes } from "../src/routes/community-management";
import { createTestEnv, authRequest, jsonRequest, type TestEnv } from "./helpers/test-env";

const BASE = "https://api.test";

function find(method: string, fragment: string) {
  const route = communityManagementRoutes.find(
    (r) => r.method === method && (r.pattern ?? "").includes(fragment),
  );
  if (!route) throw new Error(`route not found: ${method} ${fragment}`);
  return route;
}

const listCommunities = communityRoutes.find((r) => r.path === "/api/v1/communities")!;
const getCommunity = communityRoutes.find((r) => "pattern" in r && r.method === "GET")!;
const joinByCode = communityRoutes.find((r) => r.path === "/api/v1/communities/join")!;

function seed(
  env: TestEnv,
  {
    ownerId,
    isPublic = true,
    id = "community-mgmt",
    requireApproval,
    maxMembers = 100,
  }: { ownerId: string; isPublic?: boolean; id?: string; requireApproval?: boolean; maxMembers?: number },
) {
  const now = new Date().toISOString();
  // Invite codes are compared upper-cased, so store them upper-case like the
  // generator does.
  const code = `CODE-${id}`.toUpperCase().replace(/-/g, "");
  env.sqlite
    .prepare(
      `INSERT INTO communities (id, name, slug, invite_code, is_public, owner_id, max_members, created_at, updated_at)
       VALUES (?, 'Squad', ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, `slug-${id}`, code, isPublic ? 1 : 0, ownerId, maxMembers, now, now);
  env.sqlite
    .prepare(
      "INSERT INTO community_members (id, community_id, user_id, role, joined_at, status) VALUES (?, ?, ?, 'owner', ?, 'active')",
    )
    .run(crypto.randomUUID(), id, ownerId, now);
  if (requireApproval !== undefined) {
    env.sqlite
      .prepare(
        "INSERT INTO community_settings (id, community_id, require_approval, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(crypto.randomUUID(), id, requireApproval ? 1 : 0, now, now);
  }
  return id;
}

function addMember(env: TestEnv, communityId: string, userId: string, role = "member") {
  env.sqlite
    .prepare(
      "INSERT INTO community_members (id, community_id, user_id, role, joined_at, status) VALUES (?, ?, ?, ?, ?, 'active')",
    )
    .run(crypto.randomUUID(), communityId, userId, role, new Date().toISOString());
}

async function data(response: Response) {
  return (await response.json()) as { success: boolean; data?: any; error?: { code: string } };
}

describe("leaving communities", () => {
  const leave = find("POST", "/leave$");

  it("lets a member leave", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-1");
    const member = env.seedUser("member-1");
    const communityId = seed(env, { ownerId: owner });
    addMember(env, communityId, member);

    const response = await leave.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/leave`, "member-1", "POST", {}),
      env,
    );
    expect(response.status).toBe(200);
    const row = env.sqlite
      .prepare("SELECT status FROM community_members WHERE community_id = ? AND user_id = ?")
      .get(communityId, member) as any;
    expect(row.status).toBe("left");
  });

  it("stops an owner from abandoning the community", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-2");
    const communityId = seed(env, { ownerId: owner });

    const response = await leave.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/leave`, "owner-2", "POST", {}),
      env,
    );
    expect(response.status).toBe(400);
  });

  it("404s for non-members", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-3");
    const stranger = env.seedUser("stranger-3");
    void stranger;
    const communityId = seed(env, { ownerId: owner });

    const response = await leave.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/leave`, "stranger-3", "POST", {}),
      env,
    );
    expect(response.status).toBe(404);
  });

  it("lets a former member rejoin with the invite code (no UNIQUE 500)", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-4");
    const member = env.seedUser("member-4");
    const communityId = seed(env, { ownerId: owner });
    addMember(env, communityId, member);
    await leave.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/leave`, "member-4", "POST", {}),
      env,
    );

    const rejoin = await joinByCode.handler(
      jsonRequest(`${BASE}/api/v1/communities/join`, "member-4", "POST", {
        inviteCode: "CODECOMMUNITYMGMT",
      }),
      env,
    );
    expect(rejoin.status).toBe(200);
    const row = env.sqlite
      .prepare("SELECT status, role FROM community_members WHERE community_id = ? AND user_id = ?")
      .get(communityId, member) as any;
    expect(row.status).toBe("active");
    expect(row.role).toBe("member");
  });
});

describe("public join with approval", () => {
  const joinPublic = find("POST", "/join$");
  const approve = find("POST", "/approve$");
  const reject = find("POST", "/reject$");
  const requests = find("GET", "/requests$");

  it("creates a pending request when approval is required (default)", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-pa");
    const joiner = env.seedUser("joiner-pa");
    void joiner;
    const communityId = seed(env, { ownerId: owner });

    const response = await joinPublic.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/join`, "joiner-pa", "POST", {
        message: "Let me in",
      }),
      env,
    );
    expect(response.status).toBe(202);
    const body = await data(response);
    expect(body.data.pending).toBe(true);

    const row = env.sqlite
      .prepare("SELECT status, message FROM join_requests WHERE community_id = ? AND user_id = ?")
      .get(communityId, joiner) as any;
    expect(row.status).toBe("pending");
    expect(row.message).toBe("Let me in");

    // Owner got notified
    const notified = env.sqlite
      .prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND type = 'JOIN_REQUEST'")
      .get(owner) as any;
    expect(notified.c).toBe(1);
  });

  it("rejects a duplicate pending request with 409", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-dup");
    const joiner = env.seedUser("joiner-dup");
    const communityId = seed(env, { ownerId: owner });

    await joinPublic.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/join`, "joiner-dup", "POST", {}),
      env,
    );
    const second = await joinPublic.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/join`, "joiner-dup", "POST", {}),
      env,
    );
    expect(second.status).toBe(409);
  });

  it("joins immediately when approval is off", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-open");
    const joiner = env.seedUser("joiner-open");
    const communityId = seed(env, { ownerId: owner, requireApproval: false });

    const response = await joinPublic.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/join`, "joiner-open", "POST", {}),
      env,
    );
    expect(response.status).toBe(200);
    const row = env.sqlite
      .prepare("SELECT status FROM community_members WHERE community_id = ? AND user_id = ?")
      .get(communityId, joiner) as any;
    expect(row.status).toBe("active");
  });

  it("refuses public joins for private communities", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-priv");
    const joiner = env.seedUser("joiner-priv");
    const communityId = seed(env, { ownerId: owner, isPublic: false });

    const response = await joinPublic.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/join`, "joiner-priv", "POST", {}),
      env,
    );
    expect(response.status).toBe(400);
  });

  it("approves a request: status-locked, membership created, applicant notified", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-ap");
    const joiner = env.seedUser("joiner-ap");
    const communityId = seed(env, { ownerId: owner });
    await joinPublic.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/join`, "joiner-ap", "POST", {}),
      env,
    );
    const requestId = (
      env.sqlite.prepare("SELECT id FROM join_requests WHERE user_id = ?").get(joiner) as any
    ).id;

    const response = await approve.handler(
      jsonRequest(
        `${BASE}/api/v1/communities/${communityId}/requests/${requestId}/approve`,
        "owner-ap",
        "POST",
        {},
      ),
      env,
    );
    expect(response.status).toBe(200);

    const membership = env.sqlite
      .prepare("SELECT status FROM community_members WHERE community_id = ? AND user_id = ?")
      .get(communityId, joiner) as any;
    expect(membership.status).toBe("active");

    const notified = env.sqlite
      .prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND type = 'JOIN_APPROVED'")
      .get(joiner) as any;
    expect(notified.c).toBe(1);

    // A second approval of the same request must lose the race.
    const replay = await approve.handler(
      jsonRequest(
        `${BASE}/api/v1/communities/${communityId}/requests/${requestId}/approve`,
        "owner-ap",
        "POST",
        {},
      ),
      env,
    );
    expect(replay.status).toBe(409);
  });

  it("rolls back an approval when the community fills up while the request is pending", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-full");
    const joiner = env.seedUser("joiner-full");
    const filler = env.seedUser("filler-full");
    const communityId = seed(env, { ownerId: owner, maxMembers: 2 });

    // Request goes in while there is still one seat left.
    await joinPublic.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/join`, "joiner-full", "POST", {}),
      env,
    );
    // The last seat is taken before the owner reviews the request.
    addMember(env, communityId, filler);
    const requestId = (
      env.sqlite.prepare("SELECT id FROM join_requests WHERE user_id = ?").get(joiner) as any
    ).id;

    const response = await approve.handler(
      jsonRequest(
        `${BASE}/api/v1/communities/${communityId}/requests/${requestId}/approve`,
        "owner-full",
        "POST",
        {},
      ),
      env,
    );
    expect(response.status).toBe(403);
    const row = env.sqlite.prepare("SELECT status FROM join_requests WHERE id = ?").get(requestId) as any;
    expect(row.status).toBe("pending");
  });

  it("rejects a request and tells the applicant", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-rj");
    const joiner = env.seedUser("joiner-rj");
    const communityId = seed(env, { ownerId: owner });
    await joinPublic.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/join`, "joiner-rj", "POST", {}),
      env,
    );
    const requestId = (
      env.sqlite.prepare("SELECT id FROM join_requests WHERE user_id = ?").get(joiner) as any
    ).id;

    const response = await reject.handler(
      jsonRequest(
        `${BASE}/api/v1/communities/${communityId}/requests/${requestId}/reject`,
        "owner-rj",
        "POST",
        {},
      ),
      env,
    );
    expect(response.status).toBe(200);
    const row = env.sqlite.prepare("SELECT status FROM join_requests WHERE id = ?").get(requestId) as any;
    expect(row.status).toBe("rejected");
  });

  it("only managers can list requests", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-ls");
    const member = env.seedUser("member-ls");
    const communityId = seed(env, { ownerId: owner });
    addMember(env, communityId, member);

    const asMember = await requests.handler(
      authRequest(`${BASE}/api/v1/communities/${communityId}/requests`, "member-ls"),
      env,
    );
    expect(asMember.status).toBe(403);

    const asOwner = await requests.handler(
      authRequest(`${BASE}/api/v1/communities/${communityId}/requests`, "owner-ls"),
      env,
    );
    expect(asOwner.status).toBe(200);
  });
});

describe("member management", () => {
  const setRole = find("POST", "/role$");
  const remove = find("POST", "/remove$");

  it("owner promotes and demotes moderators", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-role");
    const member = env.seedUser("member-role");
    const communityId = seed(env, { ownerId: owner });
    addMember(env, communityId, member);

    const promote = await setRole.handler(
      jsonRequest(
        `${BASE}/api/v1/communities/${communityId}/members/${member}/role`,
        "owner-role",
        "POST",
        { role: "moderator" },
      ),
      env,
    );
    expect(promote.status).toBe(200);
    let row = env.sqlite
      .prepare("SELECT role FROM community_members WHERE community_id = ? AND user_id = ?")
      .get(communityId, member) as any;
    expect(row.role).toBe("moderator");

    const demote = await setRole.handler(
      jsonRequest(
        `${BASE}/api/v1/communities/${communityId}/members/${member}/role`,
        "owner-role",
        "POST",
        { role: "member" },
      ),
      env,
    );
    expect(demote.status).toBe(200);
    row = env.sqlite
      .prepare("SELECT role FROM community_members WHERE community_id = ? AND user_id = ?")
      .get(communityId, member) as any;
    expect(row.role).toBe("member");
  });

  it("non-owners cannot change roles and owners cannot change their own", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-rc");
    const mod = env.seedUser("mod-rc");
    const member = env.seedUser("member-rc");
    const communityId = seed(env, { ownerId: owner });
    addMember(env, communityId, mod, "moderator");
    addMember(env, communityId, member);

    const asModerator = await setRole.handler(
      jsonRequest(
        `${BASE}/api/v1/communities/${communityId}/members/${member}/role`,
        "mod-rc",
        "POST",
        { role: "moderator" },
      ),
      env,
    );
    expect(asModerator.status).toBe(403);

    const self = await setRole.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/members/${owner}/role`, "owner-rc", "POST", {
        role: "member",
      }),
      env,
    );
    expect(self.status).toBe(400);
  });

  it("owner removes a member (status banned, member notified)", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-rm");
    const member = env.seedUser("member-rm");
    const communityId = seed(env, { ownerId: owner });
    addMember(env, communityId, member);

    const response = await remove.handler(
      jsonRequest(
        `${BASE}/api/v1/communities/${communityId}/members/${member}/remove`,
        "owner-rm",
        "POST",
        {},
      ),
      env,
    );
    expect(response.status).toBe(200);
    const row = env.sqlite
      .prepare("SELECT status FROM community_members WHERE community_id = ? AND user_id = ?")
      .get(communityId, member) as any;
    expect(row.status).toBe("banned");
    const notified = env.sqlite
      .prepare(
        "SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND type = 'REMOVED_FROM_COMMUNITY'",
      )
      .get(member) as any;
    expect(notified.c).toBe(1);
  });

  it("moderators remove members but not other managers; nobody removes the owner", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-rm2");
    const mod = env.seedUser("mod-rm2");
    const member = env.seedUser("member-rm2");
    const mod2 = env.seedUser("mod2-rm2");
    const communityId = seed(env, { ownerId: owner });
    addMember(env, communityId, mod, "moderator");
    addMember(env, communityId, mod2, "moderator");
    addMember(env, communityId, member);

    const modRemovesMod = await remove.handler(
      jsonRequest(
        `${BASE}/api/v1/communities/${communityId}/members/${mod2}/remove`,
        "mod-rm2",
        "POST",
        {},
      ),
      env,
    );
    expect(modRemovesMod.status).toBe(403);

    const modRemovesMember = await remove.handler(
      jsonRequest(
        `${BASE}/api/v1/communities/${communityId}/members/${member}/remove`,
        "mod-rm2",
        "POST",
        {},
      ),
      env,
    );
    expect(modRemovesMember.status).toBe(200);

    const ownerRemoval = await remove.handler(
      jsonRequest(
        `${BASE}/api/v1/communities/${communityId}/members/${owner}/remove`,
        "mod-rm2",
        "POST",
        {},
      ),
      env,
    );
    expect(ownerRemoval.status).toBe(403);
  });
});

describe("invite code rotation and archiving", () => {
  const regenerate = find("POST", "/invite/regenerate$");
  const archive = find("DELETE", "");

  it("owner rotates the invite code", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-inv");
    const communityId = seed(env, { ownerId: owner });

    const response = await regenerate.handler(
      jsonRequest(`${BASE}/api/v1/communities/${communityId}/invite/regenerate`, "owner-inv", "POST", {}),
      env,
    );
    expect(response.status).toBe(200);
    const body = await data(response);
    expect(body.data.inviteCode).toBeTruthy();
    expect(body.data.inviteCode).not.toBe("CODECOMMUNITYMGMT");

    const row = env.sqlite.prepare("SELECT invite_code FROM communities WHERE id = ?").get(communityId) as any;
    expect(row.invite_code).toBe(body.data.inviteCode);
  });

  it("non-owners cannot rotate the code", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-inv2");
    const member = env.seedUser("member-inv2");
    const communityId = seed(env, { ownerId: owner });
    addMember(env, communityId, member);

    const response = await regenerate.handler(
      jsonRequest(
        `${BASE}/api/v1/communities/${communityId}/invite/regenerate`,
        "member-inv2",
        "POST",
        {},
      ),
      env,
    );
    expect(response.status).toBe(403);
  });

  it("owner archives: community and videos disappear from lists", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-arc");
    const member = env.seedUser("member-arc");
    const communityId = seed(env, { ownerId: owner });
    addMember(env, communityId, member);
    const now = new Date().toISOString();
    env.sqlite
      .prepare(
        "INSERT INTO videos (id, user_id, community_id, youtube_url, title, status, created_at, updated_at) VALUES (?, ?, ?, 'https://youtu.be/y', 'Vid', 'active', ?, ?)",
      )
      .run("video-arc", member, communityId, now, now);

    const response = await archive.handler(
      authRequest(`${BASE}/api/v1/communities/${communityId}`, "owner-arc", { method: "DELETE" }),
      env,
    );
    expect(response.status).toBe(200);

    const community = env.sqlite
      .prepare("SELECT status FROM communities WHERE id = ?")
      .get(communityId) as any;
    expect(community.status).toBe("archived");

    const video = env.sqlite.prepare("SELECT status FROM videos WHERE id = 'video-arc'").get() as any;
    expect(video.status).toBe("archived");

    // The member got told
    const notified = env.sqlite
      .prepare(
        "SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND type = 'COMMUNITY_ARCHIVED'",
      )
      .get(member) as any;
    expect(notified.c).toBe(1);

    // Hidden from the owner's list and from the detail route
    const list = await listCommunities.handler(
      authRequest(`${BASE}/api/v1/communities`, "owner-arc"),
      env,
    );
    const listBody = await data(list);
    expect(listBody.data.items.map((c: any) => c.id)).not.toContain(communityId);

    const detail = await getCommunity.handler(
      authRequest(`${BASE}/api/v1/communities/${communityId}`, "owner-arc"),
      env,
    );
    expect(detail.status).toBe(404);
  });

  it("non-owners cannot archive", async () => {
    const env = createTestEnv();
    const owner = env.seedUser("owner-arc2");
    const member = env.seedUser("member-arc2");
    const communityId = seed(env, { ownerId: owner });
    addMember(env, communityId, member);

    const response = await archive.handler(
      authRequest(`${BASE}/api/v1/communities/${communityId}`, "member-arc2", { method: "DELETE" }),
      env,
    );
    expect(response.status).toBe(403);
  });
});
