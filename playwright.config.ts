import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke suite: real Chromium against the real stack.
 *
 *   npm run test:e2e
 *
 * Playwright starts both servers itself:
 *   - Vite dev server on :5173 (the SPA, with its /api proxy)
 *   - `wrangler dev` on :8787 (the Worker with local D1/KV/R2)
 *
 * Prerequisites (both handled by `npm run test:e2e`):
 *   - `node e2e/prepare-browser.mjs` resolves a Chromium executable (uses the
 *     @sparticuz/chromium npm tarball when Playwright's CDN is unreachable)
 *   - `workers/api/.dev.vars` with `ENVIRONMENT=development` (copy from
 *     `.env.example`) so dev tokens are accepted
 *   - migrations applied to local D1: `npm --prefix workers/api run db:migrate:local`
 */

interface BrowserSetup {
  executablePath?: string;
  libPath?: string;
}

function browserSetup(): {
  executablePath?: string;
  env?: Record<string, string | undefined>;
  args?: string[];
} {
  try {
    const cfg = JSON.parse(readFileSync("/tmp/loopquad-e2e-browser.json", "utf8")) as BrowserSetup;
    if (cfg.executablePath) {
      return {
        executablePath: cfg.executablePath,
        env: { ...process.env, LD_LIBRARY_PATH: cfg.libPath },
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      };
    }
  } catch {
    // Fall back to a Playwright-managed browser if one is installed.
  }
  return { args: ["--no-sandbox", "--disable-dev-shm-usage"] };
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    launchOptions: browserSetup(),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev -- --port 5173 --strictPort",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env["CI"],
      timeout: 120_000,
    },
    {
      command: "npm run dev",
      cwd: "workers/api",
      url: "http://localhost:8787/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 120_000,
    },
  ],
});
