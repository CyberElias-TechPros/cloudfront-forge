import { describe, it, expect } from "vitest";
import { authMiddleware, requireAuth, optionalAuth } from "../src/middleware/auth";

describe("auth middleware", () => {
  it("authMiddleware is a function", () => {
    expect(typeof authMiddleware).toBe("function");
  });

  it("requireAuth is a function", () => {
    expect(typeof requireAuth).toBe("function");
  });

  it("optionalAuth is a function", () => {
    expect(typeof optionalAuth).toBe("function");
  });
});
