import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".wrangler",
  ".tanstack",
  ".next",
  "coverage",
]);

const SCANNED_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml|toml|sql|html|css)$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (SKIP_DIRS.has(entry)) return [];
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return SCANNED_EXTENSIONS.test(entry) ? [full] : [];
  });
}

const FILES = walk(ROOT).filter((file) => !file.includes("package-lock.json"));

/**
 * A credential committed to Git is a credential that has to be rotated. These
 * patterns have all appeared in this repository's history (a real Firebase web
 * key was committed across eight documents), so they are asserted against every
 * tracked source file.
 */
const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "Firebase/Google API key", pattern: /AIzaSy[A-Za-z0-9_-]{25,}/ },
  { name: "AWS access key id", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9]{30,}/ },
  { name: "Stripe live key", pattern: /sk_live_[A-Za-z0-9]{20,}/ },
  { name: "Slack token", pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "hard-coded JWT", pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
];

describe("repository hygiene", () => {
  it("scans a meaningful number of files", () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it.each(SECRET_PATTERNS)("commits no $name", ({ pattern }) => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const contents = readFileSync(file, "utf8");
      if (pattern.test(contents)) offenders.push(path.relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it("keeps .dev.vars and .env out of version control", () => {
    const gitignore = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/\.env/);
    expect(gitignore).toMatch(/\.dev\.vars/);
  });

  it("ships an env example documenting every VITE_ variable used by the app", () => {
    const example = readFileSync(path.join(ROOT, ".env.example"), "utf8");
    const used = new Set<string>();
    for (const file of FILES.filter((f) => /^src\//.test(path.relative(ROOT, f)))) {
      const contents = readFileSync(file, "utf8");
      for (const match of contents.matchAll(/import\.meta\.env\["?(VITE_[A-Z_0-9]+)"?\]/g)) {
        used.add(match[1]!);
      }
    }
    expect(used.size).toBeGreaterThan(5);
    for (const key of used) {
      expect(example, `${key} is used but undocumented in .env.example`).toContain(key);
    }
  });
});
