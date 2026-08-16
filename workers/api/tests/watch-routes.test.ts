import { describe, it, expect } from "vitest";
import { watchRoutes } from "../src/routes/watch";

describe("watch routes", () => {
  it("submit watch endpoint exists", () => {
    expect(watchRoutes).toBeDefined();
    expect(watchRoutes.length).toBe(1);
    expect(watchRoutes[0].path).toBe("/api/v1/watch");
    expect(watchRoutes[0].method).toBe("POST");
  });
});
