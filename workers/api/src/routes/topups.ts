import { z } from "zod";
import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { Database } from "../lib/database";

// Payout account for naira point purchases (bank transfer).
export const NGN_BANK_DETAILS = {
  accountName: "Delgra Ltd",
  accountNumber: "6674684361",
  bankName: "Moniepoint MFB",
} as const;

// Fixed credit packs. Base rate is ~₦100/credit with a volume bonus on
// larger packs. Kept deliberately affordable: the biggest pack is capped at
// ₦10,000 so entry stays cheap and more members keep the site active.
export const TOPUP_TIERS = [
  { id: "starter", name: "Starter", ngn: 1000, credits: 10, bonus: 0 },
  { id: "builder", name: "Builder", ngn: 2500, credits: 27, bonus: 2 },
  { id: "creator", name: "Creator", ngn: 5000, credits: 55, bonus: 5 },
  { id: "studio", name: "Studio", ngn: 10000, credits: 110, bonus: 10 },
] as const;

const tierById: Record<string, (typeof TOPUP_TIERS)[number]> = Object.fromEntries(
  TOPUP_TIERS.map((t) => [t.id, t]),
);

const requestSchema = z.object({
  tierId: z.string().min(1).max(32),
  transferReference: z
    .string()
    .trim()
    .min(4, "Transfer reference is too short")
    .max(64)
    .regex(
      /^[A-Za-z0-9\-_/+]+$/,
      "Transfer reference may only contain letters, numbers, dashes, underscores, slashes or plus signs",
    ),
});

const TOPUP_STATUSES = ["pending", "approved", "rejected"] as const;

