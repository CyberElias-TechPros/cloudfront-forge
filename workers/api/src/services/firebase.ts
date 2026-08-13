import type { Env } from "../types";

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function certPemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\s+/g, "");
  return b64ToBytes(b64);
}

// Dev-only token: a base64url-encoded JSON payload (`<base64url(json)>`). Strictly gated to
// ENVIRONMENT === "development" so it is never accepted in production. Lets us smoke-test
// the API locally without a real Firebase project.
async function verifyDevToken(
  idToken: string,
  env: Env,
): Promise<{ uid: string; email: string | null; emailVerified: boolean } | null> {
  if (env.ENVIRONMENT !== "development") return null;
  try {
    const seg = idToken.split(".")[0];
    if (!seg) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(seg))) as any;
    if (!payload?.uid) return null;
    return {
      uid: payload.uid,
      email: payload.email ?? null,
      emailVerified: payload.emailVerified ?? true,
    };
  } catch {
    return null;
  }
}

// Firebase ID tokens are signed by Google's `securetoken` service. We verify the JWT signature
// against Google's public x509 certs (JWKS) using the Workers-native Web Crypto API — no
// firebase-admin / service-account key required.
const certCache = new Map<string, { der: Uint8Array; expires: number }>();

async function getSigningCert(kid: string): Promise<Uint8Array> {
  const cached = certCache.get(kid);
  if (cached && cached.expires > Date.now()) return cached.der;
  const res = await fetch(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com",
  );
  if (!res.ok) throw new Error("AUTH_TOKEN_INVALID");
  const certs = (await res.json()) as Record<string, string>;
  const expires = Date.now() + 6 * 60 * 60 * 1000;
  for (const [k, pem] of Object.entries(certs)) {
    certCache.set(k, { der: certPemToDer(pem), expires });
  }
  const found = certCache.get(kid);
  if (!found) throw new Error("AUTH_TOKEN_INVALID");
  return found.der;
}

async function verifyRealIdToken(
  idToken: string,
  env: Env,
): Promise<{ uid: string; email: string | null; emailVerified: boolean }> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("AUTH_TOKEN_INVALID");
  const [headerB64, payloadB64, sigB64] = parts;

  const header = JSON.parse(new TextDecoder().decode(b64urlDecode(headerB64))) as any;
  const kid: string | undefined = header.kid;
  if (!kid) throw new Error("AUTH_TOKEN_INVALID");

  const der = await getSigningCert(kid);

  const sig = b64urlDecode(sigB64);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const key = await crypto.subtle.importKey(
    "spki",
    der,
    { name: "RSASSA-PKCS1-v1_5" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    sig,
    data,
  );
  if (!valid) throw new Error("AUTH_TOKEN_INVALID");

  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))) as any;
  const projectId = env.FIREBASE_PROJECT_ID;
  if (payload.aud !== projectId) throw new Error("AUTH_TOKEN_INVALID");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
    throw new Error("AUTH_TOKEN_INVALID");
  if (
    typeof payload.exp !== "number" ||
    payload.exp < Math.floor(Date.now() / 1000)
  )
    throw new Error("AUTH_TOKEN_INVALID");
  if (!payload.sub) throw new Error("AUTH_TOKEN_INVALID");

  return {
    uid: payload.sub,
    email: payload.email ?? null,
    emailVerified: payload.email_verified ?? false,
  };
}

export async function verifyFirebaseToken(
  idToken: string,
  env: Env,
): Promise<{ uid: string; email: string | null; emailVerified: boolean }> {
  // In development, accept the dev token (no real Firebase project required).
  if (env.ENVIRONMENT === "development") {
    const dev = await verifyDevToken(idToken, env);
    if (dev) return dev;
  }
  // Otherwise verify a real Firebase ID token (signed by Google, JWKS-verified).
  return await verifyRealIdToken(idToken, env);
}

export async function signOutFromFirebase(idToken: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${idToken}`, {
      method: "POST",
    });
  } catch (error) {
    console.error("Firebase signout error:", error);
  }
}

export async function getFirebasePublicKey(kid?: string): Promise<any> {
  const response = await fetch(
    "https://www.googleapis.com/robot/v1/security?types=ID_TOKEN",
  );
  const keys = await response.json();
  return keys;
}
