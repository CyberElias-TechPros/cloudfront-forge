import type { Env } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { UserService } from "../services/user";
import { requireAuth } from "../middleware/auth";
import { paginationSchema } from "../middleware/validation";
import { z } from "zod";

const updateUserSchema = z.object({
  displayName: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export const authRoutes = [
  {
    method: "POST",
    path: "/api/v1/auth/register",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        const body = (await request.json().catch(() => ({}))) as any;
        const { firebaseUid, email, displayName, photoUrl } = body;

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
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
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
        const body = (await request.json().catch(() => ({}))) as any;

        const validation = updateUserSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            validation.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }

        const userService = new UserService(env);
        await userService.updateUser(userId, {
          display_name: body.displayName,
        });

        return createResponse({ message: "Profile updated successfully" });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
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
        const userId = searchParams.get("userId") || (await requireAuth(request, env));

        // TODO: fetch user permissions from database
        const permissions = ["read", "write"];

        return createResponse({ userId, permissions });
      } catch (error: any) {
        if (error.message === "AUTH_required" || error.message === "AUTH_TOKEN_INVALID") {
          return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
        }
        return createResponse({ permissions: ["read"] });
      }
    },
  },
];
