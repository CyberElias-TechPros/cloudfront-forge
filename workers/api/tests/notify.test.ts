import { describe, it, expect, vi, afterEach } from "vitest";
import { maybeSendWelcomeEmail, notify } from "../src/lib/notify";
import { notifyUserPush } from "../src/lib/push";
import { createTestEnv, type TestEnv } from "./helpers/test-env";

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Real P-256 VAPID keys, in the form notifyUserPush expects. */
async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const publicRaw = new Uint8Array(
    (await crypto.subtle.exportKey("raw", keys.publicKey)) as ArrayBuffer,
  );
  const jwk = (await crypto.subtle.exportKey("jwk", keys.privateKey)) as JsonWebKey;
  return { publicKey: b64urlEncode(publicRaw), privateKey: jwk.d as string };
}

/** Client key material matching a browser's pushManager.subscribe() output. */
async function clientSubscription() {
  const keys = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const publicRaw = new Uint8Array(
    (await crypto.subtle.exportKey("raw", keys.publicKey)) as ArrayBuffer,
  );
  return {
    p256dh: b64urlEncode(publicRaw),
    auth: b64urlEncode(crypto.getRandomValues(new Uint8Array(16))),
  };
}

function setPrefs(
  env: TestEnv,
  userId: string,
  prefs: Partial<{
    in_app_enabled: number;
    push_enabled: number;
    email_enabled: number;
    review_requests: number;
    mission_reminders: number;
    community_updates: number;
  }>,
) {
  const columns = Object.keys(prefs);
  const now = new Date().toISOString();
  env.sqlite
    .prepare(
      `INSERT INTO notification_preferences
         (id, user_id, ${columns.join(", ")}, created_at, updated_at)
       VALUES (?, ?, ${columns.map(() => "?").join(", ")}, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET ${columns
         .map((column) => `${column} = excluded.${column}`)
         .join(", ")}`,
    )
    .run(crypto.randomUUID(), userId, ...Object.values(prefs), now, now);
}

