#!/usr/bin/env node
/**
 * Generate the committed API contract artefacts.
 *
 * The Worker is a Cloudflare-targeted TypeScript project with no Node runtime,
 * so the generator is bundled with esbuild (already present via Vite/Vitest)
 * and executed once under Node. Bundling also means the generator runs against
 * exactly the same source the Worker ships.
 *
 * Usage (from workers/api):
 *   node scripts/build-contract.mjs           # write artefacts
 *   node scripts/build-contract.mjs --check   # fail if committed artefacts are stale
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT_DIR = path.join(ROOT, "src", "contract");
const check = process.argv.includes("--check");

const workDir = mkdtempSync(path.join(tmpdir(), "contract-"));
const bundlePath = path.join(workDir, "generate.mjs");

try {
  await build({
    entryPoints: [path.join(ROOT, "scripts", "contract", "generate.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outfile: bundlePath,
    logLevel: "warning",
    // Keep the bundle self-contained; only Node builtins stay external.
    external: ["node:*"],
  });

  execFileSync(process.execPath, [bundlePath, OUT_DIR], { stdio: "inherit" });

  if (check) {
    const artefacts = ["openapi.generated.json", "inventory.generated.json"].map((file) =>
      path.join("src", "contract", file),
    );
    try {
      execFileSync("git", ["diff", "--exit-code", "--", ...artefacts], {
        cwd: ROOT,
        stdio: "inherit",
      });
    } catch {
      console.error(
        "\ncontract: committed artefacts are stale. Run `npm run contract:build` and commit the result.",
      );
      process.exit(1);
    }
    console.log("contract: artefacts are up to date");
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
