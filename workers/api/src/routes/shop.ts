import { z } from "zod";
import type { Env, RouteDefinition } from "../types";
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

export const shopRoutes: RouteDefinition[] = [
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

        // Validate everything that can make the purchase meaningless *before*
        // taking the credits: the old order deducted first and only then tried
        // to apply the effect, so boosting a video you do not own (or one that
        // is no longer active) charged the member for nothing.
        if (validation.data.itemType === "boost") {
          const video = await db.querySingle(
            "SELECT id FROM videos WHERE id = ? AND user_id = ? AND status = 'active'",
            [validation.data.videoId, userId],
          );
          if (!video) {
            return createErrorResponse(
              "NOT_FOUND",
              "Video not found or no longer active",
              404,
            );
          }
        }

        const account = await db.querySingle(
          "SELECT balance FROM credit_accounts WHERE user_id = ?",
          [userId],
        );
        const balance = Number(account?.balance ?? 0);
        if (balance < cost) {
          return createErrorResponse("INSUFFICIENT_CREDITS", `Not enough credits (need ${cost})`, 400);
        }
        const balanceAfter = balance - cost;

        // Spend and effect are written in one transaction so a failure can
        // never leave credits taken without the purchase (or vice versa).
        const statements: { sql: string; params: unknown[] }[] = [
          {
            sql: `UPDATE credit_accounts SET balance = balance - ?, updated_at = ?
                  WHERE user_id = ? AND balance >= ?`,
            params: [cost, now, userId, cost],
          },
          {
            sql: `INSERT INTO credit_transactions (id, user_id, amount, type, description, balance_after, created_at)
                  VALUES (?, ?, ?, 'spent', ?, ?, ?)`,
            params: [
              crypto.randomUUID(),
              userId,
              -cost,
              validation.data.itemType === "boost" ? "Video boost" : "Streak freeze",
              balanceAfter,
              now,
            ],
          },
          {
            sql: `INSERT INTO credit_purchases (id, user_id, item_type, item_ref, cost_credits, created_at)
                  VALUES (?, ?, ?, ?, ?, ?)`,
            params: [
              crypto.randomUUID(),
              userId,
              validation.data.itemType,
              validation.data.videoId ?? null,
              cost,
              now,
            ],
          },
        ];

        let boostedUntil: string | null = null;
        if (validation.data.itemType === "boost") {
          boostedUntil = new Date(Date.now() + BOOST_HOURS * 3600 * 1000).toISOString();
          statements.push({
            sql: "UPDATE videos SET boosted_until = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'active'",
            params: [boostedUntil, now, validation.data.videoId, userId],
          });
        } else {
          const streakRow = await db.querySingle(
            "SELECT id FROM streaks WHERE user_id = ? AND streak_type = 'daily_login'",
            [userId],
          );
          if (streakRow) {
            statements.push({
              sql: "UPDATE streaks SET streak_freezes = streak_freezes + 1, updated_at = ? WHERE user_id = ? AND streak_type = 'daily_login'",
              params: [now, userId],
            });
          } else {
            statements.push({
              sql: `INSERT INTO streaks (id, user_id, current_streak, longest_streak, streak_type, streak_freezes, created_at, updated_at)
                    VALUES (?, ?, 0, 0, 'daily_login', 1, ?, ?)`,
              params: [crypto.randomUUID(), userId, now, now],
            });
          }
        }

        await db.batch(statements);

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
