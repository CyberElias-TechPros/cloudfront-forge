/**
 * Contract integrity tests (PLAT-003/005).
 *
 * The contract is only worth having if it cannot silently disagree with the
 * code. These tests fail when:
 *  - a registry entry documents a route that does not exist (or vice versa),
 *  - two operations share an id,
 *  - a path template and its route pattern disagree,
 *  - the committed JSON differs from what the generator produces now.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { routes } from "../../src/routes";
import { endpoints, systemEndpoints, TAGS } from "../../src/contract/registry";
import { buildOpenApiDocument, computeCoverage, documentsRoute } from "../../src/contract/openapi";
import { ERROR_CODES } from "../../src/contract/errors";

const CONTRACT_DIR = path.resolve(__dirname, "../../src/contract");

describe("contract registry", () => {
  it("documents real routes: every entry matches a route in the router table", () => {
    for (const endpoint of endpoints) {
      const match = routes.find((route) => documentsRoute(endpoint, route));
      expect(
        match,
        `${endpoint.operationId} documents ${endpoint.route.method} ${
          endpoint.route.path ?? endpoint.route.pattern
        }, which is not in the router table`,
      ).toBeDefined();
    }
  });

  it("never documents the same route twice", () => {
    const seen = new Set<string>();
    for (const endpoint of endpoints) {
      const key = `${endpoint.route.method} ${endpoint.route.path ?? endpoint.route.pattern}`;
      expect(seen.has(key), `duplicate contract entry for ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("keeps operation ids unique and camelCase", () => {
    const ids = [...endpoints, ...systemEndpoints].map((endpoint) => endpoint.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][A-Za-z0-9]*$/);
  });

  it("uses declared tags only", () => {
    const declared = new Set<string>(TAGS.map((tag) => tag.name));
    for (const endpoint of [...endpoints, ...systemEndpoints]) {
      expect(
        declared.has(endpoint.tag),
        `${endpoint.operationId} uses unknown tag ${endpoint.tag}`,
      ).toBe(true);
    }
  });

  it("maps every documented path parameter to its route pattern group", () => {
    for (const endpoint of endpoints) {
      const templateParams = [...endpoint.path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
      if (endpoint.route.pattern) {
        const groupCount = new RegExp(`${endpoint.route.pattern}|`).exec("")!.length - 1;
        expect(templateParams.length).toBe(groupCount);
      } else {
        expect(templateParams).toHaveLength(0);
        expect(endpoint.path).toBe(endpoint.route.path);
      }
    }
  });

  it("declares only registered error codes", () => {
    for (const endpoint of endpoints) {
      for (const code of endpoint.errors ?? []) {
        expect(Object.prototype.hasOwnProperty.call(ERROR_CODES, code)).toBe(true);
      }
    }
  });
});

describe("generated OpenAPI document", () => {
  const document = buildOpenApiDocument();

  it("is OpenAPI 3.1 with bearer auth and an error-code enum", () => {
    expect(document.openapi).toBe("3.1.0");
    expect(document.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
    expect(document.components.schemas.ErrorCode.enum.length).toBeGreaterThan(10);
  });

  it("marks public operations without a security requirement", () => {
    expect(document.paths["/health"].get.security).toEqual([]);
    expect(document.paths["/api/v1/watch"].post.security).toEqual([{ bearerAuth: [] }]);
  });

  it("documents request bodies and error statuses for the claim endpoint", () => {
    const operation = document.paths["/api/v1/watch"].post;
    expect(
      operation.requestBody?.content["application/json"].schema.properties.videoId,
    ).toBeDefined();
    expect(Object.keys(operation.responses)).toEqual(
      expect.arrayContaining(["200", "400", "401", "429", "500"]),
    );
  });

  it("matches the committed artefact exactly (no drift)", () => {
    const committed = JSON.parse(
      readFileSync(path.join(CONTRACT_DIR, "openapi.generated.json"), "utf8"),
    ) as unknown;
    expect(document).toEqual(committed);
  });

  it("keeps the committed route inventory in sync with the router", () => {
    const inventory = JSON.parse(
      readFileSync(path.join(CONTRACT_DIR, "inventory.generated.json"), "utf8"),
    ) as { coverage: { routes: number; documented: number } };
    const coverage = computeCoverage(routes);
    expect(inventory.coverage.routes).toBe(coverage.routes);
    expect(inventory.coverage.documented).toBe(coverage.documented);
  });

  it("never lets documented coverage regress", () => {
    // Ratchet: raise this number whenever more endpoints are documented.
    // PLAT-002 finished the job — every route in the router table is now in the
    // contract — so the floor is 100% and the only way to fail is to add a route
    // without documenting it.
    const FLOOR = 100;
    expect(computeCoverage(routes).percent).toBeGreaterThanOrEqual(FLOOR);
  });

  it("documents every route, with nothing left over", () => {
    const coverage = computeCoverage(routes);
    expect(
      coverage.undocumented.map((route) => `${route.method} ${route.key}`),
      "routes missing a registry entry",
    ).toEqual([]);
    expect(coverage.documented).toBe(coverage.routes);
  });

  it("gives every operation a success schema", () => {
    for (const endpoint of [...endpoints, ...systemEndpoints]) {
      expect(endpoint.response, `${endpoint.operationId} has no response schema`).toBeDefined();
    }
  });

  it("uses unique query parameter names per operation", () => {
    for (const endpoint of endpoints) {
      const names = (endpoint.query ?? []).map((param) => param.name);
      expect(new Set(names).size, `${endpoint.operationId} repeats a query parameter`).toBe(
        names.length,
      );
    }
  });

  it("publishes query parameters and media types in the document", () => {
    const leaderboard = document.paths["/api/v1/leaderboards"].get;
    const queryNames = (leaderboard.parameters ?? []).map((param: { name: string }) => param.name);
    expect(queryNames).toEqual(expect.arrayContaining(["timeframe", "cohort"]));

    // Multipart upload and binary/stream responses keep their real media types.
    expect(
      Object.keys(document.paths["/api/v1/topups/proof"].post.requestBody?.content ?? {}),
    ).toEqual(["multipart/form-data"]);
    expect(
      Object.keys(document.paths["/api/v1/admin/topups/{topupId}/proof"].get.responses["200"].content),
    ).toEqual(["image/*"]);
    expect(
      Object.keys(document.paths["/api/v1/ai/chat/stream"].post.responses["200"].content),
    ).toEqual(["text/event-stream"]);
  });

  it("documents path parameters in the same order as the template", () => {
    const operation = document.paths[
      "/api/v1/communities/{communityId}/requests/{requestId}/approve"
    ].post;
    expect(operation.parameters.map((param: { name: string }) => param.name)).toEqual([
      "communityId",
      "requestId",
    ]);
  });

  it("keeps handlers free of inline Zod schemas (PLAT-002)", () => {
    // Every request/response shape must live in `src/contract/schemas` so the
    // contract and the validation cannot diverge. Comments are ignored.
    const routeDir = path.resolve(__dirname, "../../src/routes");
    const offenders: string[] = [];
    for (const file of readdirSync(routeDir)) {
      if (!file.endsWith(".ts")) continue;
      const source = readFileSync(path.join(routeDir, file), "utf8")
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      if (/\bz\.(object|enum|array|record)\(/.test(source)) offenders.push(file);
    }
    expect(offenders, "route files must import their schemas from src/contract/schemas").toEqual([]);
  });
});
