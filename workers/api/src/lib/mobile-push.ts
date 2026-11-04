import type { Env } from "../types";
import { Database } from "./database";
import { createLogger } from "./logger";
import { googleAccessToken, parseServiceAccount } from "../services/google-auth";

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));
export function mobilePushEnabled(env: Env): boolean {
  return !!(env.FCM_SERVICE_ACCOUNT_JSON && env.DEVICE_TOKEN_SECRET);
}
async function tokenKey(env: Env): Promise<CryptoKey> {
  if (!env.DEVICE_TOKEN_SECRET || env.DEVICE_TOKEN_SECRET.length < 32) throw new Error("DEVICE_TOKEN_SECRET_MISSING");
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.DEVICE_TOKEN_SECRET));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptDeviceToken(env: Env, token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await tokenKey(env), new TextEncoder().encode(token));
  return `${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}
export async function decryptDeviceToken(env: Env, stored: string): Promise<string> {
  const [iv, ciphertext] = stored.split(".");
  if (!iv || !ciphertext) throw new Error("INVALID_DEVICE_TOKEN");
  const result = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(iv) }, await tokenKey(env), decode(ciphertext));
  return new TextDecoder().decode(result);
}

function inQuietHours(start: unknown, end: unknown): boolean {
  if (start === null || start === undefined || end === null || end === undefined || start === end) return false;
  const hour = new Date().getUTCHours();
  const s = Number(start), e = Number(end);
  return s < e ? hour >= s && hour < e : hour >= s || hour < e;
}

/** Data-only FCM: the Android service owns channels, permission and display. */
export async function notifyUserMobilePush(env: Env, userId: string, title: string, body: string,
  data: Record<string, string> = {}): Promise<void> {
  if (!mobilePushEnabled(env)) return;
  const db = new Database(env);
  const prefs = await db.querySingle("SELECT push_enabled, quiet_hours_start, quiet_hours_end FROM notification_preferences WHERE user_id = ?", [userId]);
  if (prefs?.push_enabled === 0 || inQuietHours(prefs?.quiet_hours_start, prefs?.quiet_hours_end)) return;
  const devices = await db.query("SELECT id, encrypted_token FROM mobile_devices WHERE user_id = ? ORDER BY updated_at DESC LIMIT 10", [userId]);
  if (!devices.results.length) return;
  try {
    const account = parseServiceAccount(env.FCM_SERVICE_ACCOUNT_JSON);
    const access = await googleAccessToken(account, "https://www.googleapis.com/auth/firebase.messaging");
    for (const device of devices.results as Array<{ id: string; encrypted_token: string }>) {
      try {
        const token = await decryptDeviceToken(env, device.encrypted_token);
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
          method: "POST", headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({ message: { token, android: { priority: "high", ttl: "86400s" },
            data: { ...Object.fromEntries(Object.entries(data).map(([k,v]) => [k, String(v).slice(0, 500)])),
              title: title.slice(0, 200), body: body.slice(0, 1000) } } }),
        });
        if (response.status === 404 || response.status === 410) {
          await db.execute("DELETE FROM mobile_devices WHERE id = ? AND user_id = ?", [device.id, userId]);
        } else if (!response.ok) {
          createLogger(env).warn("FCM delivery failed", { userId, status: response.status });
        }
      } catch (error) {
        createLogger(env).warn("FCM device delivery failed", { userId, error: error instanceof Error ? error.name : "unknown" });
      }
    }
  } catch (error) {
    createLogger(env).warn("FCM fan-out unavailable", { userId, error: error instanceof Error ? error.message : "unknown" });
  }
}
