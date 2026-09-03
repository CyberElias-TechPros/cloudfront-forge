import type { Env, RouteDefinition } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { UserService } from "../services/user";
import { requireAuth } from "../middleware/auth";
import { getUserPermissions } from "../middleware/permissions";
import { Database } from "../lib/database";
import { z } from "zod";

const registerSchema = z.object({
  firebaseUid: z.string().min(1),
  email: z.string().email().nullable().optional(),
  displayName: z.string().min(1).max(50).nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
});

const updateUserSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
});

export const authRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/v1/auth/register",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const body = registerSchema.safeParse(await request.json().catch(() => ({})));
        if (!body.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            body.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }
        const { firebaseUid, email, displayName, photoUrl } = body.data;

        if (!firebaseUid) {
          return createErrorResponse("VALIDATION_ERROR", "Firebase UID is required", 400);
        }

        const userService = new UserService(env);
        const user = await userService.getOrCreateUser(
          firebaseUid,
          email ?? null,
          displayName ?? null,
          photoUrl ?? null,
        );

        if (!user) {
          return createErrorResponse("DATABASE_ERROR", "Failed to create user", 500);
        }

        return createResponse({ message: "User registered successfully", user });
      } catch (error) {
        return createErrorResponse("INTERNAL_ERROR", "Registration failed", 500);
      }
    },
  },
  {
    method: "GET",
    path: "/api/v1/auth/me",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const userService = new UserService(env);
        const user = await userService.getUser(userId);

        if (!user) {
          return createErrorResponse("NOT_FOUND", "User not found", 404);
        }

        return createResponse(user);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message === "AUTH_required" || message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to fetch user", 500);
      }
    },
  },
  {
    method: "PUT",
    path: "/api/v1/auth/profile",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const userId = await requireAuth(request, env);
        const parsedBody = updateUserSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsedBody.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            parsedBody.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }
        const { displayName } = parsedBody.data;

        const userService = new UserService(env);
        await userService.updateUser(userId, {
          display_name: displayName,
        });

        return createResponse({ message: "Profile updated successfully" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message === "AUTH_required" || message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createErrorResponse("INTERNAL_ERROR", "Failed to update profile", 500);
      }
    },
  },
  {
    method: "GET",
    path: "/api/v1/auth/permissions",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const { searchParams } = new URL(request.url);
        const targetUserId = searchParams.get("userId") || (await requireAuth(request, env));
        const permissions = await getUserPermissions(targetUserId, env);

        const db = new Database(env);
        const adminRow = await db.querySingle("SELECT role FROM admin_users WHERE user_id = ?", [
          targetUserId,
        ]);

        return createResponse({
          userId: targetUserId,
          role: adminRow?.role ?? "member",
          permissions,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message === "AUTH_required" || message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createResponse({ permissions: ["read"], role: "member" });
      }
    },
  },
];