function inboxRows(env: TestEnv, userId: string) {
  return env.sqlite
    .prepare("SELECT type, title, message FROM notifications WHERE user_id = ? ORDER BY created_at")
    .all(userId) as Array<{ type: string; title: string; message: string }>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("notify fan-out", () => {
  it("writes the inbox row by default and honours in_app_enabled = 0", async () => {
    const env = createTestEnv();
    const optedIn = env.seedUser("notify-in");
    const optedOut = env.seedUser("notify-out");
    setPrefs(env, optedOut, { in_app_enabled: 0 });

    await notify(env, optedIn, {
      type: "WELCOME",
      title: "Hello",
      message: "You are in",
      category: "social",
    });
    await notify(env, optedOut, {
      type: "WELCOME",
      title: "Hello",
      message: "You are out",
      category: "social",
    });

    expect(inboxRows(env, optedIn)).toHaveLength(1);
    expect(inboxRows(env, optedOut)).toHaveLength(0);
  });

  it("keeps the inbox row when the caller already wrote it in a batch", async () => {
    const env = createTestEnv();
    const user = env.seedUser("notify-batch");

    await notify(env, user, {
      type: "BATCHED",
      title: "Already written",
      message: "No duplicate please",
      category: "money",
      inApp: false,
    });

    expect(inboxRows(env, user)).toHaveLength(0);
  });

  it("suppresses the whole event when its category preference is off", async () => {
    const env = createTestEnv();
    const reviewer = env.seedUser("notify-cat");
    setPrefs(env, reviewer, { review_requests: 0 });

    await notify(env, reviewer, {
      type: "REVIEW_ASSIGNED",
      title: "New Review Assigned",
      message: "A video needs your review",
      category: "review",
    });
    expect(inboxRows(env, reviewer)).toHaveLength(0);

    // Transactional categories are never gated by a category toggle.
    await notify(env, reviewer, {
      type: "TOPUP_REJECTED",
      title: "Top-up rejected",
      message: "Not credited",
      category: "money",
    });
    expect(inboxRows(env, reviewer)).toHaveLength(1);
  });

  it("emails money events unless email is switched off", async () => {
    const env = createTestEnv({ RESEND_API_KEY: "re_test_key" });
    const user = env.seedUser("notify-money");

    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notify(env, user, {
      type: "TOPUP_APPROVED",
      title: "Top-up approved",
      message: "Credits added",
      category: "money",
      url: "/gamification",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const payload = JSON.parse(String(init.body)) as { to: string[]; subject: string; html: string };
    expect(payload.to).toEqual(["notify-money@example.test"]);
    expect(payload.subject).toBe("Top-up approved");
    expect(payload.html).toContain("Credits added");

    // Second event with email off: inbox row still lands, no send.
    setPrefs(env, user, { email_enabled: 0 });
    await notify(env, user, {
      type: "TOPUP_REJECTED",
      title: "Top-up rejected",
      message: "Not credited",
      category: "money",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(inboxRows(env, user)).toHaveLength(2);
  });

  it("does not email social chatter even with email enabled", async () => {
    const env = createTestEnv({ RESEND_API_KEY: "re_test_key" });
    const user = env.seedUser("notify-social");
    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notify(env, user, {
      type: "WATCH_SESSION_CLAIMED",
      title: "Your video was watched",
      message: "Someone watched it",
      category: "social",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(inboxRows(env, user)).toHaveLength(1);
  });

  it("never throws when the write path fails", async () => {
    const env = createTestEnv();
    // An unknown user id violates the foreign key on notifications.user_id.
    await expect(
      notify(env, "missing-user-id", {
        type: "GHOST",
        title: "Ghost",
        message: "No recipient",
        category: "social",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("welcome email", () => {
  it("claims exactly once across replayed first logins", async () => {
    const env = createTestEnv({ RESEND_API_KEY: "re_test_key", SITE_URL: "https://app.test" });
    const user = env.seedUser("welcome-uid");

    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await maybeSendWelcomeEmail(env, user);
    await maybeSendWelcomeEmail(env, user);
    await maybeSendWelcomeEmail(env, user);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { subject: string; html: string };
    expect(payload.subject).toContain("Welcome to LoopSquad");
    // Absolute link: email clients cannot resolve site-relative hrefs.
    expect(payload.html).toContain("https://app.test/dashboard");

    const row = env.sqlite.prepare("SELECT welcome_sent_at FROM users WHERE id = ?").get(user) as {
      welcome_sent_at: string | null;
    };
    expect(row.welcome_sent_at).not.toBeNull();
  });

  it("claims without sending when email delivery is not configured", async () => {
    const env = createTestEnv();
    const user = env.seedUser("welcome-nokey");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await maybeSendWelcomeEmail(env, user);
    await maybeSendWelcomeEmail(env, user);

    // No key → no network, but the claim still flips exactly once.
    expect(fetchMock).not.toHaveBeenCalled();
    const row = env.sqlite.prepare("SELECT welcome_sent_at FROM users WHERE id = ?").get(user) as {
      welcome_sent_at: string | null;
    };
    expect(row.welcome_sent_at).not.toBeNull();
  });
});

describe("push preference", () => {
  async function seedPushUser(env: TestEnv, uid: string) {
    const user = env.seedUser(uid);
    const vapid = await vapidKeys();
    env.VAPID_PUBLIC_KEY = vapid.publicKey;
    env.VAPID_PRIVATE_KEY = vapid.privateKey;
    const sub = await clientSubscription();
    env.sqlite
      .prepare(
        "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        crypto.randomUUID(),
        user,
        `https://push.test/${uid}`,
        sub.p256dh,
        sub.auth,
        new Date().toISOString(),
      );
    return user;
  }

  it("stops delivery when push_enabled = 0 (legacy direct call sites too)", async () => {
    const env = createTestEnv();
    const user = await seedPushUser(env, "push-off");
    setPrefs(env, user, { push_enabled: 0 });

    const fetchMock = vi.fn(async () => new Response("", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyUserPush(env, user, "Hello", "World");
    expect(fetchMock).not.toHaveBeenCalled();

    setPrefs(env, user, { push_enabled: 1 });
    await notifyUserPush(env, user, "Hello", "World");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("notify() itself skips the push call when push is off", async () => {
    const env = createTestEnv();
    const user = await seedPushUser(env, "push-notify-off");
    setPrefs(env, user, { push_enabled: 0 });

    const fetchMock = vi.fn(async () => new Response("", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await notify(env, user, {
      type: "SUPPORT_RESOLVED",
      title: "Resolved",
      message: "Done",
      category: "support",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(inboxRows(env, user)).toHaveLength(1);
  });
});
