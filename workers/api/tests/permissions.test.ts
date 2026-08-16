import { describe, it, expect } from "vitest";
import {
  rolePermissions,
  hasPermission,
  requirePermission,
  getUserPermissions,
} from "../src/middleware/permissions";

describe("Permissions", () => {
  it("returns correct permissions for super_admin", () => {
    const perms = rolePermissions("super_admin");
    expect(perms).toContain("admin");
    expect(perms).toContain("manage_users");
  });

  it("returns correct permissions for member", () => {
    const perms = rolePermissions("member");
    expect(perms).toEqual(["read", "write"]);
  });

  it("returns member permissions for unknown role", () => {
    const perms = rolePermissions("unknown");
    expect(perms).toEqual(["read", "write"]);
  });

  it("hasPermission returns true when user has required permission", () => {
    expect(hasPermission(["read", "write"], "write")).toBe(true);
  });

  it("hasPermission returns true when user has one of multiple required permissions", () => {
    expect(hasPermission(["read"], ["write", "read"])).toBe(true);
  });

  it("hasPermission returns false when user lacks required permission", () => {
    expect(hasPermission(["read"], "admin")).toBe(false);
  });
});
