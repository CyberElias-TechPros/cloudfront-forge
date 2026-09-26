import type { Env } from "../types";
import { Database } from "./database";
import { createLogger } from "./logger";

/**
 * Minimal Web Push (VAPID) sender for Cloudflare Workers.
 *
 * Sends encrypted pushes (RFC 8291 / aes128gcm content encoding) so the service
 * worker can show the real title and body: Authorization = vapid t=<JWT>,
 * k=<pubkey>, Content-Encoding = aes128gcm.
 */

function b64urlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecodeToArray(b64url: string): Uint8Array {
  const padding = "=".repeat((4 - (b64url.length % 4)) % 4);
  const base64 = (b64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

interface Jwk {
  kty: string;
  crv: string;
  x: string;
  y: string;
  d?: string;
}

/** Build JWK from VAPID keys: pubkey is base64url(0x04 || X || Y); privkey is base64url(d). */
function buildJwk(publicKeyB64: string, privateKeyB64: string): Jwk {
  const rawPub = b64urlDecodeToArray(publicKeyB64);
  // Uncompressed point: 0x04 followed by X (32 bytes) then Y (32 bytes)
  const x = rawPub.slice(1, 33);
  const y = rawPub.slice(33, 65);
  return {
    kty: "EC",
    crv: "P-256",
    x: b64urlEncode(x),
    y: b64urlEncode(y),
    d: privateKeyB64,
  };
}

/**
 * Copy `bytes` into a fixed-width big-endian field: DER integers carry a
 * leading 0x00 when the high bit is set and drop leading zeros otherwise, so
 * both cases have to be normalised to exactly `length` bytes.
 */
function toFixedLength(bytes: Uint8Array, length: number): Uint8Array {
  const trimmed = bytes.length > length ? bytes.slice(bytes.length - length) : bytes;
  const out = new Uint8Array(length);
  out.set(trimmed, length - trimmed.length);
  return out;
}

/**
 * Normalise an ECDSA signature to the raw `r||s` (64 byte) form JWT `ES256`
 * requires.
 *
 * WebCrypto (Cloudflare Workers, browsers, Node 18+) returns the raw form
 * already; older/DER-emitting runtimes are still handled by detecting the ASN.1
 * SEQUENCE tag. The previous implementation always assumed DER, so `rLength`
 * was read from a random byte and the conversion threw (or produced garbage)
 * for most signatures — every VAPID JWT was invalid.
 */
function normaliseSignature(signature: Uint8Array): Uint8Array {
  if (signature.length === 64) return signature;
  if (signature[0] === 0x30) return derToRaw(signature);
  throw new Error(`Unexpected ECDSA signature length: ${signature.length}`);
}

/** ECDSA signature (DER) -> raw r||s (64 bytes). */
function derToRaw(signature: Uint8Array): Uint8Array {
  // SEQUENCE { INTEGER r, INTEGER s }
  let offset = 2; // 0x30, total length
  const rLength = signature[offset + 1]!;
  offset += 2;
  const r = signature.slice(offset, offset + rLength);
  offset += rLength;
  const sLength = signature[offset + 1]!;
  offset += 2;
  const s = signature.slice(offset, offset + sLength);

  const out = new Uint8Array(64);
  out.set(toFixedLength(r, 32), 0);
  out.set(toFixedLength(s, 32), 32);
  return out;
}

async function signEs256(jwk: Jwk, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk as JsonWebKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(data));
  return b64urlEncode(normaliseSignature(new Uint8Array(sigBuf)));
}

export async function generateVapidHeader(
  endpoint: string,
  publicKey: string,
  privateKey: string,
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600;
  const jwk = buildJwk(publicKey, privateKey);

  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64urlEncode(
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp: expiry, sub: "mailto:loop@techpros.com.ng" })),
  );
  const signature = await signEs256(jwk, `${header}.${payload}`);
  return `vapid t=${header}.${payload}.${signature}, k=${publicKey}`;
}

/**
 * Fire-and-forget push to every device registered for a user.
 * Best-effort: removes dead endpoints (404/410 responses).
 */
