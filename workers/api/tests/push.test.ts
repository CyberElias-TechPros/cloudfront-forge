import { describe, it, expect, vi, afterEach } from "vitest";
import { encryptPushPayload, generateVapidHeader, notifyUserPush } from "../src/lib/push";
import { createTestEnv } from "./helpers/test-env";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Client-side key material, mirroring what a browser hands to pushManager.subscribe(). */
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
  return {
    publicKey: b64urlEncode(publicRaw),
    privateKey: jwk.d as string,
    verifyKey: keys.publicKey,
  };
}

async function clientSubscription() {
  const keys = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const publicRaw = new Uint8Array(
    (await crypto.subtle.exportKey("raw", keys.publicKey)) as ArrayBuffer,
  );
  const privateRaw = new Uint8Array(
    (await crypto.subtle.exportKey("pkcs8", keys.privateKey)) as ArrayBuffer,
  );
  return {
    p256dh: b64urlEncode(publicRaw),
    auth: b64urlEncode(crypto.getRandomValues(new Uint8Array(16))),
    privateKey: await crypto.subtle.importKey(
      "pkcs8",
      privateRaw as BufferSource,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    ),
  };
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data as BufferSource);
  return new Uint8Array(signature);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** The decoder half of RFC 8291 — what the browser does on delivery. */
async function decryptPushPayload(
  body: Uint8Array,
  auth: string,
  clientPrivateKey: CryptoKey,
): Promise<string> {
  const salt = body.slice(0, 16);
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const recordSize = view.getUint32(16, false);
  const keyIdLength = body[20];
  const serverPublicKey = body.slice(21, 21 + keyIdLength);
  const ciphertext = body.slice(21 + keyIdLength);
  expect(recordSize).toBeGreaterThanOrEqual(ciphertext.length + 16);

  const serverPublic = await crypto.subtle.importKey(
    "raw",
    serverPublicKey as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: serverPublic } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      clientPrivateKey,
      256,
    ),
  );

  const authSecret = b64urlDecode(auth);
  const prk = await hmac(authSecret, shared);
  const ikm = await hmac(prk, concat([encoder.encode("Content-Encoding: auth"), new Uint8Array([0])]));
  const cek = (
    await hmac(ikm, concat([encoder.encode("Content-Encoding: aes128gcm"), new Uint8Array([0])]))
  ).slice(0, 16);
  const nonce = (
    await hmac(ikm, concat([encoder.encode("Content-Encoding: nonce"), new Uint8Array([0])]))
  ).slice(0, 12);

  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, [
    "decrypt",
  ]);
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, ciphertext as BufferSource),
  );

  // Padding: plaintext || 0x02 (last record delimiter).
  expect(plaintext[plaintext.length - 1]).toBe(2);
  return decoder.decode(plaintext.slice(0, plaintext.length - 1));
}

describe("encryptPushPayload", () => {
  it("produces an aes128gcm body the client can decrypt", async () => {
    const sub = await clientSubscription();
    const payload = JSON.stringify({
      title: "New review assigned",
      body: 'Someone is watching "My video"',
      url: "/notifications",
    });

    const { body, salt, serverPublicKey } = await encryptPushPayload(
      sub.p256dh,
      sub.auth,
      payload,
    );

    expect(body.length).toBeGreaterThan(payload.length + 16);
    expect(new TextDecoder().decode(body)).not.toContain("New review assigned"); // encrypted
    expect(salt).toBeTruthy();
    expect(serverPublicKey).toBeTruthy();

    const decrypted = await decryptPushPayload(body, sub.auth, sub.privateKey);
    expect(decrypted).toBe(payload);
  });

  it("uses a fresh salt and ephemeral key per message", async () => {
    const sub = await clientSubscription();
    const [a, b] = await Promise.all([
      encryptPushPayload(sub.p256dh, sub.auth, "same message"),
      encryptPushPayload(sub.p256dh, sub.auth, "same message"),
    ]);
    expect(btoa(String.fromCharCode(...a.body.slice(0, 16)))).not.toBe(
      btoa(String.fromCharCode(...b.body.slice(0, 16))),
    );
    expect(await decryptPushPayload(b.body, sub.auth, sub.privateKey)).toBe("same message");
  });

  it("carries unicode text through unchanged", async () => {
    const sub = await clientSubscription();
    const payload = JSON.stringify({ title: "Referral 🎉", body: "Ngân received 50 credits" });
    const { body } = await encryptPushPayload(sub.p256dh, sub.auth, payload);
    expect(await decryptPushPayload(body, sub.auth, sub.privateKey)).toBe(payload);
  });
});

