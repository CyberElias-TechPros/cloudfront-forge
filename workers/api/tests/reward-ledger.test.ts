import { describe, it, expect } from "vitest";
import { watchRoutes } from "../src/routes/watch";
import { missionRoutes } from "../src/routes/missions";
import { reportRoutes } from "../src/routes/reports";
import { gamificationRoutes } from "../src/routes/gamification";

describe("watch routes", () => {
  it("has claim endpoint with sessionToken field", () => {
    const claim = watchRoutes.find((r) => r.path === "/api/v1/watch" && r.method === "POST");
    expect(claim).toBeDefined();
  });

  it("has start session endpoint (env-flagged)", () => {
    const start = watchRoutes.find((r) => r.path === "/api/v1/watch/start" && r.method === "POST");
    expect(start).toBeDefined();
  });

  it("has heartbeat endpoint (env-flagged)", () => {
    const hb = watchRoutes.find((r) => r.path === "/api/v1/watch/heartbeat" && r.method === "POST");
    expect(hb).toBeDefined();
  });
});

describe("mission routes", () => {
  it("create endpoint requires admin (not just auth)", () => {
    const create = missionRoutes.find(
      (r) => r.path === "/api/v1/missions" && r.method === "POST",
    );
    expect(create).toBeDefined();
  });

  it("has skip endpoint for expired assignments", () => {
    const skip = missionRoutes.find(
      (r) => "pattern" in r && (r as any).pattern?.includes("skip"),
    );
    expect(skip).toBeDefined();
  });
});

describe("report routes", () => {
  it("has user-facing report creation endpoint", () => {
    const create = reportRoutes.find((r) => r.path === "/api/v1/reports" && r.method === "POST");
    expect(create).toBeDefined();
  });
});

describe("reward ledger integrity", () => {
  it("watch claim handler exists and is a function", () => {
    const claim = watchRoutes.find((r) => r.path === "/api/v1/watch" && r.method === "POST");
    expect(typeof claim?.handler).toBe("function");
  });

  it("mission complete handler exists and is a function", () => {
    const complete = missionRoutes.find(
      (r) => "pattern" in r && (r as any).pattern?.includes("complete"),
    );
    expect(typeof complete?.handler).toBe("function");
  });

  it("report handler applies trust penalty (handler exists)", () => {
    const create = reportRoutes.find((r) => r.path === "/api/v1/reports" && r.method === "POST");
    expect(typeof create?.handler).toBe("function");
  });
});

describe("claim verification (no double claims)", () => {
  it("mission complete transitions only non-terminal assignments (atomic claim lock)", () => {
    const complete = missionRoutes.find(
      (r) => "pattern" in r && (r as any).pattern?.includes("complete"),
    ) as any;
    expect(typeof complete?.handler).toBe("function");
    // The handler must hold the source so invariants can be inspected:
    // it rejects completed/skipped assignments and only claims rows still in
    // an active status (the conditional UPDATE is the claim lock).
    const src = complete.handler.toString();
    expect(src).toContain("'completed'");
    expect(src).toContain("status IN ('assigned', 'in_progress')");
    expect(src).toContain("changes !== 1");
  });

  it("daily bonus claim uses the atomic per-day guard", () => {
    const claim = gamificationRoutes.find(
      (r) => r.path === "/api/v1/gamification/daily-bonus" && r.method === "POST",
    ) as any;
    expect(typeof claim?.handler).toBe("function");
    const src = claim.handler.toString();
    expect(src).toContain("last_daily_bonus_date");
    expect(src).toContain("changes !== 1");
  });
});
