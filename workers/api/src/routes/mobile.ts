import type { RouteDefinition } from "../types";
import { Database } from "../lib/database";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth, isAuthError } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { acquireOperationLock, releaseOperationLock } from "../lib/operation-lock";
import { encryptDeviceToken, mobilePushEnabled } from "../lib/mobile-push";
import { sha256Hex } from "../services/google-auth";
import { creditCatalog, getPlayPurchase, consumePlayPurchase } from "../services/play-billing";
import { sessionsEnabledFromEnv } from "../lib/verification/policy";
import {
  deviceRegisterSchema, deviceDeleteSchema, consentSchema, blockUserSchema, billingVerifySchema,
} from "../contract/schemas/mobile";

const POLICY_VERSION = "2026-11-03";
function failure(error: unknown, fallback = "The request could not be completed"): Response {
  if (isAuthError(error)) return createErrorResponse("AUTH_REQUIRED", "Please sign in again", 401);
  if (error instanceof Error && error.message === "FORBIDDEN") return createErrorResponse("FORBIDDEN", "Access denied", 403);
  return createErrorResponse("INTERNAL_ERROR", fallback, 500);
}

export const mobileRoutes: RouteDefinition[] = [
  {
    method: "GET", path: "/api/v1/mobile/config",
    handler: async (_request, env) => createResponse({
      apiVersion: "1", minAndroidVersionCode: Number(env.ANDROID_MIN_VERSION_CODE ?? "1"),
      maintenance: env.ANDROID_MAINTENANCE === "true", watchSessionsEnabled: sessionsEnabledFromEnv(env),
      billingEnabled: creditCatalog(env).length > 0, pushEnabled: mobilePushEnabled(env),
      coachEnabled: !!env.AI_API_KEY, youtubeEnabled: !!env.YOUTUBE_OAUTH_CLIENT_ID,
      policyVersion: POLICY_VERSION,
    }),
  },
  {
    method: "POST", path: "/api/v1/mobile/devices",
    handler: async (request, env) => {
      try {
        const userId = await requireAuth(request, env);
        const parsed = deviceRegisterSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return createErrorResponse("VALIDATION_ERROR", "A valid device token and installation ID are required", 400);
        if (!mobilePushEnabled(env)) return createErrorResponse("SERVICE_UNAVAILABLE", "Android notifications are not configured", 503);
        const db = new Database(env), now = db.now();
        const encrypted = await encryptDeviceToken(env, parsed.data.token);
        const hash = await sha256Hex(parsed.data.token);
        // Account switching on the same device transfers the token, rather than
        // leaving a second account receiving this device's notifications.
        await db.execute("DELETE FROM mobile_devices WHERE token_hash = ?", [hash]);
        await db.execute(
          `INSERT INTO mobile_devices (id, user_id, installation_id, token_hash, encrypted_token, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, installation_id) DO UPDATE SET token_hash = excluded.token_hash,
             encrypted_token = excluded.encrypted_token, updated_at = excluded.updated_at`,
          [db.uuid(), userId, parsed.data.installationId, hash, encrypted, now, now],
        );
        return createResponse({ message: "Device registered" });
      } catch (error) { return failure(error); }
    },
  },
  {
    method: "DELETE", path: "/api/v1/mobile/devices",
    handler: async (request, env) => {
      try {
        const userId = await requireAuth(request, env);
        const parsed = deviceDeleteSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return createErrorResponse("VALIDATION_ERROR", "installationId is required", 400);
        await new Database(env).execute("DELETE FROM mobile_devices WHERE user_id = ? AND installation_id = ?", [userId, parsed.data.installationId]);
        return createResponse({ message: "Device removed" });
      } catch (error) { return failure(error); }
    },
  },
  {
    method: "POST", path: "/api/v1/mobile/consent",
    handler: async (request, env) => {
      try {
        const userId = await requireAuth(request, env);
        const parsed = consentSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success || parsed.data.policyVersion !== POLICY_VERSION) {
          return createErrorResponse("VALIDATION_ERROR", "Accept the current terms, privacy notice and age declaration", 400);
        }
        const db = new Database(env);
        await db.execute(
          `INSERT INTO consent_records (id, user_id, policy_version, terms_accepted, privacy_accepted, age_confirmed, created_at)
           VALUES (?, ?, ?, 1, 1, 1, ?) ON CONFLICT(user_id, policy_version) DO NOTHING`,
          [db.uuid(), userId, POLICY_VERSION, db.now()],
        );
        return createResponse({ message: "Preferences recorded", policyVersion: POLICY_VERSION });
      } catch (error) { return failure(error); }
    },
  },
  {
    method: "GET", path: "/api/v1/users/me/blocks",
    handler: async (request, env) => {
      try {
        const userId = await requireAuth(request, env);
        const result = await new Database(env).query(
          `SELECT u.id, u.display_name, b.created_at FROM user_blocks b JOIN users u ON u.id = b.blocked_id
           WHERE b.blocker_id = ? ORDER BY b.created_at DESC LIMIT 100`, [userId],
        );
        return createResponse({ items: result.results });
      } catch (error) { return failure(error); }
    },
  },
  {
    method: "POST", path: "/api/v1/users/me/blocks",
    handler: async (request, env) => {
      try {
        const userId = await requireAuth(request, env);
        const parsed = blockUserSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return createErrorResponse("VALIDATION_ERROR", "A valid member ID is required", 400);
        if (parsed.data.userId === userId) return createErrorResponse("BAD_REQUEST", "You cannot block yourself", 400);
        const db = new Database(env);
        const target = await db.querySingle("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL", [parsed.data.userId]);
        if (!target) return createErrorResponse("NOT_FOUND", "Member not found", 404);
        await db.execute("INSERT INTO user_blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", [userId, parsed.data.userId, db.now()]);
        return createResponse({ message: "Member blocked. Their content is hidden both ways." });
      } catch (error) { return failure(error); }
    },
  },
  {
    method: "DELETE", pattern: "^\\/api\\/v1/users/me/blocks/([^/]+)$",
    handler: async (request, env) => {
      try {
        const userId = await requireAuth(request, env);
        const blockedId = new URL(request.url).pathname.split("/").pop()!;
        await new Database(env).execute("DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?", [userId, blockedId]);
        return createResponse({ message: "Member unblocked" });
      } catch (error) { return failure(error); }
    },
  },
  {
    method: "GET", path: "/api/v1/billing/products",
    handler: async (request, env) => {
      try {
        await requireAuth(request, env);
        const products = creditCatalog(env);
        return createResponse({ enabled: products.length > 0, products });
      } catch (error) { return failure(error); }
    },
  },
  {
    method: "GET", path: "/api/v1/billing/purchases",
    handler: async (request, env) => {
      try {
        const userId = await requireAuth(request, env);
        const result = await new Database(env).query(
          "SELECT order_id, product_id, credits, status, created_at FROM play_purchases WHERE user_id = ? ORDER BY created_at DESC LIMIT 100", [userId],
        );
        return createResponse({ items: result.results });
      } catch (error) { return failure(error); }
    },
  },
  {
    method: "POST", path: "/api/v1/billing/verify",
    handler: async (request, env) => {
      let userId = "", locked = false;
      const db = new Database(env);
      try {
        userId = await requireAuth(request, env);
        const parsed = billingVerifySchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return createErrorResponse("VALIDATION_ERROR", "A valid product and purchase token are required", 400);
        const product = creditCatalog(env).find(p => p.productId === parsed.data.productId);
        if (!product) return createErrorResponse("SERVICE_UNAVAILABLE", "Credit purchases are not available on this deployment", 503);
        if (!await acquireOperationLock(db, userId, "billing")) return createErrorResponse("CONFLICT", "A purchase is already being processed. Restore purchases in a moment.", 409);
        locked = true;
        const { productId, purchaseToken } = parsed.data;
        const hash = await sha256Hex(purchaseToken);
        let row = await db.querySingle("SELECT * FROM play_purchases WHERE token_hash = ?", [hash]);
        if (row && row.user_id !== userId) return createErrorResponse("FORBIDDEN", "This purchase belongs to another account", 403);
        if (!row) {
          let purchase;
          try { purchase = await getPlayPurchase(env, productId, purchaseToken); }
          catch (error) {
            const code = error instanceof Error ? error.message : "";
            if (code === "PURCHASE_INVALID") return createErrorResponse("VALIDATION_ERROR", "Google could not validate this purchase", 400);
            return createErrorResponse("SERVICE_UNAVAILABLE", "Google Play verification is temporarily unavailable. Your purchase can be restored.", 503);
          }
          if (purchase.purchaseState !== 0) return createErrorResponse("CONFLICT", "This purchase is pending or was cancelled. No credits have been added.", 409);
          if (purchase.consumptionState !== 0 || !purchase.orderId || purchase.obfuscatedExternalAccountId !== userId ||
              (purchase.productId && purchase.productId !== productId)) {
            return createErrorResponse("VALIDATION_ERROR", "The purchase does not match this account or product", 400);
          }
          await db.execute(
            `INSERT INTO play_purchases (token_hash, user_id, order_id, product_id, credits, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`, [hash, userId, purchase.orderId, productId, product.credits, db.now(), db.now()],
          );
          row = await db.querySingle("SELECT * FROM play_purchases WHERE token_hash = ?", [hash]);
        }
        const alreadyGranted = row!.status === "granted";
        if (!alreadyGranted) {
          const now = db.now();
          // The partial unique index is the final guard. Both the ledger and the
          // balance update are conditional and commit in the same D1 batch.
          await db.batch([
            { sql: "INSERT INTO credit_accounts (id, user_id, balance, created_at, updated_at) VALUES (?, ?, 0, ?, ?) ON CONFLICT(user_id) DO NOTHING", params: [db.uuid(), userId, now, now] },
            { sql: `UPDATE credit_accounts SET balance = balance + ?, updated_at = ? WHERE user_id = ? AND NOT EXISTS
                (SELECT 1 FROM credit_transactions WHERE user_id = ? AND type = 'bonus' AND reference_id = ?)`,
              params: [row!.credits, now, userId, userId, "play:" + row!.order_id] },
            { sql: `INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, reference_id, created_at)
                SELECT ?, ?, 'bonus', ?, balance, 'Google Play credit pack', ?, ? FROM credit_accounts
                WHERE user_id = ? AND NOT EXISTS (SELECT 1 FROM credit_transactions WHERE user_id = ? AND type = 'bonus' AND reference_id = ?)`,
              params: [db.uuid(), userId, row!.credits, "play:" + row!.order_id, now, userId, userId, "play:" + row!.order_id] },
            { sql: "UPDATE play_purchases SET status = 'granted', updated_at = ? WHERE token_hash = ?", params: [now, hash] },
          ]);
          await recordAudit(db, { actorId: userId, action: "billing.grant", resourceType: "play_purchase", resourceId: row!.order_id,
            request, metadata: { productId, credits: row!.credits } }, env);
        }
        // A lost response is safe: restore verifies the same token, sees the
        // existing grant and retries consumption without adding more credits.
        const consumed = await consumePlayPurchase(env, productId, purchaseToken);
        const account = await db.querySingle("SELECT balance FROM credit_accounts WHERE user_id = ?", [userId]);
        return createResponse({ orderId: row!.order_id, productId, credits: row!.credits,
          balance: account?.balance ?? 0, alreadyGranted, consumed });
      } catch (error) { return failure(error, "Purchase verification failed. Use Restore purchases; do not buy again."); }
      finally { if (locked) await releaseOperationLock(db, userId, "billing"); }
    },
  },
];