describe("generateVapidHeader", () => {
  it("issues a verifiable ES256 JWT scoped to the endpoint origin", async () => {
    const { publicKey, privateKey, verifyKey } = await vapidKeys();
    const header = await generateVapidHeader(
      "https://fcm.googleapis.com/fcm/send/abc",
      publicKey,
      privateKey,
    );

    expect(header.startsWith("vapid t=")).toBe(true);
    expect(header).toContain(`, k=${publicKey}`);

    const token = header.slice("vapid t=".length).split(", k=")[0]!;
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    expect(b64urlDecode(encodedSignature!).length).toBe(64);
    expect(JSON.parse(decoder.decode(b64urlDecode(encodedHeader!)))).toMatchObject({
      typ: "JWT",
      alg: "ES256",
    });
    const claims = JSON.parse(decoder.decode(b64urlDecode(encodedPayload!)));
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      verifyKey,
      b64urlDecode(encodedSignature!), // WebCrypto ECDSA signs/verifies raw r||s
      encoder.encode(`${encodedHeader}.${encodedPayload}`),
    );
    expect(ok).toBe(true);
  });

  it("produces a signature that verifies for many key pairs (no DER length bugs)", async () => {
    // WebCrypto returns raw r||s signatures; the old DER parsing read `rLength`
    // from a random byte and threw for most signatures, so every VAPID token
    // was invalid. Sign a batch to prove the fix holds for every key.
    for (let i = 0; i < 200; i += 1) {
      const { publicKey, privateKey, verifyKey } = await vapidKeys();
      const header = await generateVapidHeader("https://push.test/x", publicKey, privateKey);
      const token = header.slice("vapid t=".length).split(", k=")[0]!;
      const parts = token.split(".");
      const ok = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        verifyKey,
        b64urlDecode(parts[2]!),
        encoder.encode(`${parts[0]}.${parts[1]}`),
      );
      if (!ok) throw new Error(`signature ${i} failed to verify`);
    }
  });
});

describe("notifyUserPush", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a decryptable payload to every registered device", async () => {
    const env = createTestEnv();
    const vapid = await vapidKeys();
    env.VAPID_PUBLIC_KEY = vapid.publicKey;
    env.VAPID_PRIVATE_KEY = vapid.privateKey;

    const user = env.seedUser("push-uid");
    const sub = await clientSubscription();
    env.sqlite
      .prepare(
        "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(crypto.randomUUID(), user, "https://push.test/device-1", sub.p256dh, sub.auth, new Date().toISOString());

    const requests: Request[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input as string, init));
      return new Response("", { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await notifyUserPush(env, user, "Hello", "World");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = requests[0]!;
    expect(sent.headers.get("Content-Encoding")).toBe("aes128gcm");
    expect(sent.headers.get("TTL")).toBe("3600");
    expect(sent.headers.get("Authorization")?.startsWith("vapid t=")).toBe(true);

    const decrypted = await decryptPushPayload(
      new Uint8Array(await sent.arrayBuffer()),
      sub.auth,
      sub.privateKey,
    );
    expect(JSON.parse(decrypted)).toEqual({ title: "Hello", body: "World", url: "/notifications" });
  });

  it("prunes dead subscriptions (404/410) and keeps live ones", async () => {
    const env = createTestEnv();
    const vapid = await vapidKeys();
    env.VAPID_PUBLIC_KEY = vapid.publicKey;
    env.VAPID_PRIVATE_KEY = vapid.privateKey;

    const user = env.seedUser("push-uid-2");
    const now = new Date().toISOString();
    const live = await clientSubscription();
    const dead = await clientSubscription();
    const insert = env.sqlite.prepare(
      "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    insert.run(crypto.randomUUID(), user, "https://push.test/live", live.p256dh, live.auth, now);
    insert.run(crypto.randomUUID(), user, "https://push.test/dead", dead.p256dh, dead.auth, now);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        return new Response("", { status: url.endsWith("/dead") ? 410 : 201 });
      }),
    );

    await notifyUserPush(env, user, "Hi", "There");

    const remaining = env.sqlite
      .prepare("SELECT endpoint FROM push_subscriptions WHERE user_id = ? ORDER BY endpoint")
      .all(user) as { endpoint: string }[];
    expect(remaining.map((r) => r.endpoint)).toEqual(["https://push.test/live"]);
  });

  it("is a no-op without VAPID keys (never throws)", async () => {
    const env = createTestEnv();
    const user = env.seedUser("push-uid-3");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(notifyUserPush(env, user, "Hi", "There")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws when the push endpoint is unreachable", async () => {
    const env = createTestEnv();
    const vapid = await vapidKeys();
    env.VAPID_PUBLIC_KEY = vapid.publicKey;
    env.VAPID_PRIVATE_KEY = vapid.privateKey;
    const user = env.seedUser("push-uid-4");
    const sub = await clientSubscription();
    env.sqlite
      .prepare(
        "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(crypto.randomUUID(), user, "https://push.test/boom", sub.p256dh, sub.auth, new Date().toISOString());

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await expect(notifyUserPush(env, user, "Hi", "There")).resolves.toBeUndefined();
  });
});