export const topupRoutes = [
  // GET /topups — NGN catalog: packs, payout account, and whether the caller
  // already has a pending request.
  {
    method: "GET",
    path: "/api/v1/topups",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const pending = await db.querySingle(
          "SELECT id FROM topup_requests WHERE user_id = ? AND status = 'pending'",
          [userId],
        );
        return createResponse({
          tiers: TOPUP_TIERS,
          bank: NGN_BANK_DETAILS,
          pending: !!pending,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch top-up catalog", 500);
      }
    },
  },

  // POST /topups — submit a completed bank transfer for review.
  {
    method: "POST",
    path: "/api/v1/topups",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const body = await request.json().catch(() => ({}));
        const validation = requestSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }
        const tier = tierById[validation.data.tierId];
        if (!tier) {
          return createErrorResponse("VALIDATION_ERROR", "Unknown top-up pack", 400);
        }

        const db = new Database(env);
        const now = new Date().toISOString();

        const pending = await db.querySingle(
          "SELECT id FROM topup_requests WHERE user_id = ? AND status = 'pending'",
          [userId],
        );
        if (pending) {
          return createErrorResponse(
            "CONFLICT",
            "You already have a pending top-up request — it will be reviewed shortly",
            409,
          );
        }

        const id = db.uuid();
        const insert = await db.execute(
          `INSERT INTO topup_requests
             (id, user_id, tier_id, ngn_amount, credits_amount, transfer_reference, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
          [id, userId, tier.id, tier.ngn, tier.credits, validation.data.transferReference, now, now],
        );
        if (!insert.success) {
          // The partial unique index on pending references rejects a
          // duplicate reference with a constraint error.
          return createErrorResponse(
            "CONFLICT",
            "A pending top-up already exists for this transfer reference",
            409,
          );
        }

        const row = await db.querySingle(
          "SELECT * FROM topup_requests WHERE id = ?",
          [id],
        );
        return createResponse({ message: "Top-up submitted for review", request: row }, 201);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to submit top-up", 500);
      }
    },
  },

  // GET /topups/mine — the caller's top-up history.
  {
    method: "GET",
    path: "/api/v1/topups/mine",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const result = await db.query(
          "SELECT * FROM topup_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
          [userId],
        );
        return createResponse({ items: result.results });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch top-ups", 500);
      }
    },
  },

  // GET /admin/topups?status=pending|approved|rejected — admin queue.
  {
    method: "GET",
    path: "/api/v1/admin/topups",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAdmin(request, env);
        const db = new Database(env);
        const status = new URL(request.url).searchParams.get("status") ?? "pending";
        if (!TOPUP_STATUSES.includes(status as (typeof TOPUP_STATUSES)[number])) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            `status must be one of: ${TOPUP_STATUSES.join(", ")}`,
            400,
          );
        }
        const result = await db.query(
          `SELECT t.*, u.display_name, u.email
           FROM topup_requests t
           LEFT JOIN users u ON u.id = t.user_id
           WHERE t.status = ?
           ORDER BY t.created_at DESC
           LIMIT 100`,
          [status],
        );
        return createResponse({ items: result.results });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch top-ups", 500);
      }
    },
  },

  // POST /admin/topups/:id/approve — issue the credits.
  {
    method: "POST",
    pattern: "^\\/api\\/v1/admin/topups/([^/]+)/approve$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const adminId = await requireAdmin(request, env);
        const topupId = new URL(request.url).pathname.split("/")[5] ?? "";
        const db = new Database(env);
        const now = new Date().toISOString();

        const topup = await db.querySingle(
          "SELECT * FROM topup_requests WHERE id = ?",
          [topupId],
        );
        if (!topup) {
          return createErrorResponse("NOT_FOUND", "Top-up not found", 404);
        }

        // Atomic review lock: only the first approve/reject can transition
        // a pending request.
        const lock = await db.execute(
          "UPDATE topup_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
          [adminId, now, now, topupId],
        );
        if (!lock.success || lock.meta?.changes !== 1) {
          return createErrorResponse("CONFLICT", "Top-up already reviewed", 409);
        }

        const balanceRow = await db.querySingle(
          "SELECT balance FROM credit_accounts WHERE user_id = ?",
          [topup.user_id],
        );
        const balanceAfter =
          ((balanceRow?.balance as number | undefined) ?? 0) + topup.credits_amount;

        const batchOk = await db.batch([
          {
            sql: `INSERT INTO credit_accounts (id, user_id, balance, created_at, updated_at)
                  VALUES (?, ?, 0, ?, ?)
                  ON CONFLICT(user_id) DO NOTHING`,
            params: [db.uuid(), topup.user_id, now, now],
          },
          {
            sql: "UPDATE credit_accounts SET balance = balance + ?, updated_at = ? WHERE user_id = ?",
            params: [topup.credits_amount, now, topup.user_id],
          },
          {
            sql: `INSERT INTO credit_transactions
                  (id, user_id, type, amount, balance_after, description, reference_id, created_at)
                  VALUES (?, ?, 'admin', ?, ?, ?, ?, ?)`,
            params: [
              db.uuid(),
              topup.user_id,
              topup.credits_amount,
              balanceAfter,
              `NGN top-up (ref: ${topup.transfer_reference})`,
              topupId,
              now,
            ],
          },
          {
            sql: `INSERT INTO notifications
                  (id, user_id, type, title, message, created_at)
                  VALUES (?, ?, 'TOPUP_APPROVED', 'Top-up approved', ?, ?)`,
            params: [
              db.uuid(),
              topup.user_id,
              `Your \u20a6${topup.ngn_amount.toLocaleString()} transfer was verified — ${topup.credits_amount} credits added.`,
              now,
            ],
          },
        ]);
        if (!batchOk) {
          throw new Error("Failed to credit approved top-up");
        }

        const balanceRowAfter = await db.querySingle(
          "SELECT balance FROM credit_accounts WHERE user_id = ?",
          [topup.user_id],
        );
        return createResponse({
          message: "Top-up approved and credits issued",
          credits: topup.credits_amount,
          balance: balanceRowAfter?.balance ?? 0,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to approve top-up", 500);
      }
    },
  },

  // POST /admin/topups/:id/reject — decline the transfer.
  {
    method: "POST",
    pattern: "^\\/api\\/v1/admin/topups/([^/]+)/reject$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const adminId = await requireAdmin(request, env);
        const topupId = new URL(request.url).pathname.split("/")[5] ?? "";
        const body = (await request.json().catch(() => ({}))) as any;
        const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
        const db = new Database(env);
        const now = new Date().toISOString();

        const topup = await db.querySingle(
          "SELECT * FROM topup_requests WHERE id = ?",
          [topupId],
        );
        if (!topup) {
          return createErrorResponse("NOT_FOUND", "Top-up not found", 404);
        }

        const lock = await db.execute(
          "UPDATE topup_requests SET status = 'rejected', reject_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
          [reason || null, adminId, now, now, topupId],
        );
        if (!lock.success || lock.meta?.changes !== 1) {
          return createErrorResponse("CONFLICT", "Top-up already reviewed", 409);
        }

        await db.execute(
          `INSERT INTO notifications (id, user_id, type, title, message, created_at)
           VALUES (?, ?, 'TOPUP_REJECTED', 'Top-up rejected', ?, ?)`,
          [
            db.uuid(),
            topup.user_id,
            reason
              ? `Your \u20a6${topup.ngn_amount.toLocaleString()} top-up was not credited: ${reason}`
              : `Your \u20a6${topup.ngn_amount.toLocaleString()} top-up was not credited. Please contact support.`,
            now,
          ],
        );

        return createResponse({ message: "Top-up rejected" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to reject top-up", 500);
      }
    },
  },
];
