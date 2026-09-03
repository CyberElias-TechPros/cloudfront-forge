import type { Env, RouteDefinition } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { Database } from "../lib/database";
import { awardXp } from "../lib/xp";
import { recordAudit } from "../lib/audit";
import { z } from "zod";

function getPagination(request: Request): { limit: number; offset: number } {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  return { limit, offset };
}

const createMissionSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().max(1000),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  xpReward: z.number().min(0).default(25),
  creditReward: z.number().min(0).default(10),
  timeEstimateMinutes: z.number().min(1).max(300).default(15),
  chainId: z.string().uuid().optional(),
  chainStep: z.number().min(1).max(3).optional(),
});

const createChainSchema = z.object({
  niche: z.string().min(2).max(50),
  steps: z.array(z.object({
    title: z.string().min(5).max(200),
    description: z.string().max(1000).default(""),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    xpReward: z.number().min(0).default(25),
    creditReward: z.number().min(0).default(10),
  })).min(2).max(5),
});

const completeMissionSchema = z.object({
  completionData: z.string().max(2000).optional(),
});

export const missionRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/v1/missions",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const db = new Database(env);
        const now = new Date().toISOString();
        const { limit, offset } = getPagination(request);

        const totalResult = await db.query(
          `SELECT COUNT(*) as count FROM missions m
           WHERE m.is_active = 1 AND m.valid_from <= ?`,
          [now],
        );

        const result = await db.query(
          `SELECT m.*, 
              CASE WHEN ma.id IS NOT NULL THEN 1 ELSE 0 END as is_assigned,
              CASE WHEN ma.status = 'completed' THEN 1 ELSE 0 END as is_completed
            FROM missions m
            LEFT JOIN mission_assignments ma ON m.id = ma.mission_id AND ma.user_id = ?
            WHERE m.is_active = 1 AND m.valid_from <= ?
            ORDER BY m.xp_reward DESC, m.created_at DESC
            LIMIT ? OFFSET ?`,
          [userId, now, limit, offset],
        );

        return createResponse({
          items: result.results,
          total: totalResult.results[0]?.count ?? 0,
          limit,
          offset,
        });
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
        const adminId = await requireAdmin(request, env);
        const body = (await request.json().catch(() => ({}))) as any;
        const validation = createMissionSchema.safeParse(body);

        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const input = validation.data;
        const db = new Database(env);
        const now = new Date().toISOString();
        const missionId = crypto.randomUUID();

        await db.execute(
          `INSERT INTO missions (id, title, description, difficulty, xp_reward, credit_reward, time_estimate_minutes, is_active, valid_from, chain_id, chain_step, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            missionId,
            input.title,
            input.description ?? null,
            input.difficulty,
            input.xpReward,
            input.creditReward,
            input.timeEstimateMinutes,
            1,
            now,
            input.chainId ?? null,
            input.chainStep ?? null,
            now,
            now,
          ],
        );

        await recordAudit(db, {
          actorId: adminId,
          action: "mission.create",
          resourceType: "mission",
          resourceId: missionId,
          request,
          metadata: { title: input.title, xpReward: input.xpReward },
        });

        return createResponse({ message: "Mission created", missionId }, 201);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        if (error.message === "FORBIDDEN") {
          return createErrorResponse("FORBIDDEN", "Admin access required", 403);
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

        const existing = await db.querySingle(
          "SELECT * FROM mission_assignments WHERE mission_id = ? AND user_id = ? AND status IN ('assigned', 'in_progress')",
          [missionId, userId],
        );

        if (existing) {
          return createResponse(existing);
        }

        const mission = await db.querySingle(
          "SELECT title FROM missions WHERE id = ?",
          [missionId],
        );
        if (!mission) {
          return createErrorResponse("NOT_FOUND", "Mission not found", 404);
        }

        await db.execute(
          "INSERT INTO mission_assignments (id, mission_id, user_id, assigned_at, status) VALUES (?, ?, ?, ?, ?)",
          [crypto.randomUUID(), missionId, userId, now, "assigned"],
        );

        if (mission) {
          await notifyUser(
            db,
            userId,
            "MISSION_ASSIGNED",
            "New Mission Assigned",
            `You have been assigned the mission "${mission.title}".`,
          );
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
        const { limit, offset } = getPagination(request);

        const totalResult = await db.query(
          `SELECT COUNT(*) as count FROM mission_assignments ma
           WHERE ma.user_id = ? AND ma.status IN ('assigned', 'in_progress')`,
          [userId],
        );

        const result = await db.query(
          `SELECT ma.*, m.title, m.description, m.difficulty, m.xp_reward, m.credit_reward, m.time_estimate_minutes,
                  datetime(ma.assigned_at, '+7 days') as due_at
            FROM mission_assignments ma
            JOIN missions m ON ma.mission_id = m.id
            WHERE ma.user_id = ? AND ma.status IN ('assigned', 'in_progress')
            ORDER BY ma.assigned_at ASC
            LIMIT ? OFFSET ?`,
          [userId, limit, offset],
        );

        return createResponse({
          items: result.results,
          total: totalResult.results[0]?.count ?? 0,
          limit,
          offset,
        });
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

        const completion = completeMissionSchema.safeParse(
          await request.json().catch(() => ({})),
        );
        if (!completion.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            completion.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const db = new Database(env);
        const now = new Date().toISOString();

        const assignment = await db.querySingle(
          "SELECT ma.*, m.xp_reward, m.credit_reward FROM mission_assignments ma JOIN missions m ON ma.mission_id = m.id WHERE ma.id = ? AND ma.user_id = ?",
          [assignmentId, userId],
        );

        if (!assignment) {
          return createErrorResponse("NOT_FOUND", "Assignment not found", 404);
        }

        // Claim verification: rewards are paid out exactly once. Reject
        // terminal states up front, then take an atomic claim lock — only a
        // single concurrent request can transition the row to 'completed'.
        if (assignment.status === "completed" || assignment.status === "skipped") {
          return createErrorResponse(
            "CONFLICT",
            `Mission already ${assignment.status} — rewards can only be claimed once`,
            409,
          );
        }

        const claimLock = await db.execute(
          "UPDATE mission_assignments SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status IN ('assigned', 'in_progress')",
          [now, now, assignmentId, userId],
        );
        if (!claimLock.success || claimLock.meta?.changes !== 1) {
          return createErrorResponse(
            "CONFLICT",
            "Mission already completed — rewards can only be claimed once",
            409,
          );
        }

        // Persist all reward writes as one atomic batch so a mid-way failure
        // can never leave the ledger partially updated.
        const creditAccount = await db.querySingle(
          "SELECT balance FROM credit_accounts WHERE user_id = ?",
          [userId],
        );
        const balanceAfter =
          ((creditAccount?.balance as number | undefined) ?? 0) + assignment.credit_reward;

        // XP goes through the shared awarder so `level` is recomputed on the
        // canonical curve (the old upsert left `level` frozen at 1 forever).
        const xpState = await awardXp(db, userId, assignment.xp_reward ?? 0, now);

        const statements: Array<{ sql: string; params: unknown[] }> = [
          {
            sql: "INSERT INTO xp_transactions (id, user_id, amount, type, description, created_at) VALUES (?, ?, ?, 'mission', 'Completed mission', ?)",
            params: [db.uuid(), userId, assignment.xp_reward, now],
          },
          {
            sql: `INSERT INTO credit_accounts (id, user_id, balance, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?, updated_at = ?`,
            params: [
              db.uuid(),
              userId,
              assignment.credit_reward,
              now,
              now,
              assignment.credit_reward,
              now,
            ],
          },
          {
            sql: "INSERT INTO credit_transactions (id, user_id, type, amount, balance_after, description, created_at) VALUES (?, ?, 'earned', ?, ?, 'Mission completed', ?)",
            params: [db.uuid(), userId, assignment.credit_reward, balanceAfter, now],
          },
          {
            sql: "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, 'MISSION_COMPLETED', 'Mission Completed!', ?, ?)",
            params: [
              db.uuid(),
              userId,
              `You completed "${assignment.title}" and earned ${assignment.xp_reward} XP and ${assignment.credit_reward} credits.`,
              now,
            ],
          },
        ];
        const batchOk = await db.batch(statements);
        if (!batchOk) {
          throw new Error("Failed to record mission rewards");
        }

        await recordAudit(
          db,
          {
            actorId: userId,
            action: "mission.complete",
            resourceType: "mission_assignment",
            resourceId: assignmentId,
            request,
            metadata: {
              xpEarned: assignment.xp_reward,
              creditsEarned: assignment.credit_reward,
              ...(completion.data.completionData
                ? { completionData: completion.data.completionData.slice(0, 500) }
                : {}),
            },
          },
          env,
        );

        return createResponse({
          message: "Mission completed!",
          xpEarned: assignment.xp_reward,
          creditsEarned: assignment.credit_reward,
          level: xpState.level,
          totalXp: xpState.totalXp,
        });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to complete mission", 500);
      }
    },
  },
  {
    method: "POST",
    pattern: "^\\/api\\/v1/missions/assignments/([^/]+)/skip$",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const url = new URL(request.url);
        const parts = url.pathname.split("/");
        const assignmentId = parts[5];

        const db = new Database(env);
        const assignment = await db.querySingle(
          "SELECT * FROM mission_assignments WHERE id = ? AND user_id = ?",
          [assignmentId, userId],
        );

        if (!assignment) {
          return createErrorResponse("NOT_FOUND", "Assignment not found", 404);
        }

        if (assignment.status === "completed" || assignment.status === "skipped") {
          return createResponse({ message: "Already completed or skipped" });
        }

        await db.execute("UPDATE mission_assignments SET status = 'skipped', updated_at = ? WHERE id = ?", [
          new Date().toISOString(),
          assignmentId,
        ]);

        return createResponse({ message: "Mission skipped" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to skip mission", 500);
      }
    },
  },
  {
    method: "POST",
    path: "/api/v1/missions/chain",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const adminId = await requireAdmin(request, env);
        const body = (await request.json().catch(() => ({}))) as any;
        const validation = createChainSchema.safeParse(body);

        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const db = new Database(env);
        const now = new Date().toISOString();
        const chainId = crypto.randomUUID();
        const missionIds: string[] = [];

        for (let i = 0; i < validation.data.steps.length; i++) {
          const step = validation.data.steps[i];
          const missionId = crypto.randomUUID();
          missionIds.push(missionId);
          await db.execute(
            `INSERT INTO missions (id, title, description, difficulty, xp_reward, credit_reward, time_estimate_minutes, is_active, valid_from, chain_id, chain_step, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              missionId,
              `[${validation.data.niche}] ${step.title}`,
              step.description,
              step.difficulty,
              step.xpReward,
              step.creditReward,
              15,
              1,
              now,
              chainId,
              i + 1,
              now,
              now,
            ],
          );
        }

        await recordAudit(db, {
          actorId: adminId,
          action: "mission_chain.create",
          resourceType: "mission_chain",
          resourceId: chainId,
          request,
          metadata: { niche: validation.data.niche, steps: validation.data.steps.length },
        });

        return createResponse({
          message: "Mission chain created",
          chainId,
          missions: missionIds,
          steps: validation.data.steps.length,
        }, 201);
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to create chain", 500);
      }
    },
  },
];

async function notifyUser(db: Database, userId: string, type: string, title: string, message: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    "INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [db.uuid(), userId, type, title, message, now],
  );
}
