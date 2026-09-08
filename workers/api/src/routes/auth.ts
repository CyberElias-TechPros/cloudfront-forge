import type { Env, RouteDefinition } from "../types";
import { createResponse, createErrorResponse } from "../middleware/errorHandler";
import { UserService } from "../services/user";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { getUserPermissions } from "../middleware/permissions";
import { Database } from "../lib/database";
import { z } from "zod";

// `firebaseUid` is accepted for backwards compatibility with older clients but
// is deliberately *ignored*: the caller's identity comes exclusively from the
// verified Firebase ID token on the Authorization header. Accepting a
// client-supplied uid let anyone create rows for (or read the profiles of)
// arbitrary accounts.
const registerSchema = z.object({
  firebaseUid: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  displayName: z.string().min(1).max(50).nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
});

const updateUserSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
});

const isAuthError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : "";
  return message === "AUTH_required" || message === "AUTH_TOKEN_INVALID";
};

function authErrorResponse(error: unknown): Response | null {
  if (isAuthError(error)) {
    return createErrorResponse("AUTH_REQUIRED", "Authentication required", 401);
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return createErrorResponse("FORBIDDEN", "Access denied", 403);
  }
  return null;
}

export const authRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/v1/auth/register",
    handler: async (request: Request, env: Env): Promise<Response> => {
      try {
        // The token is verified first: the row is created (when missing) or
        // looked up from the *verified* firebase_uid, never from the body.
        const userId = await requireAuth(request, env);

        const body = registerSchema.safeParse(await request.json().catch(() => ({})));
        if (!body.success) {
          return createErrorResponse(
            "VALIDATION_ERROR",
            body.error.errors.map((e) => e.message).join(", "),
            400,
          );
        }
        const { displayName, photoUrl } = body.data;

        const userService = new UserService(env);
        let user = await userService.getUser(userId);

        if (!user) {
          return createErrorResponse("NOT_FOUND", "User not found", 404);
        }

        // Seed the profile from Google only while the fields are still empty:
        // identity comes from the verified token and display data is just a
        // first-login default, so a name the member later sets in-app is never
        // clobbered by the next sign-in.
        const updates: Record<string, unknown> = {};
        if (displayName !== undefined && !user.display_name) {
          updates.display_name = displayName;
        }
        if (photoUrl !== undefined && !user.photo_url) {
          updates.photo_url = photoUrl;
        }
        if (Object.keys(updates).length > 0) {
          await userService.updateUser(userId, updates);
          user = await userService.getUser(userId);
        }

        return createResponse({ message: "User registered successfully", user });
      } catch (error) {
        return (
          authErrorResponse(error) ??
          createErrorResponse("INTERNAL_ERROR", "Registration failed", 500)
        );
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
        if (isAuthError(error)) {
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
        // Only touch fields that were actually supplied: passing an undefined
        // value through updateUser would bind SQL NULL and wipe the column.
        const updates: Record<string, unknown> = {};
        if (displayName !== undefined) {
          updates.display_name = displayName;
        }
        await userService.updateUser(userId, updates);

        return createResponse({ message: "Profile updated successfully" });
      } catch (error) {
        if (isAuthError(error)) {
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
      // Members may read only their own role/permissions. Looking up another
      // member (or probing who is an admin) requires an admin role — the
      // previous version answered for *any* userId with no authentication at
      // all and leaked admin membership.
      try {
        const requesterId = await requireAuth(request, env);

        const { searchParams } = new URL(request.url);
        const targetUserId = searchParams.get("userId") ?? requesterId;

        if (targetUserId !== requesterId) {
          await requireAdmin(request, env); // throws FORBIDDEN for non-admins
        }

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
        return (
          authErrorResponse(error) ??
          createErrorResponse("INTERNAL_ERROR", "Failed to read permissions", 500)
        );
      }
    },
  },
];
