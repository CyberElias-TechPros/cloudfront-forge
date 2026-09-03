import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const WORKERS_ROOT = path.resolve(__dirname, "..");

function read(relative: string): string {
  return readFileSync(path.join(REPO_ROOT, relative), "utf8");
}

/** Drop // and /* *\/ comments so assertions look at code, not prose. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/^(\s*)\/\/.*$/, "$1"))
    .join("\n");
}

/**
 * Guard tests for the deployment contract: the frontend must stay a static
 * single-page app served by Vercel, and the API must stay a Cloudflare Worker
 * talking to D1/R2/KV. A well-meaning change that reintroduces a server
 * runtime (or a migration that is never registered) should fail here.
 */
describe("Vercel frontend (static SPA)", () => {
  const vercel = JSON.parse(read("vercel.json"));

  it("disables framework detection and ships a static directory", () => {
    expect(vercel.framework).toBeNull();
    expect(vercel.outputDirectory).toBe("dist/client");
  });

  it("serves index.html for every deep link (client-side routing)", () => {
    const routes = vercel.rewrites as { source: string; destination: string }[];
    expect(routes.length).toBeGreaterThan(0);
    const shell = routes.find((r) => r.destination === "/index.html");
    expect(shell).toBeTruthy();
    // Static assets must be excluded from the catch-all.
    expect(shell?.source).toContain("assets/");
  });

  it("sets security headers and immutable asset caching", () => {
    const sources = (vercel.headers as { source: string; headers: { key: string }[] }[]).map(
      (h) => h.source,
    );
    expect(sources).toContain("/assets/(.*)");
    const global = vercel.headers.find((h: { source: string }) => h.source === "/(.*)");
    const keys = (global.headers as { key: string }[]).map((h) => h.key);
    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("Strict-Transport-Security");
    expect(keys).toContain("X-Frame-Options");
  });

  it("builds with Vite only — no server runtime in the Vercel output", () => {
    const viteConfig = read("vite.config.ts");
    expect(viteConfig).not.toMatch(/preset:\s*["']cloudflare/);
    expect(viteConfig).not.toMatch(/ssr:\s*\{[^}]*target:\s*["']node/);
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts.build).toContain("vite build");
    expect(pkg.scripts.build).not.toContain("server");
  });

  it("calls the API through a configurable base URL, never a hardcoded host", () => {
    const source = stripComments(read("src/lib/api.ts"));
    expect(source).toMatch(/import\.meta\.env/);
    expect(source).not.toMatch(/https?:\/\/localhost/);
    expect(source).not.toMatch(/127\.0\.0\.1/);
    // Only third-party media hosts may appear in the client bundle.
    expect(source).not.toMatch(
      /https?:\/\/(?!www\.youtube|img\.youtube|i\.ytimg)[a-z0-9.-]+\.(com|net|io|dev|app)(?!\.)/i,
    );
  });

  it("keeps the service worker free of localhost URLs", () => {
    const sw = read("public/sw.js");
    expect(sw).not.toMatch(/https?:\/\/localhost/);
    expect(sw).not.toMatch(/127\.0\.0\.1/);
  });
});

describe("Cloudflare Worker configuration", () => {
  const wranglerRaw = readFileSync(path.join(WORKERS_ROOT, "wrangler.toml"), "utf8");
  // Comments explain the configuration, so assertions look at the live config.
  const wrangler = wranglerRaw
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");

  it("binds D1, KV and R2", () => {
    expect(wrangler).toContain("[[d1_databases]]");
    expect(wrangler).toContain("[[kv_namespaces]]");
    expect(wrangler).toContain("[[r2_buckets]]");
  });

  it("schedules the daily cron", () => {
    expect(wrangler).toMatch(/crons\s*=/);
  });

  it("does not pin migrations with stale [[migrations]] tags", () => {
    // The migration directory is the source of truth; hand-maintained tags in
    // wrangler.toml drifted out of sync (001-004 while 028 files existed).
    expect(wrangler).not.toContain("[[migrations]]");
  });

  it("runs as a module worker with the migration directory configured", () => {
    expect(wrangler).toMatch(/main\s*=/);
    expect(wrangler).toMatch(/compatibility_date\s*=/);
    expect(wrangler).toMatch(/migrations_dir\s*=/);
  });

  it("defines a staging environment with its own bindings", () => {
    expect(wrangler).toContain("[env.staging]");
    const staging = wrangler.slice(wrangler.indexOf("[env.staging]"));
    expect(staging).toContain("[[env.staging.d1_databases]]");
    expect(staging).toContain("[[env.staging.kv_namespaces]]");
    expect(staging).toContain("[[env.staging.r2_buckets]]");
  });
});

describe("migrations", () => {
  const dir = path.join(WORKERS_ROOT, "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  it("are numbered contiguously from 001", () => {
    const numbers = files.map((f) => Number(f.slice(0, 3)));
    const unique = [...new Set(numbers)].sort((a, b) => a - b);
    unique.forEach((n, index) => expect(n).toBe(index + 1));

    // `004` ships twice (004_ai_conversations, 004_youtube_oauth). Renaming a
    // migration that production has already applied would make Wrangler treat
    // it as new and replay it, so the duplicate stays — but no new file may
    // reuse an existing number.
    const duplicated = numbers.filter((n, i) => numbers.indexOf(n) !== i);
    expect(duplicated).toEqual([4]);
  });

  it("are ordered deterministically (no ambiguous duplicates beyond 004)", () => {
    const keys = files.map((f) => `${f.slice(0, 3)}:${f.slice(4)}`);
    const ambiguous = keys.filter((key, i) => keys.indexOf(key) !== i);
    expect(ambiguous).toEqual([]);
  });

  it("all contain SQL statements and none are empty", () => {
    for (const file of files) {
      const sql = readFileSync(path.join(dir, file), "utf8").trim();
      expect(sql.length, `${file} is empty`).toBeGreaterThan(0);
      expect(sql, `${file} has no statements`).toMatch(/[A-Za-z]+/);
    }
  });

  it("are safe to re-run (IF NOT EXISTS, or a guarded DROP first)", () => {
    for (const file of files) {
      const sql = readFileSync(path.join(dir, file), "utf8");
      const guarded = /DROP TABLE IF EXISTS/i.test(sql) || /CREATE TABLE IF NOT EXISTS/i.test(sql);
      if (/CREATE TABLE(?! IF NOT EXISTS)/i.test(sql) && !guarded) {
        throw new Error(`${file} creates a table without IF NOT EXISTS`);
      }
    }
  });
});

describe("secrets", () => {
  it("ships an env example for the frontend and the worker", () => {
    expect(existsSync(path.join(REPO_ROOT, ".env.example"))).toBe(true);
    expect(existsSync(path.join(WORKERS_ROOT, ".env.example"))).toBe(true);
  });

  it("keeps committed env examples free of real credentials", async () => {
    const { readdirSync: readdir, statSync } = await import("node:fs");
    const skip = new Set(["node_modules", ".git", "dist", ".wrangler", "build", "out"]);

    const walk = (dir: string): string[] =>
      readdir(dir).flatMap((entry) => {
        if (skip.has(entry)) return [];
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) return walk(full);
        return /\.env(\.[a-z]+)?$/.test(entry) || entry.includes("env.example") ? [full] : [];
      });

    const envFiles = walk(REPO_ROOT);
    expect(envFiles.length).toBeGreaterThan(0);
    for (const file of envFiles) {
      const contents = readFileSync(file, "utf8");
      expect(contents, `${file} contains a private key block`).not.toMatch(/-----BEGIN/);
      expect(contents, `${file} contains a live Firebase key`).not.toMatch(/AIzaSy[A-Za-z0-9_-]{20,}/);
    }
  });
});
