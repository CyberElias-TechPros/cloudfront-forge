/**
 * Prepares a Chromium executable for the E2E suite on machines where
 * Playwright's browser CDN is unreachable.
 *
 * It uses `@sparticuz/chromium` (the Chromium binary ships inside the npm
 * tarball) plus the Amazon Linux 2023 compatibility libs that the package
 * bundles (`bin/al2023.tar.br`) to satisfy the only three shared libraries a
 * stock Debian lacks: libnspr4, libnss3 and libnssutil3.
 *
 * Writes the resolved paths to /tmp/loopquad-e2e-browser.json, which
 * playwright.config.ts reads at load time. Run automatically by `npm run
 * test:e2e`; safe to re-run (extraction is idempotent).
 */
import { brotliDecompressSync } from "node:zlib";
import { execSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const OUT = "/tmp/loopquad-e2e-browser.json";
const LIB_DIR = "/tmp/loopquad-e2e-libs";
// The three libs a Debian container lacks for Chromium, and their providers in
// the AL2023 tarball.
const REQUIRED = {
  "libnspr4.so": "libnspr4.so",
  "libnss3.so": "libnss3.so",
  "libnssutil3.so": "libnssutil3.so",
  "libplc4.so": "libplc4.so",
  "libplds4.so": "libplds4.so",
};

function log(...args) {
  console.log("[e2e:browser]", ...args);
}

async function extractTarBr(tarBrPath, destDir) {
  mkdirSync(destDir, { recursive: true });
  const tarPath = tarBrPath.replace(/\.br$/, "");
  if (!existsSync(tarPath)) {
    const { createWriteStream } = await import("node:fs");
    const { pipeline } = await import("node:stream/promises");
    await pipeline(
      createReadStream(tarBrPath),
      (await import("node:zlib")).createBrotliDecompress(),
      createWriteStream(tarPath),
    );
  }
  execSync(`tar -xf ${JSON.stringify(tarPath)} -C ${JSON.stringify(destDir)}`, { stdio: "pipe" });
  return destDir;
}

function findFile(dir, name, depth = 0) {
  if (depth > 6) return null;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isFile() && e.name === name) return p;
    if (e.isDirectory()) {
      const found = findFile(p, name, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

async function main() {
  // 1. Chromium executable (extracts /tmp/chromium + fonts).
  const chromium = (await import("@sparticuz/chromium")).default;
  const executablePath = await chromium.executablePath();
  if (!existsSync(executablePath)) throw new Error(`chromium not extracted: ${executablePath}`);
  log("chromium:", executablePath);

  // 2. Compatibility libs (skip if already extracted).
  let missing = Object.keys(REQUIRED).filter((lib) => !existsSync(join(LIB_DIR, lib)));
  if (missing.length) {
    const tarBr = new URL("../node_modules/@sparticuz/chromium/bin/al2023.tar.br", import.meta.url)
      .pathname;
    if (!existsSync(tarBr)) throw new Error(`missing ${tarBr}`);
    log("extracting al2023 compat libs…");
    await extractTarBr(tarBr, LIB_DIR);
    // Flatten nested dirs so LD_LIBRARY_PATH is one entry.
    missing = Object.keys(REQUIRED).filter((lib) => !existsSync(join(LIB_DIR, lib)));
    if (missing.length) {
      for (const lib of missing) {
        const found = findFile(LIB_DIR, lib);
        if (found && found !== join(LIB_DIR, lib)) {
          execSync(`cp ${JSON.stringify(found)} ${JSON.stringify(join(LIB_DIR, lib))}`);
        }
      }
      missing = Object.keys(REQUIRED).filter((lib) => !existsSync(join(LIB_DIR, lib)));
      if (missing.length) throw new Error(`libs still missing: ${missing.join(", ")}`);
    }
  }
  log("compat libs:", LIB_DIR);

  // 3. Sanity: the binary must link against the resolved libs.
  const env = { ...process.env, LD_LIBRARY_PATH: LIB_DIR };
  const check = spawnSync(executablePath, ["--version"], { env, timeout: 15_000 });
  const version = (check.stdout?.toString() || check.stderr?.toString() || "").trim();
  if (check.error || check.status !== 0) {
    throw new Error(`chromium --version failed: ${check.error?.message ?? version}`);
  }
  log("version:", version);

  writeFileSync(OUT, JSON.stringify({ executablePath, libPath: LIB_DIR, version }, null, 2));
  log("wrote", OUT);
}

main().catch((err) => {
  console.error("[e2e:browser] FAILED:", err);
  process.exit(1);
});
