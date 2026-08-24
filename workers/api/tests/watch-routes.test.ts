import { describe, it, expect } from "vitest";
import { watchRoutes } from "../src/routes/watch";

describe("watch routes", () => {
  it("submit watch endpoint exists", () => {
    expect(watchRoutes).toBeDefined();
    expect(watchRoutes.length).toBeGreaterThanOrEqual(1);
    const claim = watchRoutes.find((r) => r.path === "/api/v1/watch" && r.method === "POST");
    expect(claim).toBeDefined();
  });

  it("has start and heartbeat endpoints", () => {
    const start = watchRoutes.find((r) => r.path === "/api/v1/watch/start");
    expect(start).toBeDefined();
    const hb = watchRoutes.find((r) => r.path === "/api/v1/watch/heartbeat");
    expect(hb).toBeDefined();
  });
});
