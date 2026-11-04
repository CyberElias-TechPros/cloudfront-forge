export interface ServiceAccount { client_email: string; private_key: string; project_id: string }
interface CachedToken { value: string; expiresAt: number }
const cache = new Map<string, CachedToken>();
const pending = new Map<string, Promise<string>>();

export function parseServiceAccount(raw: string | undefined): ServiceAccount {
  if (!raw) throw new Error("GOOGLE_SERVICE_NOT_CONFIGURED");
  const value = JSON.parse(raw) as ServiceAccount;
  if (!value.client_email || !value.private_key || !value.project_id) {
    throw new Error("GOOGLE_SERVICE_NOT_CONFIGURED");
  }
  return value;
}
function b64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function signingKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const binary = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", binary, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

/** OAuth for FCM / Android Publisher. Service-account JSON never leaves the Worker. */
export async function googleAccessToken(account: ServiceAccount, scope: string): Promise<string> {
  const key = `${account.client_email}:${scope}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const task = (async () => {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(JSON.stringify({ iss: account.client_email, scope,
      aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await signingKey(account.private_key),
      new TextEncoder().encode(`${header}.${claims}`));
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${header}.${claims}.${b64url(new Uint8Array(signature))}` }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("GOOGLE_SERVICE_AUTH_FAILED");
    const result = await response.json() as { access_token?: string; expires_in?: number };
    if (!result.access_token) throw new Error("GOOGLE_SERVICE_AUTH_FAILED");
    cache.set(key, { value: result.access_token, expiresAt: Date.now() + Math.min(result.expires_in ?? 3600, 3600) * 1000 });
    return result.access_token;
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
