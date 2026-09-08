import { describe, it, expect } from "vitest";
import { authRoutes } from "../src/routes/auth.ts";
import { createTestEnv, authRequest, jsonRequest } from "./helpers/test-env";

const BASE = "https://api.test";

const register = authRoutes.find((r) => r.path === "/api/v1/auth/register" && r.method === "POST")!;
const me = authRoutes.find((r) => r.path === "/api/v1/auth/me" && r.method === "GET")!;
const updateProfile = authRoutes.find(
  (r) => r.path === "/api/v1/auth/profile" && r.method === "PUT",
)!;
const permissions = authRoutes.find(
  (r) => r.path === "/api/v1/auth/permissions" && r.method === "GET",
)!;

async function json(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: Record<string, unknown>;
    error?: { code: string; message: string };
  };
}

describe("auth/register hardening", () => {
  it("rejects anonymous callers with 401", async () => {
    const env = createTestEnv();
    const response = await register.handler(
      new Request(`${BASE}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firebaseUid: "some-uid", displayName: "Attacker" }),
      }),
      env,
    );
    expect(response.status).toBe(401);
    const rows = env.sqlite.prepare("SELECT COUNT(*) AS count FROM users").get() as {
      count: number;
    };
    expect(rows.count).toBe(0);
  });

  it("creates the user from the verified token, ignoring a forged body uid", async () => {
    const env = createTestEnv();
    const request = jsonRequest(`${BASE}/api/v1/auth/register`, "real-uid", "POST", {
      firebaseUid: "victim-uid", // must be ignored — identity comes from the token
      email: "attacker@example.com", // must be ignored as well
      displayName: "Real User",
      photoUrl: "https://example.com/photo.jpg",
    });
    const response = await register.handler(request, env);

    expect(response.status).toBe(200);
    const body = await json(response);
    const user = body.data?.user as Record<string, unknown>;
    expect(user).toBeDefined();
    expect(user.firebaseUid).toBe("real-uid");
    expect(user.email).toMatch(/real-uid@example\.test/);
    expect(user.displayName).toBe("Real User");
    expect(user.photoUrl).toBe("https://example.com/photo.jpg");

    const row = env.sqlite.prepare("SELECT * FROM users WHERE firebase_uid = 'real-uid'").get();
    expect(row).toBeDefined();
    // No row may exist for the forged uid.
    const victim = env.sqlite
      .prepare("SELECT COUNT(*) AS count FROM users WHERE firebase_uid = 'victim-uid'")
      .get() as { count: number };
    expect(victim.count).toBe(0);
  });

  it("never leaks an existing user's profile to a caller with a different uid", async () => {
    const env = createTestEnv();
    env.seedUser("victim-uid"); // victim account already exists

    const request = jsonRequest(`${BASE}/api/v1/auth/register`, "attacker-uid", "POST", {
      firebaseUid: "victim-uid",
    });
    const response = await register.handler(request, env);

    expect(response.status).toBe(200);
    const body = await json(response);
    const user = body.data?.user as Record<string, unknown>;
    // The returned profile is the *attacker's own* (auto-created) row — never
    // the victim's row the body tried to address.
    expect(user.firebaseUid).toBe("attacker-uid");
  });

  it("does not clobber a display name the member set in-app on later sign-ins", async () => {
    const env = createTestEnv();
    const uid = "rename-uid";

    const firstRequest = jsonRequest(`${BASE}/api/v1/auth/register`, uid, "POST", {
      displayName: "Google Name",
    });
    const first = await register.handler(firstRequest, env);
    expect(first.status).toBe(200);

    // Member renames themselves in-app.
    env.sqlite
      .prepare("UPDATE users SET display_name = 'Custom Name' WHERE firebase_uid = ?")
      .run(uid);

    const secondRequest = jsonRequest(`${BASE}/api/v1/auth/register`, uid, "POST", {
      displayName: "Google Name (changed)",
      photoUrl: "https://example.com/new.jpg",
    });
    const second = await register.handler(secondRequest, env);
    expect(second.status).toBe(200);

    const row = env.sqlite
      .prepare("SELECT display_name, photo_url FROM users WHERE firebase_uid = ?")
      .get(uid) as { display_name: string; photo_url: string | null };
    expect(row.display_name).toBe("Custom Name");
    // photo_url was still empty, so the Google photo fills the gap.
    expect(row.photo_url).toBe("https://example.com/new.jpg");
  });
});

describe("auth/me", () => {
  it("returns the authenticated user's profile", async () => {
    const env = createTestEnv();
    const uid = "me-uid";
    env.seedUser(uid);
    const response = await me.handler(authRequest(`${BASE}/api/v1/auth/me`, uid), env);
    expect(response.status).toBe(200);
    const body = await json(response);
    expect((body.data as Record<string, unknown>).firebaseUid).toBe(uid);
  });

  it("rejects anonymous callers with 401", async () => {
    const env = createTestEnv();
    const response = await me.handler(new Request(`${BASE}/api/v1/auth/me`), env);
    expect(response.status).toBe(401);
  });
});

describe("auth/profile update", () => {
  it("does not wipe display_name when only email is supplied", async () => {
    const env = createTestEnv();
    const uid = "profile-uid";
    const userId = env.seedUser(uid);
    env.sqlite.prepare("UPDATE users SET display_name = 'Has Name' WHERE id = ?").run(userId);

    const request = jsonRequest(`${BASE}/api/v1/auth/profile`, uid, "PUT", {
      email: "new@example.com",
    });
    const response = await updateProfile.handler(request, env);
    expect(response.status).toBe(200);

    const row = env.sqlite.prepare("SELECT display_name FROM users WHERE id = ?").get(userId) as {
      display_name: string | null;
    };
    expect(row.display_name).toBe("Has Name");
  });

  it("updates display_name when supplied", async () => {
    const env = createTestEnv();
    const uid = "profile-uid-2";
    const userId = env.seedUser(uid);

    const request = jsonRequest(`${BASE}/api/v1/auth/profile`, uid, "PUT", {
      displayName: "New Name",
    });
    const response = await updateProfile.handler(request, env);
    expect(response.status).toBe(200);

    const row = env.sqlite.prepare("SELECT display_name FROM users WHERE id = ?").get(userId) as {
      display_name: string | null;
    };
    expect(row.display_name).toBe("New Name");
  });
});

describe("auth/permissions access control", () => {
  it("rejects anonymous callers even when a userId is supplied", async () => {
    const env = createTestEnv();
    const target = env.seedUser("target-uid");
    env.makeAdmin(target, "super_admin");
    const response = await permissions.handler(
      new Request(`${BASE}/api/v1/auth/permissions?userId=${target}`),
      env,
    );
    expect(response.status).toBe(401);
  });

  it("lets members read only their own permissions", async () => {
    const env = createTestEnv();
    const member = env.seedUser("member-uid");
    const response = await permissions.handler(
      authRequest(`${BASE}/api/v1/auth/permissions`, "member-uid"),
      env,
    );
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.data).toMatchObject({ userId: member, role: "member" });
  });

  it("forbids a member from reading another user's permissions (no admin probing)", async () => {
    const env = createTestEnv();
    env.seedUser("member-uid");
    const target = env.seedUser("target-uid");
    env.makeAdmin(target, "super_admin");
    const response = await permissions.handler(
      authRequest(`${BASE}/api/v1/auth/permissions?userId=${target}`, "member-uid"),
      env,
    );
    expect(response.status).toBe(403);
  });

  it("lets admins read another user's permissions", async () => {
    const env = createTestEnv();
    const admin = env.seedUser("admin-uid");
    env.makeAdmin(admin, "admin");
    const target = env.seedUser("target-uid");
    const response = await permissions.handler(
      authRequest(`${BASE}/api/v1/auth/permissions?userId=${target}`, "admin-uid"),
      env,
    );
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.data).toMatchObject({ userId: target, role: "member" });
  });
});