export async function notifyUserPush(env: Env, userId: string, title: string, body: string): Promise<void> {
  try {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
    const db = new Database(env);
    const logger = createLogger(env);

    // Preferences first: the "push notifications" toggle in Settings must
    // actually stop delivery, and quiet hours must hold it until office hours
    // are irrelevant — a suppressed push is simply not sent.
    const prefs = await db.query(
      "SELECT push_enabled, quiet_hours_start, quiet_hours_end FROM notification_preferences WHERE user_id = ?",
      [userId],
    );
    if (prefs.results.length > 0) {
      const pref = prefs.results[0] as Record<string, unknown>;
      if (pref.push_enabled === 0 || pref.push_enabled === false) return;
      const start = pref.quiet_hours_start;
      const end = pref.quiet_hours_end;
      if (start !== null && end !== null && typeof start === "number" && typeof end === "number") {
        const now = new Date().getUTCHours();
        const inQuiet = start < end ? (now >= start && now < end) : (now >= start || now < end);
        if (inQuiet) return;
      }
    }

    const subs = await db.query(
      "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
      [userId],
    );
    const payload = JSON.stringify({ title, body, url: "/notifications" });

    for (const row of subs.results) {
      const { id, endpoint, p256dh, auth } = row as {
        id: string;
        endpoint: string;
        p256dh: string;
        auth: string;
      };
      try {
        const vapid = await generateVapidHeader(
          endpoint,
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY,
        );
        const { body: encryptedBody, salt, serverPublicKey } = await encryptPushPayload(
          p256dh,
          auth,
          payload,
        );
        const headers: Record<string, string> = {
          TTL: "3600",
          Authorization: vapid,
          "Content-Encoding": "aes128gcm",
          "Content-Type": "application/octet-stream",
        };
        // Expose the crypto material when it is available (Cloudflare Workers
        // supports it); the endpoint can still decrypt without it, since the
        // aes128gcm header carries the salt and ephemeral public key.
        if (salt) headers["Encryption"] = `salt=${salt}`;
        if (serverPublicKey) headers["Crypto-Key"] = `dh=${serverPublicKey}`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: encryptedBody,
        });
        if (res.status === 404 || res.status === 410) {
          await db.execute("DELETE FROM push_subscriptions WHERE id = ?", [id]);
        }
      } catch (error) {
        // Endpoint unreachable or the VAPID keys are unusable. Log it once per
        // attempt so a broken push configuration is visible in `wrangler tail`
        // instead of failing silently; the subscription stays for the next try.
        logger.warn("Push delivery failed", {
          endpoint,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    // Never let push failures break the calling flow.
    createLogger(env).error("notifyUserPush failed", error);
  }
}

/**
 * Encrypt a push payload for one subscription (RFC 8291, aes128gcm encoding).
 *
 * Returns the raw request body (aes128gcm header || ciphertext) plus the salt
 * and ephemeral public key, which are already embedded in the body — the
 * returned strings are only for the legacy `Encryption` / `Crypto-Key` headers.
 */
export async function encryptPushPayload(
  p256dh: string,
  auth: string,
  payload: string,
): Promise<{ body: Uint8Array; salt: string; serverPublicKey: string }> {
  const RECORD_SIZE = 4096;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authSecret = b64urlDecodeToArray(auth);

  // Ephemeral server key pair (fresh for every message).
  const serverKeys = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const serverPublicRaw = new Uint8Array(
    (await crypto.subtle.exportKey("raw", serverKeys.publicKey as CryptoKey)) as ArrayBuffer,
  );

  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    b64urlDecodeToArray(p256dh) as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      // workers-types spells the ECDH peer as `$public`; the runtime property
      // is `public` per the Web Crypto standard.
      { name: "ECDH", public: clientPublicKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      serverKeys.privateKey as CryptoKey,
      256,
    ),
  );

  // HKDF (RFC 5869) reduced to the two HMAC chains RFC 8291 needs.
  const prk = await hmac(authSecret, shared);
  const ikm = await hmac(prk, concat(encoder.encode("Content-Encoding: auth"), new Uint8Array([0])));
  const cek = (await hmac(ikm, concat(encoder.encode("Content-Encoding: aes128gcm"), new Uint8Array([0])))).slice(0, 16);
  const nonce = (await hmac(ikm, concat(encoder.encode("Content-Encoding: nonce"), new Uint8Array([0])))).slice(0, 12);

  // Single record: plaintext || 0x02 delimiter, AES-128-GCM sealed with nonce.
  const plaintext = concat(encoder.encode(payload), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, [
    "encrypt",
  ]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, plaintext as BufferSource),
  );

  const header = new Uint8Array(16 + 4 + 1 + serverPublicRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false);
  header[20] = serverPublicRaw.length;
  header.set(serverPublicRaw, 21);

  return {
    body: concat(header, ciphertext),
    salt: b64urlEncode(salt),
    serverPublicKey: b64urlEncode(serverPublicRaw),
  };
}

const encoder = new TextEncoder();

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, data as BufferSource),
  );
}
