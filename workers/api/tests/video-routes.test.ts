import { describe, it, expect } from "vitest";
import { videoRoutes } from "../src/routes/videos";

describe("video routes", () => {
  it("list videos endpoint exists", () => {
    expect(videoRoutes).toBeDefined();
    expect(videoRoutes.length).toBeGreaterThan(0);
    expect(videoRoutes[0].path).toBe("/api/v1/videos");
    expect(videoRoutes[0].method).toBe("GET");
  });

  it("submit video endpoint exists", () => {
    expect(videoRoutes[1].path).toBe("/api/v1/videos");
    expect(videoRoutes[1].method).toBe("POST");
  });
});
