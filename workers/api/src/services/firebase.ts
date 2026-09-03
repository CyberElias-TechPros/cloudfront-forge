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

// Web Crypto's `importKey('spki', …)` needs the SubjectPublicKeyInfo, not the
// full X.509 certificate DER. Extract it by walking the cert's ASN.1 structure.
function readTlv(buf: Uint8Array, pos: number) {
  const tag = buf[pos];
  let len = buf[pos + 1];
  let headerLen = 2;
  if (len & 0x80) {
    const numBytes = len & 0x7f;
    len = 0;
    for (let i = 0; i < numBytes; i++) len = (len << 8) | buf[pos + 2 + i];
    headerLen = 2 + numBytes;
  }
  const valueStart = pos + headerLen;
  const valueEnd = valueStart + len;
  return { tag, valueStart, valueEnd };
}

function extractSpkiFromCert(certDer: Uint8Array): Uint8Array {
  const certTlv = readTlv(certDer, 0);
  if (certTlv.tag !== 0x30) throw new Error("AUTH_TOKEN_INVALID");
  const tbs = readTlv(certDer, certTlv.valueStart);
  let r = tbs.valueStart;
  const first = readTlv(certDer, r);
  if (first.tag === 0xa0) r = first.valueEnd; // skip optional version tag
  r = readTlv(certDer, r).valueEnd; // serialNumber
  r = readTlv(certDer, r).valueEnd; // signature algorithm
  r = readTlv(certDer, r).valueEnd; // issuer
  r = readTlv(certDer, r).valueEnd; // validity
  r = readTlv(certDer, r).valueEnd; // subject
  const spki = readTlv(certDer, r);
  if (spki.tag !== 0x30) throw new Error("AUTH_TOKEN_INVALID");
  return certDer.subarray(r, spki.valueEnd);
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
    certCache.set(k, { der: extractSpkiFromCert(certPemToDer(pem)), expires });
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
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, sig, data);
  if (!valid) throw new Error("AUTH_TOKEN_INVALID");

  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64))) as any;
  const projectId = env.FIREBASE_PROJECT_ID;
  if (payload.aud !== projectId) throw new Error("AUTH_TOKEN_INVALID");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
    throw new Error("AUTH_TOKEN_INVALID");
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000))
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

