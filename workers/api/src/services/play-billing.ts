import type { Env } from "../types";
import { googleAccessToken, parseServiceAccount } from "./google-auth";

export interface CreditProduct { productId: string; label: string; credits: number }
export interface PlayPurchase {
  purchaseState: number; consumptionState: number; orderId: string;
  obfuscatedExternalAccountId?: string; productId?: string;
}
export function creditCatalog(env: Env): CreditProduct[] {
  if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || !env.GOOGLE_PLAY_PACKAGE_NAME) return [];
  try {
    const raw = JSON.parse(env.PLAY_CREDIT_PRODUCTS_JSON ?? "[]") as CreditProduct[];
    if (!Array.isArray(raw) || raw.length > 20) return [];
    const ids = new Set<string>();
    return raw.filter(p => {
      const valid = /^[a-z0-9_.]{1,100}$/.test(p.productId) && Number.isInteger(p.credits) &&
        p.credits > 0 && p.credits <= 100000 && typeof p.label === "string" && p.label.length <= 80 && !ids.has(p.productId);
      if (valid) ids.add(p.productId);
      return valid;
    }).map(({ productId, label, credits }) => ({ productId, label, credits }));
  } catch { return []; }
}
function purchaseUrl(env: Env, productId: string, token: string): string {
  return `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PLAY_PACKAGE_NAME!)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`;
}
async function access(env: Env): Promise<string> {
  return googleAccessToken(parseServiceAccount(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON), "https://www.googleapis.com/auth/androidpublisher");
}
export async function getPlayPurchase(env: Env, productId: string, token: string): Promise<PlayPurchase> {
  const response = await fetch(purchaseUrl(env, productId, token), {
    headers: { Authorization: `Bearer ${await access(env)}` }, signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404 || response.status === 400) throw new Error("PURCHASE_INVALID");
  if (!response.ok) throw new Error("BILLING_UNAVAILABLE");
  return await response.json() as PlayPurchase;
}
export async function consumePlayPurchase(env: Env, productId: string, token: string): Promise<boolean> {
  try {
    const response = await fetch(`${purchaseUrl(env, productId, token)}:consume`, {
      method: "POST", headers: { Authorization: `Bearer ${await access(env)}` }, signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch { return false; }
}
