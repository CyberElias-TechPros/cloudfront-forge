import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { ensureDailyQuests } from "../lib/quests";
import { calculateLevel, calculateWeightedScore } from "../lib/utils";

const db = (env: Env) => new Database(env);

function getPagination(request: Request): { limit: number; offset: number } {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  return { limit, offset };
}

export const gamificationRoutes = [
  {
    method: "GET",
    path: "/api/v1/daily-quests",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const quests = await ensureDailyQuests(env, userId);
        return createResponse({ items: quests, date: new Date().toISOString().slice(0, 10) });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch daily quests", 500);
      }
    },
  },

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
          current_streak?: number;
          longest_streak?: number;
          last_activity_date?: string;
        }>;
        const currentStreak = rows.reduce((max, r) => Math.max(max, r.current_streak ?? 0), 0);
        const longestStreak = rows.reduce((max, r) => Math.max(max, r.longest_streak ?? 0), 0);
        const lastActive =
          rows
            .map((r) => r.last_activity_date)
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
        const cohort = searchParams.get("cohort"); // rookie | rising | veteran | null (all)
        const { limit, offset } = getPagination(request);

        const database = db(env);

        let dateFilter = "";
        if (timeframe === "weekly") {
          dateFilter = "AND xp.created_at >= datetime('now', '-7 days')";
        } else if (timeframe === "monthly") {
          dateFilter = "AND xp.created_at >= datetime('now', '-30 days')";
        }

        // Cohort tiers by account age: rookie <7d, rising 7-30d, veteran >30d
        let cohortFilter = "";
        if (cohort === "rookie") {
          cohortFilter = "AND u.created_at > datetime('now', '-7 days')";
        } else if (cohort === "rising") {
          cohortFilter = "AND u.created_at <= datetime('now', '-7 days') AND u.created_at > datetime('now', '-30 days')";
        } else if (cohort === "veteran") {
          cohortFilter = "AND u.created_at <= datetime('now', '-30 days')";
        }

        const totalResult = await database.query(
          `SELECT COUNT(*) as count FROM users u WHERE u.deleted_at IS NULL ${cohortFilter}`,
          [],
        );

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
          WHERE u.deleted_at IS NULL ${cohortFilter}
           ORDER BY weighted_score DESC
           LIMIT ? OFFSET ?
         `,
          [limit, offset],
        );

        const items = result.results.map((row: Record<string, unknown>, index: number) => ({
          ...row,
          rank: offset + index + 1,
        }));

        return createResponse({
          items,
          total: totalResult.results[0]?.count ?? 0,
          limit,
          offset,
          cohort: cohort ?? "all",
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch leaderboard", 500);
      }
    },
  },

  {
    method: "POST",
    path: "/api/v1/gamification/daily-bonus",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const database = db(env);
        const today = new Date().toISOString().split("T")[0];

        // Check if bonus already claimed today
        const existing = await database.query(
          "SELECT id FROM credit_transactions WHERE user_id = ? AND description = ? AND DATE(created_at) = ?",
          [userId, "daily_bonus", today],
        );
        if (existing.results.length > 0) {
          return createErrorResponse("CONFLICT", "Daily bonus already claimed today", 409);
        }

        // Get current streak (daily_login type)
        const streak = await database.query(
          "SELECT current_streak FROM streaks WHERE user_id = ? AND streak_type = 'daily_login'",
          [userId],
        );
        const streakCount = streak.results.length > 0
          ? ((streak.results[0] as Record<string, unknown>).current_streak as number ?? 0)
          : 0;

        // Base 5 credits × (1 + streak × 0.1), capped at 3×
        const multiplier = Math.min(1 + streakCount * 0.1, 3);
        const baseCredits = 5;
        const bonusCredits = Math.round(baseCredits * multiplier);

        // Award credits
        const balance = await database.query("SELECT balance FROM credit_accounts WHERE user_id = ?", [userId]);
        if (balance.results.length === 0) {
          return createErrorResponse("NOT_FOUND", "Credit account not found", 404);
        }
        const currentBalance = (balance.results[0] as Record<string, unknown>).balance as number;
        const newId = crypto.randomUUID();
        const now = new Date().toISOString();
        await database.execute(
          "INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, created_at) VALUES (?, ?, 'earned', ?, ?, 'daily_bonus', ?)",
          [newId, userId, bonusCredits, currentBalance + bonusCredits, now],
        );
        await database.execute(
          "UPDATE credit_accounts SET balance = balance + ?, updated_at = ? WHERE user_id = ?",
          [bonusCredits, now, userId],
        );

        return createResponse({
          credits: bonusCredits,
          multiplier: Math.round(multiplier * 100) / 100,
          streak: streakCount,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to claim daily bonus", 500);
      }
    },
  },
];

export default gamificationRoutes;
