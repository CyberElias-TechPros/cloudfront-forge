import { describe, it, expect } from "vitest";
import { rateLimitMiddleware } from "../src/middleware/rateLimit";

describe("rateLimit middleware", () => {
  it("is a function", () => {
    expect(typeof rateLimitMiddleware).toBe("function");
  });
});
