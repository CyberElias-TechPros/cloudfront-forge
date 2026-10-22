/**
 * Contract generator entry point.
 *
 * Run from `workers/api` with `npm run contract:build` (which bundles this file
 * with esbuild and executes it under Node). It writes two committed artefacts:
 *
 *   src/contract/openapi.generated.json   — the OpenAPI 3.1 document served at /openapi.json
 *   src/contract/inventory.generated.json — every route with its auth tier and doc status
 *
 * Nothing here may read the environment or the clock: CI regenerates the files
 * and fails on any diff.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { routes } from "../../src/routes";
import { buildOpenApiDocument, computeCoverage, documentsRoute } from "../../src/contract/openapi";
import { endpoints, systemEndpoints } from "../../src/contract/registry";
import { ERROR_CODES } from "../../src/contract/errors";

/** Output directory; passed by `scripts/build-contract.mjs`, defaults to this folder. */
const outDir = process.argv[2] ?? ".";

const document = buildOpenApiDocument();
const coverage = computeCoverage(routes);

interface InventoryEntry {
  method: string;
  /** Exact path or regex source, exactly as the router matches it. */
  key: string;
  matcher: "path" | "pattern";
  documented: boolean;
  auth: string;
  tag?: string;
  operationId?: string;
  /** OpenAPI path template when documented. */
  path?: string;
}

const routeInventory: InventoryEntry[] = routes.map((route) => {
  const endpoint = endpoints.find((candidate) => documentsRoute(candidate, route));
  return {
    method: route.method,
    key: route.path ?? route.pattern ?? "",
    matcher: route.path !== undefined ? "path" : "pattern",
    documented: Boolean(endpoint),
    auth: endpoint?.auth ?? "undocumented",
    ...(endpoint
      ? { tag: endpoint.tag, operationId: endpoint.operationId, path: endpoint.path }
      : {}),
  };
});

const systemInventory: InventoryEntry[] = systemEndpoints.map((endpoint) => ({
  method: endpoint.route.method,
  key: endpoint.path,
  matcher: "path",
  documented: true,
  auth: endpoint.auth,
  tag: endpoint.tag,
  operationId: endpoint.operationId,
  path: endpoint.path,
}));

const write = (file: string, value: unknown) => {
  writeFileSync(path.join(outDir, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

write("openapi.generated.json", document);
write("inventory.generated.json", {
  generatedBy: "npm run contract:build",
  coverage,
  routes: [...systemInventory, ...routeInventory],
});

const errorCodeCount = Object.keys(ERROR_CODES).length;
// eslint-disable-next-line no-console
console.log(
  `contract: ${coverage.documented}/${coverage.routes} routes documented (${coverage.percent}%), ` +
    `${Object.keys(document.paths).length} OpenAPI paths, ${errorCodeCount} error codes`,
);
