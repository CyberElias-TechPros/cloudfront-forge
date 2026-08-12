import type { Env } from "../types";

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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

export async function verifyFirebaseToken(
  idToken: string,
  env: Env,
): Promise<{ uid: string; email: string | null; emailVerified: boolean }> {
  if (env.ENVIRONMENT === "development") {
    const dev = await verifyDevToken(idToken, env);
    if (dev) return dev;
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${idToken}`,
    );

    if (!response.ok) {
      throw new Error("AUTH_TOKEN_INVALID");
    }

    const payload = (await response.json()) as any;

    return {
      uid: payload.sub,
      email: payload.email ?? null,
      emailVerified: payload.email_verified ?? false,
    };
  } catch (error) {
    console.error("Token verification error:", error);
    throw new Error("AUTH_TOKEN_INVALID");
  }
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
  const response = await fetch("https://www.googleapis.com/robot/v1/security?types=ID_TOKEN");
  const keys = await response.json();
  return keys;
}
