#!/usr/bin/env node
/**
 * PLAT-018 — API spec diff.
 *
 * Two clients (web and Android) ship on independent schedules against one API.
 * A change that removes a field, renames a parameter or tightens an enum is a
 * breaking change even when every test passes, so it has to be *visible* before
 * it merges.
 *
 * This script compares the committed OpenAPI document with a base revision and
 * prints a Markdown summary, classifying each change:
 *
 *   breaking  — a client built against the old spec can fail (removed operation,
 *               removed response field, new required parameter, new required
 *               request field, narrowed enum, type change)
 *   additive  — new operations/fields/parameters; old clients keep working
 *   deprecation — something gained a `deprecated: true`
 *
 * Usage:
 *   node scripts/api-diff.mjs                       # vs origin/main, print
 *   node scripts/api-diff.mjs --base worktree       # self-check, always clean
 *   node scripts/api-diff.mjs --base HEAD~1         # vs another revision
 *   node scripts/api-diff.mjs --write-changelog     # append to docs/API_CHANGELOG.md
 *   node scripts/api-diff.mjs --check-breaking      # exit 1 on a breaking change
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_PATH = "workers/api/src/contract/openapi.generated.json";
const CHANGELOG_PATH = "docs/API_CHANGELOG.md";

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const baseIndex = args.indexOf("--base");
const baseRef = baseIndex >= 0 ? args[baseIndex + 1] : "origin/main";

function gitShow(ref, file) {
  try {
    return execFileSync("git", ["show", `${ref}:${file}`], {
      cwd: ROOT,
      encoding: "utf8",
      // The spec is a few hundred kB; the default 1 MB pipe buffer overflows.
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function readCurrent() {
  const file = path.join(ROOT, SPEC_PATH);
  if (!existsSync(file)) {
    console.error(`Missing ${SPEC_PATH}. Run 'npm run contract:build' first.`);
    process.exit(2);
  }
  return readFileSync(file, "utf8");
}

function operations(document) {
  const map = new Map();
  for (const [routePath, item] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(item ?? {})) {
      map.set(`${method.toUpperCase()} ${routePath}`, operation);
    }
  }
  return map;
}

/** Flatten a JSON schema into dotted field paths so nested changes are visible. */
function schemaFields(schema, prefix = "", out = new Map()) {
  if (!schema || typeof schema !== "object") return out;
  const resolved = schema.$ref ? { type: "ref", $ref: schema.$ref } : schema;

  for (const [key, value] of Object.entries(resolved.properties ?? {})) {
    const field = prefix ? `${prefix}.${key}` : key;
    const required = (resolved.required ?? []).includes(key);
    out.set(field, {
      type: Array.isArray(value.type) ? value.type.join("|") : value.type,
      enum: Array.isArray(value.enum) ? value.enum : null,
      required,
      nullable: value.nullable === true,
    });
    schemaFields(value, field, out);
  }
  if (resolved.items) schemaFields(resolved.items, prefix ? `${prefix}[]` : "[]", out);
  return out;
}

function parameterMap(operation) {
  const map = new Map();
  for (const parameter of operation.parameters ?? []) {
    map.set(`${parameter.in}:${parameter.name}`, {
      required: parameter.required === true,
      deprecated: parameter.deprecated === true,
      schema: parameter.schema,
    });
  }
  return map;
}

function diffMaps(before, after, classify) {
  const changes = [];
  for (const [key, value] of before) {
    if (!after.has(key)) changes.push(classify.removed(key, value));
    else {
      const change = classify.changed?.(key, value, after.get(key));
      if (change) changes.push(change);
    }
  }
  for (const [key, value] of after) {
    if (!before.has(key)) changes.push(classify.added(key, value));
  }
  return changes.filter(Boolean);
}

