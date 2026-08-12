import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { calculateLevel, calculateWeightedScore } from "../lib/utils";

const db = (env: Env) => new Database(env);

export const gamificationRoutes = [
  {
    method: "GET",
    path: "/api/v1/credits",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const database = db(env);

        const account = await database.querySingle(
          "SELECT * FROM credit_accounts WHERE user_id = ?",
          [userId],
        );

        const transactions = await database.query(
          "SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
          [userId],
        );

        const txns = transactions.results as Array<{ amount?: number }>;
        const totalEarned = txns
          .filter((t) => (t.amount ?? 0) > 0)
          .reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const totalSpent = txns
          .filter((t) => (t.amount ?? 0) < 0)
          .reduce((sum, t) => sum + Math.abs(t.amount ?? 0), 0);

        return createResponse({
          balance: account?.balance ?? 0,
          totalEarned,
          totalSpent,
          transactions: transactions.results,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch credits", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/xp",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const database = db(env);

        let xpAccount = await database.querySingle("SELECT * FROM xp_accounts WHERE user_id = ?", [
          userId,
        ]);

        if (!xpAccount) {
          xpAccount = { total_xp: 0, level: 1, xp_to_next_level: 100 };
        }

        const levelInfo = calculateLevel(xpAccount.total_xp);

        const transactions = await database.query(
          "SELECT * FROM xp_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
          [userId],
        );

        return createResponse({
          totalXp: xpAccount.total_xp,
          currentLevel: levelInfo.level,
          xpToNextLevel: levelInfo.xpToNextLevel,
          transactions: transactions.results,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch XP", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/reputation",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const database = db(env);

        const account = await database.querySingle(
          "SELECT * FROM reputation_accounts WHERE user_id = ?",
          [userId],
        );

        const events = await database.query(
          "SELECT * FROM reputation_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
          [userId],
        );

        return createResponse({
          score: account?.score ?? 100,
          events: events.results,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch reputation", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/streaks",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const database = db(env);

        const result = await database.query("SELECT * FROM streaks WHERE user_id = ?", [userId]);

        const rows = result.results as Array<{
          currentStreak?: number;
          longestStreak?: number;
          lastActivityDate?: string;
        }>;
        const currentStreak = rows.reduce((max, r) => Math.max(max, r.currentStreak ?? 0), 0);
        const longestStreak = rows.reduce((max, r) => Math.max(max, r.longestStreak ?? 0), 0);
        const lastActive =
          rows
            .map((r) => r.lastActivityDate)
            .filter((d): d is string => Boolean(d))
            .sort()
            .reverse()[0] ?? new Date().toISOString();

        return createResponse({ currentStreak, longestStreak, lastActive });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch streaks", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/badges",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const database = db(env);

        const result = await database.query(
          `SELECT b.*, ub.earned_at FROM user_badges ub
           JOIN badges b ON ub.badge_id = b.id
           WHERE ub.user_id = ?
           ORDER BY ub.earned_at DESC`,
          [userId],
        );

        return createResponse(result.results);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch badges", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/leaderboards",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const { searchParams } = new URL(request.url);
        const timeframe = searchParams.get("timeframe") ?? "weekly";
        const limit = parseInt(searchParams.get("limit") ?? "20", 10);

        const database = db(env);

        let dateFilter = "";
        if (timeframe === "weekly") {
          dateFilter = "AND xp.created_at >= datetime('now', '-7 days')";
        } else if (timeframe === "monthly") {
          dateFilter = "AND xp.created_at >= datetime('now', '-30 days')";
        }

        const result = await database.query(
          `
          SELECT u.id, u.display_name, u.photo_url,
                 COALESCE(xp.total_xp, 0) as total_xp,
                 COALESCE(c.balance, 0) as credits,
                 COALESCE(r.score, 100) as reputation,
                  ROUND(COALESCE(xp.total_xp, 0) * 0.4 + COALESCE(c.balance, 0) * 0.3 + COALESCE(r.score, 100) * 0.3) as weighted_score
          FROM users u
          LEFT JOIN xp_accounts xp ON xp.user_id = u.id
          LEFT JOIN credit_accounts c ON c.user_id = u.id
          LEFT JOIN reputation_accounts r ON r.user_id = u.id
          WHERE u.deleted_at IS NULL
           ORDER BY weighted_score DESC
           LIMIT ?
         `,
           [limit],
         );

        const ranked = result.results.map((row: Record<string, unknown>, index: number) => ({
          ...row,
          rank: index + 1,
        }));

        return createResponse(ranked);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch leaderboard", 500);
      }
    },
  },
];

export default gamificationRoutes;
