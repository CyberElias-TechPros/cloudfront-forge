export interface DevSession {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}

const STORAGE_KEY = "creatorloop_dev_session";

export function devEnabled(): boolean {
  return (
    import.meta.env.DEV === true ||
    import.meta.env["VITE_USE_DEV_AUTH"] === "true"
  );
}

export function getDevSession(): DevSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DevSession) : null;
  } catch {
    return null;
  }
}

export function setDevSession(session: DevSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearDevSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function defaultDevSession(): DevSession {
  const uid =
    (import.meta.env["VITE_DEV_UID"] as string | undefined) || "dev-local";
  const name =
    (import.meta.env["VITE_DEV_NAME"] as string | undefined) || "Dev User";
  return {
    uid,
    email: `${uid}@creatorloop.local`,
    displayName: name,
    photoURL: null,
  };
}

// Mirrors the worker's dev-token contract: a base64url-encoded JSON payload
// `{ uid, email, emailVerified }`, accepted only when ENVIRONMENT === "development".
function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b64 = typeof btoa !== "undefined" ? btoa(json) : Buffer.from(json).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function mintDevToken(session: DevSession): string {
  return base64UrlEncode({
    uid: session.uid,
    email: session.email,
    emailVerified: true,
  });
}
