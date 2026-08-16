import { describe, it, expect } from "vitest";
import { authRoutes } from "../src/routes/auth.ts";

describe("auth routes", () => {
  it("register endpoint exists", () => {
    expect(authRoutes).toBeDefined();
    expect(authRoutes.length).toBeGreaterThan(0);
    expect(authRoutes[0].path).toBe("/api/v1/auth/register");
    expect(authRoutes[0].method).toBe("POST");
  });

  it("me endpoint exists", () => {
    expect(authRoutes[1].path).toBe("/api/v1/auth/me");
    expect(authRoutes[1].method).toBe("GET");
  });

  it("permissions endpoint exists", () => {
    expect(authRoutes[3].path).toBe("/api/v1/auth/permissions");
    expect(authRoutes[3].method).toBe("GET");
  });
});
