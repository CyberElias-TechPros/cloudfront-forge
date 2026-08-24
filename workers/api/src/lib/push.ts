import type { Env } from "../types";
import { Database } from "./database";

/**
 * Minimal Web Push (VAPID) sender for Cloudflare Workers.
 * Sends no-payload pushes (silent wake-ups): Authorization = vapid t=<JWT>, k=<pubkey>.
 * The service worker displays a generic notification on receipt.
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

async function signEs256(jwk: Jwk, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk as JsonWebKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(data));
  const sigBytes = new Uint8Array(sigBuf);
  // DER -> raw r||s (64 bytes): split DER at r/s lengths
  const rStart = sigBytes[4] > 32 ? 5 : 4;
  const rLen = sigBytes[rStart - 1];
  const sStart = rStart + rLen + 2;
  const sLen = sigBytes[sStart - 1];
  const r = sigBytes.slice(rStart, rStart + rLen);
  const s = sigBytes.slice(sStart, sStart + sLen);
  const out = new Uint8Array(64);
  out.set(r, 32 - r.length);
  out.set(s, 64 - s.length);
  return b64urlEncode(out);
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
    const subs = await db.query(
      "SELECT id, endpoint FROM push_subscriptions WHERE user_id = ?",
      [userId],
    );
    for (const row of subs.results) {
      const { id, endpoint } = row as { id: string; endpoint: string };
      try {
        const auth = await generateVapidHeader(endpoint, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { TTL: "3600", Authorization: auth },
        });
        if (res.status === 404 || res.status === 410) {
          await db.execute("DELETE FROM push_subscriptions WHERE id = ?", [id]);
        }
      } catch {
        // Endpoint unreachable; leave for cleanup on next attempt
      }
    }
  } catch {
    // Never let push failures break the calling flow
  }
}
