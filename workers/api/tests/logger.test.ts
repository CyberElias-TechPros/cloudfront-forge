import { describe, it, expect } from "vitest";
import { createLogger } from "../src/lib/logger";

describe("Logger", () => {
  it("does not throw in development mode", () => {
    const env = { ENVIRONMENT: "development" };
    const logger = createLogger(env as any);
    expect(() => logger.info("test")).not.toThrow();
    expect(() => logger.debug("test")).not.toThrow();
  });

  it("does not throw in production mode", () => {
    const env = { ENVIRONMENT: "production" };
    const logger = createLogger(env as any);
    expect(() => logger.info("test")).not.toThrow();
    expect(() => logger.warn("test")).not.toThrow();
    expect(() => logger.error("test", new Error("fail"))).not.toThrow();
  });
});
