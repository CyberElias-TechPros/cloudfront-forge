/**
 * Error-registry conformance (PLAT-008).
 *
 * Handlers used to invent codes and statuses inline. The registry is only
 * meaningful if the code enforces it, so these tests scan the source for
 * `createErrorResponse(...)` calls and require every one of them to use a
 * registered code with the status that code declares.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { ERROR_CODES, isErrorCode, statusForErrorCode } from "../../src/contract/errors";

const SRC = path.resolve(__dirname, "../../src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

interface Call {
  file: string;
  code: string;
  /** Third argument when it is a numeric literal, else undefined. */
  status?: number;
}

/**
 * Extract the first three arguments of each `createErrorResponse(...)` call.
 * The scanner is deliberately simple: it walks balanced parentheses so nested
 * calls (e.g. `errors.map(...).join(", ")`) are handled.
 */
export function collectErrorCalls(source: string, file = "inline"): Call[] {
  const calls: Call[] = [];
  const marker = "createErrorResponse(";
  let index = source.indexOf(marker);

  while (index !== -1) {
    const start = index + marker.length;
    let depth = 1;
    let cursor = start;
    const args: string[] = [];
    let current = "";

    while (cursor < source.length && depth > 0) {
      const char = source[cursor];
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (depth === 0) break;
      if (char === "," && depth === 1) {
        args.push(current);
        current = "";
      } else {
        current += char;
      }
      cursor += 1;
    }
    if (current.trim()) args.push(current);

    const codeMatch = /^\s*["'`]([A-Z_]+)["'`]\s*$/.exec(args[0] ?? "");
    const statusMatch = /^\s*(\d{3})\s*$/.exec(args[2] ?? "");
    if (codeMatch) {
      calls.push({
        file,
        code: codeMatch[1],
        ...(statusMatch ? { status: Number(statusMatch[1]) } : {}),
      });
    } else if ((args[0] ?? "").trim()) {
      calls.push({ file, code: `__dynamic__:${(args[0] ?? "").trim().slice(0, 40)}` });
    }

    index = source.indexOf(marker, cursor);
  }

  return calls;
}

const files = walk(SRC).filter(
  (file) =>
    !file.includes(`${path.sep}contract${path.sep}`) &&
    // The factory itself takes the code as a parameter; it is not a call site.
    !file.endsWith(path.join("middleware", "errorHandler.ts")),
);
const calls = files.flatMap((file) =>
  collectErrorCalls(readFileSync(file, "utf8"), path.relative(SRC, file)),
);

describe("error registry", () => {
  it("has a unique, stable set of codes with sensible statuses", () => {
    const names = Object.keys(ERROR_CODES);
    expect(new Set(names).size).toBe(names.length);
    for (const [name, spec] of Object.entries(ERROR_CODES)) {
      expect(name).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(spec.status).toBeGreaterThanOrEqual(400);
      expect(spec.status).toBeLessThan(600);
      expect(spec.description.length).toBeGreaterThan(10);
      expect([
        "sign_in",
        "retry",
        "wait",
        "fix_input",
        "upgrade",
        "contact_support",
        "none",
      ]).toContain(spec.action);
    }
  });

  it("finds error calls to check (the scan is not silently empty)", () => {
    expect(calls.length).toBeGreaterThan(100);
  });

  it("only uses registered codes in handlers", () => {
    const unknown = calls.filter(
      (call) => !call.code.startsWith("__dynamic__") && !isErrorCode(call.code),
    );
    expect(
      unknown.map((call) => `${call.file}: ${call.code}`),
      "unregistered error codes; add them to src/contract/errors.ts",
    ).toEqual([]);
  });

  it("reports codes that are still built dynamically", () => {
    // Dynamic codes cannot be documented or typed, so they are listed rather
    // than failed: this test is a visibility ratchet during PLAT-002.
    const dynamic = calls.filter((call) => call.code.startsWith("__dynamic__"));
    expect(dynamic.length).toBeLessThanOrEqual(5);
  });

  it("returns the status each code declares", () => {
    const mismatches = calls
      .filter((call) => !call.code.startsWith("__dynamic__") && call.status !== undefined)
      .filter((call) => call.status !== statusForErrorCode(call.code))
      .map(
        (call) =>
          `${call.file}: ${call.code} returned ${call.status}, registry says ${statusForErrorCode(call.code)}`,
      );
    expect(mismatches).toEqual([]);
  });

  it("maps unknown codes to 500 instead of pretending they are client errors", () => {
    expect(statusForErrorCode("NOT_A_REAL_CODE")).toBe(500);
    expect(statusForErrorCode("AUTH_REQUIRED")).toBe(401);
  });
});
