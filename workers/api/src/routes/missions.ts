import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { Database } from "../lib/database";
import { z } from "zod";

const createMissionSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().max(1000),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  xpReward: z.number().min(0).default(25),
  creditReward: z.number().min(0).default(10),
  timeEstimateMinutes: z.number().min(1).max(300).default(15),
});

const completeMissionSchema = z.object({
  completionData: z.string().max(2000).optional(),
});

export const missionRoutes = [
  {
    method: "GET",
    path: "/api/v1/missions",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const now = new Date().toISOString();

        const result = await db.query(
          `SELECT m.*, 
             CASE WHEN ma.id IS NOT NULL THEN 1 ELSE 0 END as is_assigned,
             CASE WHEN ma.status = 'completed' THEN 1 ELSE 0 END as is_completed
           FROM missions m
           LEFT JOIN mission_assignments ma ON m.id = ma.mission_id AND ma.user_id = ?
           WHERE m.is_active = 1 AND m.valid_from <= ?
           ORDER BY m.xp_reward DESC, m.created_at DESC
           LIMIT 20`,
          [userId, now],
        );

        return createResponse(result.results);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch missions", 500);
      }
    },
  },

  {
    method: "POST",
    path: "/api/v1/missions",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        await requireAuth(request, env);
        const body = (await request.json().catch(() => ({}))) as any;
        const validation = createMissionSchema.safeParse(body);

        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const db = new Database(env);
        const now = new Date().toISOString();

        await db.execute(
          `INSERT INTO missions (id, title, description, difficulty, xp_reward, credit_reward, time_estimate_minutes, is_active, valid_from, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            body.title,
            body.description ?? null,
            body.difficulty,
            body.xpReward,
            body.creditReward,
            body.timeEstimateMinutes,
            1,
            now,
            now,
            now,
          ],
        );

        return createResponse({ message: "Mission created" }, 201);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to create mission", 500);
      }
    },
  },

  {
    method: "POST",
    pattern: "^\\/api\\/v1/missions/([^/]+)/assign$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const url = new URL(request.url);
        const parts = url.pathname.split("/");
        const missionId = parts[4];

        const db = new Database(env);
        const now = new Date().toISOString();

        // Check if already assigned
        const existing = await db.querySingle(
          "SELECT * FROM mission_assignments WHERE mission_id = ? AND user_id = ? AND status IN ('assigned', 'in_progress')",
          [missionId, userId],
        );

        if (existing) {
          return createResponse(existing);
        }

        const result = await db.execute(
          "INSERT INTO mission_assignments (id, mission_id, user_id, assigned_at, status) VALUES (?, ?, ?, ?, ?)",
          [crypto.randomUUID(), missionId, userId, now, "assigned"],
        );

        if (!result.success) {
          return createErrorResponse("DATABASE_ERROR", "Failed to assign mission", 500);
        }

        return createResponse({ message: "Mission assigned" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to assign mission", 500);
      }
    },
  },

  {
    method: "GET",
    path: "/api/v1/missions/assignments",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);

        const result = await db.query(
          `SELECT ma.*, m.title, m.description, m.difficulty, m.xp_reward, m.credit_reward, m.time_estimate_minutes
            FROM mission_assignments ma
            JOIN missions m ON ma.mission_id = m.id
            WHERE ma.user_id = ? AND ma.status IN ('assigned', 'in_progress')
            ORDER BY ma.assigned_at ASC
            LIMIT 20`,
          [userId],
        );

        return createResponse(result.results);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch assignments", 500);
      }
    },
  },

  {
    method: "POST",
    pattern: "^\\/api\\/v1/missions/assignments/([^/]+)/complete$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const url = new URL(request.url);
        const parts = url.pathname.split("/");
        const assignmentId = parts[5];

        const body = (await request.json().catch(() => ({}))) as any;

        const db = new Database(env);
        const now = new Date().toISOString();

        // Get mission details before completing
        const assignment = await db.querySingle(
          "SELECT ma.*, m.xp_reward, m.credit_reward FROM mission_assignments ma JOIN missions m ON ma.mission_id = m.id WHERE ma.id = ? AND ma.user_id = ?",
          [assignmentId, userId],
        );

        if (!assignment) {
          return createErrorResponse("NOT_FOUND", "Assignment not found", 404);
        }

        await db.execute(
          "UPDATE mission_assignments SET status = 'completed', completed_at = ? WHERE id = ?",
          [now, assignmentId],
        );

        // Award XP
        const xpResult = await db.execute(
          "INSERT INTO xp_transactions (id, user_id, amount, type, description, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          [crypto.randomUUID(), userId, assignment.xp_reward, "mission", "Completed mission", now],
        );

        // Update user XP
        const xpAccount = await db.querySingle("SELECT * FROM xp_accounts WHERE user_id = ?", [
          userId,
        ]);
        if (xpAccount) {
          await db.execute(
            "UPDATE xp_accounts SET total_xp = total_xp + ?, updated_at = ? WHERE user_id = ?",
            [assignment.xp_reward, now, userId],
          );
        } else {
          await db.execute(
            "INSERT INTO xp_accounts (id, user_id, total_xp, level, xp_to_next_level, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [crypto.randomUUID(), userId, assignment.xp_reward, 1, 100, now, now],
          );
        }

        // Award credits
        const creditResult = await db.execute(
          "INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          [
            crypto.randomUUID(),
            userId,
            assignment.credit_reward,
            "earned",
            "Mission completed",
            now,
          ],
        );

        const creditAccount = await db.querySingle(
          "SELECT * FROM credit_accounts WHERE user_id = ?",
          [userId],
        );
        if (creditAccount) {
          await db.execute(
            "UPDATE credit_accounts SET balance = balance + ?, updated_at = ? WHERE user_id = ?",
            [assignment.credit_reward, now, userId],
          );
        } else {
          await db.execute(
            "INSERT INTO credit_accounts (id, user_id, balance, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            [crypto.randomUUID(), userId, assignment.credit_reward, now, now],
          );
        }

        // Create notification
        await db.execute(
          "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          [
            crypto.randomUUID(),
            userId,
            "MISSION_COMPLETED",
            "Mission Completed!",
            `You completed "${assignment.title}" and earned ${assignment.xp_reward} XP and ${assignment.credit_reward} credits.`,
            now,
          ],
        );

        return createResponse({
          message: "Mission completed!",
          xpEarned: assignment.xp_reward,
          creditsEarned: assignment.credit_reward,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to complete mission", 500);
      }
    },
  },
];