function diffSpecs(before, after) {
  const breaking = [];
  const additive = [];
  const deprecations = [];

  const beforeOps = operations(before);
  const afterOps = operations(after);

  for (const [key] of beforeOps) {
    if (!afterOps.has(key)) breaking.push(`Removed endpoint \`${key}\``);
  }
  for (const [key, operation] of afterOps) {
    if (!beforeOps.has(key)) {
      additive.push(`Added endpoint \`${key}\` (${operation.operationId ?? "no operationId"})`);
      continue;
    }
    const previous = beforeOps.get(key);

    // Parameters.
    const beforeParams = parameterMap(previous);
    const afterParams = parameterMap(operation);
    breaking.push(
      ...diffMaps(beforeParams, afterParams, {
        removed: (name) => `Removed parameter \`${name}\` from \`${key}\``,
        added: (name, value) =>
          value.required ? `New required parameter \`${name}\` on \`${key}\`` : null,
        changed: (name, old, next) => {
          if (old.deprecated !== next.deprecated) {
            const verb = next.deprecated ? "Deprecated" : "Undeprecated";
            (next.deprecated ? deprecations : additive).push(
              `${verb} parameter \`${name}\` on \`${key}\``,
            );
          }
          if (old.schema?.type !== next.schema?.type) {
            return `Parameter \`${name}\` on \`${key}\` changed type ${old.schema?.type} → ${next.schema?.type}`;
          }
          return null;
        },
      }),
    );

    // Request body fields.
    const beforeBody = previous.requestBody?.content?.["application/json"]?.schema;
    const afterBody = operation.requestBody?.content?.["application/json"]?.schema;
    if (beforeBody && !afterBody) breaking.push(`Removed request body from \`${key}\``);
    if (beforeBody && afterBody) {
      const beforeFields = schemaFields(beforeBody);
      const afterFields = schemaFields(afterBody);
      breaking.push(
        ...diffMaps(beforeFields, afterFields, {
          removed: (field) => `Removed request field \`${field}\` from \`${key}\``,
          added: (field, value) =>
            value.required ? `New required request field \`${field}\` on \`${key}\`` : null,
          changed: (field, old, next) => {
            if (old.enum && next.enum && next.enum.every((item) => old.enum.includes(item)))
              return null;
            if (old.enum && next.enum && old.enum.some((item) => !next.enum.includes(item))) {
              return `Narrowed enum for \`${field}\` on \`${key}\``;
            }
            if (old.type && next.type && old.type !== next.type) {
              return `Request field \`${field}\` on \`${key}\` changed type ${old.type} → ${next.type}`;
            }
            return null;
          },
        }),
      );
    }

    // Response fields (2xx only: error envelopes are shared).
    for (const [status, response] of Object.entries(previous.responses ?? {})) {
      const next = operation.responses?.[status];
      if (!next) {
        breaking.push(`Removed \`${status}\` response from \`${key}\``);
        continue;
      }
      if (!String(status).startsWith("2")) continue;
      const beforeSchema = response.content?.["application/json"]?.schema;
      const afterSchema = next.content?.["application/json"]?.schema;
      if (beforeSchema && !afterSchema) breaking.push(`Removed response schema from \`${key}\``);
      if (!beforeSchema || !afterSchema) continue;

      const beforeFields = schemaFields(beforeSchema);
      const afterFields = schemaFields(afterSchema);
      breaking.push(
        ...diffMaps(beforeFields, afterFields, {
          removed: (field) => `Removed response field \`${field}\` from \`${key}\``,
          added: (field) => {
            additive.push(`Added response field \`${field}\` to \`${key}\``);
            return null;
          },
          changed: (field, old, next) => {
            if (old.enum && next.enum && old.enum.some((item) => !next.enum.includes(item))) {
              return `Narrowed response enum for \`${field}\` on \`${key}\``;
            }
            if (old.type && next.type && old.type !== next.type) {
              return `Response field \`${field}\` on \`${key}\` changed type ${old.type} → ${next.type}`;
            }
            return null;
          },
        }),
      );
    }

    if (previous.deprecated !== operation.deprecated && operation.deprecated) {
      deprecations.push(`Deprecated endpoint \`${key}\``);
    }
  }

  // Error codes are part of the contract clients branch on.
  const beforeCodes = new Set(Object.keys(before["x-contract"]?.errorCodes ?? {}));
  const afterCodes = new Set(Object.keys(after["x-contract"]?.errorCodes ?? {}));
  for (const code of beforeCodes) {
    if (!afterCodes.has(code)) breaking.push(`Removed error code \`${code}\``);
  }
  for (const code of afterCodes) {
    if (!beforeCodes.has(code)) additive.push(`Added error code \`${code}\``);
  }

  return { breaking, additive, deprecations };
}

function render({ breaking, additive, deprecations }, base) {
  const lines = [];
  const total = breaking.length + additive.length + deprecations.length;
  lines.push(`### API spec diff vs \`${base}\``);
  lines.push("");
  if (total === 0) {
    lines.push("No contract changes. 🎉");
    return lines.join("\n");
  }
  lines.push(
    `**${breaking.length} breaking · ${deprecations.length} deprecation · ${additive.length} additive**`,
  );
  lines.push("");
  const section = (title, items, note) => {
    if (items.length === 0) return;
    lines.push(
      `<details${title.startsWith("⚠️") ? " open" : ""}><summary>${title} (${items.length})</summary>`,
    );
    lines.push("");
    if (note) lines.push(note, "");
    for (const item of items) lines.push(`- ${item}`);
    lines.push("");
    lines.push("</details>");
    lines.push("");
  };
  section("⚠️ Breaking changes", breaking, "A client built against the previous spec can fail.");
  section("⏳ Deprecations", deprecations, "Still supported; announce and migrate.");
  section("➕ Additive changes", additive, "Old clients keep working.");
  return lines.join("\n").trimEnd();
}

function main() {
  const currentRaw = readCurrent();
  const current = JSON.parse(currentRaw);
  // `--base worktree` compares the document with itself: useful for a smoke
  // test of the script, and for "did I only change docs" checks.
  const baseRaw = baseRef === "worktree" ? currentRaw : gitShow(baseRef, SPEC_PATH);
  if (!baseRaw) {
    console.log(`### API spec diff\n\nNo \`${SPEC_PATH}\` on \`${baseRef}\`; nothing to compare.`);
    return;
  }

  const diff = diffSpecs(JSON.parse(baseRaw), current);
  const markdown = render(diff, baseRef);
  console.log(markdown);

  if (flags.has("--write-changelog")) {
    const file = path.join(ROOT, CHANGELOG_PATH);
    const date = new Date().toISOString().slice(0, 10);
    const entry = `## ${date} — \`${baseRef}\` → working tree\n\n${markdown}\n\n`;
    const existing = existsSync(file) ? readFileSync(file, "utf8") : "# API changelog\n\n";
    writeFileSync(file, existing.replace("# API changelog\n\n", `# API changelog\n\n${entry}`));
    console.log(`\nWrote ${CHANGELOG_PATH}`);
  }

  if (flags.has("--check-breaking") && diff.breaking.length > 0) {
    console.error("\nBreaking contract changes detected (PLAT-018).");
    process.exit(1);
  }
}

main();
