import { describe, it, expect } from "vitest";
import { routes } from "../src/routes";
import { matchesRoute, samplePathFor, findRoute } from "../src/lib/router";

/**
 * Regression guard.
 *
 * `GET/POST /api/v1/admin/topups/:id/proof|approve|reject` shipped with
 * quadruple-escaped regex sources (`^\\\\/api\\\\/v1/...`), so the compiled
 * pattern required a literal backslash and every admin top-up action 404'd.
 * These tests route every declared handler through the real matcher.
 */
describe("route table", () => {
  it("exposes every handler through a reachable path", () => {
    expect(routes.length).toBeGreaterThan(50);
    for (const route of routes) {
      const sample = samplePathFor(route);
      expect(sample, `route ${route.method} ${route.path ?? route.pattern}`).toBeTruthy();
      expect(
        matchesRoute(route, route.method, sample as string),
        `${route.method} ${sample} should match ${route.path ?? route.pattern}`,
      ).toBe(true);
    }
  });

  it("anchors patterns so a path cannot match by substring", () => {
    for (const route of routes) {
      if (!route.pattern) continue;
      expect(route.pattern.startsWith("^"), route.pattern).toBe(true);
      expect(route.pattern.endsWith("$"), route.pattern).toBe(true);
    }
  });

  it("only serves /api/v1 paths", () => {
    for (const route of routes) {
      const sample = samplePathFor(route) as string;
      expect(sample.startsWith("/api/v1/"), sample).toBe(true);
    }
  });

  it("has no duplicate method+path handlers (the first would always win)", () => {
    const seen = new Set<string>();
    for (const route of routes) {
      const key = `${route.method} ${samplePathFor(route)}`;
      expect(seen.has(key), `duplicate route: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("returns undefined for unknown paths and methods", () => {
    expect(findRoute(routes, "GET", "/api/v1/does-not-exist")).toBeUndefined();
    expect(findRoute(routes, "DELETE", "/api/v1/videos")).toBeUndefined();
  });

  it("resolves parameterised routes", () => {
    const approve = findRoute(routes, "POST", "/api/v1/admin/topups/abc-123/approve");
    expect(approve?.pattern).toContain("approve");
    const reject = findRoute(routes, "POST", "/api/v1/admin/topups/abc-123/reject");
    expect(reject?.pattern).toContain("reject");
    const proof = findRoute(routes, "GET", "/api/v1/admin/topups/abc-123/proof");
    expect(proof?.pattern).toContain("proof");
  });
});
