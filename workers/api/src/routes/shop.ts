import { z } from "zod";
import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";

const BOOST_COST = 50;
const FREEZE_COST = 30;
const BOOST_HOURS = 24;

const purchaseSchema = z.object({
  itemType: z.enum(["boost", "streak_freeze"]),
  videoId: z.string().optional(),
});

export const shopRoutes = [
  {
    method: "GET",
    path: "/api/v1/shop",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAuth(request, env);
        return createResponse({
          items: [
            {
              id: "boost",
              name: "Video Boost",
              description: "Pin your video to the top of the queue for 24 hours.",
              cost: BOOST_COST,
            },
            {
              id: "streak_freeze",
              name: "Streak Freeze",
              description: "Protects your streak through one inactive day. Consumed automatically.",
              cost: FREEZE_COST,
            },
          ],
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch shop", 500);
      }
    },
  },

  {
    method: "POST",
    path: "/api/v1/shop/purchase",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const body = await request.json().catch(() => ({}));
        const validation = purchaseSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }
        if (validation.data.itemType === "boost" && !validation.data.videoId) {
          return createErrorResponse("VALIDATION_ERROR", "videoId is required for boost purchases", 400);
        }

        const db = new Database(env);
        const now = new Date().toISOString();
        const cost = validation.data.itemType === "boost" ? BOOST_COST : FREEZE_COST;

        // Deduct balance atomically; fail if insufficient
        const deduct = await db.execute(
          `UPDATE credit_accounts SET balance = balance - ?, updated_at = ?
           WHERE user_id = ? AND balance >= ?`,
          [cost, now, userId, cost],
        );
        if (!deduct.meta.changes) {
          return createErrorResponse("INSUFFICIENT_CREDITS", `Not enough credits (need ${cost})`, 400);
        }

        await db.execute(
          `INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at)
           VALUES (?, ?, ?, 'spent', ?, ?)`,
          [
            crypto.randomUUID(),
            userId,
            -cost,
            validation.data.itemType === "boost" ? "Video boost" : "Streak freeze",
            now,
          ],
        );
        await db.execute(
          `INSERT INTO credit_purchases (id, user_id, item_type, item_ref, cost_credits, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            userId,
            validation.data.itemType,
            validation.data.videoId ?? null,
            cost,
            now,
          ],
        );

        let boostedUntil: string | null = null;
        if (validation.data.itemType === "boost") {
          boostedUntil = new Date(Date.now() + BOOST_HOURS * 3600 * 1000).toISOString();
          await db.execute(
            `UPDATE videos SET boosted_until = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'active'`,
            [boostedUntil, now, validation.data.videoId, userId],
          );
        } else {
          await db.execute(
            `UPDATE streaks SET streak_freezes = streak_freezes + 1, updated_at = ? WHERE user_id = ?`,
            [now, userId],
          );
        }

        const balanceRow = await db.querySingle(
          "SELECT balance FROM credit_accounts WHERE user_id = ?",
          [userId],
        );

        return createResponse({
          message: "Purchase complete",
          itemType: validation.data.itemType,
          cost,
          boostedUntil,
          balance: balanceRow?.balance ?? 0,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Purchase failed", 500);
      }
    },
  },
];
