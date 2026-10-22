/**
 * PLAT-018 — the spec diff has to be boring, fast and never crash a PR.
 *
 * It runs on every pull request, so a broken script would be a red check for
 * everyone. These tests compare the committed spec with itself, which is the
 * "nothing changed" path CI takes on a docs-only PR.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../../..");

function runDiff(args: string[]): { status: number; stdout: string } {
  try {
    const stdout = execFileSync(process.execPath, ["scripts/api-diff.mjs", ...args], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string };
    return { status: failure.status ?? 1, stdout: failure.stdout ?? "" };
  }
}

describe("api spec diff", () => {
  it("reports no changes when the base is the working tree", () => {
    const result = runDiff(["--base", "worktree"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No contract changes");
  });

  it("does not fail the build when nothing is breaking", () => {
    const result = runDiff(["--base", "worktree", "--check-breaking"]);
    expect(result.status).toBe(0);
  });

  it("explains itself when the base has no spec", () => {
    const result = runDiff(["--base", "refs/heads/does-not-exist"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("nothing to compare");
  });
});
