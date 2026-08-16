import type { Env } from "../types";
import { Database } from "../lib/database";

export type Permission =
  | "read"
  | "write"
  | "admin"
  | "moderate"
  | "manage_users"
  | "manage_communities"
  | "manage_videos"
  | "manage_reviews"
  | "manage_missions"
  | "view_analytics";

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: [
    "read",
    "write",
    "admin",
    "moderate",
    "manage_users",
    "manage_communities",
    "manage_videos",
    "manage_reviews",
    "manage_missions",
    "view_analytics",
  ],
  admin: [
    "read",
    "write",
    "admin",
    "moderate",
    "manage_communities",
    "manage_videos",
    "manage_reviews",
    "manage_missions",
    "view_analytics",
  ],
  moderator: ["read", "write", "moderate", "manage_videos", "manage_reviews"],
  member: ["read", "write"],
};

export function rolePermissions(role: string): string[] {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.member;
}

export async function getUserPermissions(userId: string, env: Env): Promise<Permission[]> {
  const db = new Database(env);

  const adminRow = await db.querySingle("SELECT role FROM admin_users WHERE user_id = ?", [userId]);

  const role = adminRow?.role ?? "member";
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.member;
}

export function hasPermission(
  userPermissions: Permission[],
  required: Permission | Permission[],
): boolean {
  const requiredPermissions = Array.isArray(required) ? required : [required];
  return requiredPermissions.some((p) => userPermissions.includes(p));
}

export async function requirePermission(
  userId: string,
  required: Permission | Permission[],
  env: Env,
): Promise<void> {
  const permissions = await getUserPermissions(userId, env);
  if (!hasPermission(permissions, required)) {
    throw new Error("FORBIDDEN");
  }
}
