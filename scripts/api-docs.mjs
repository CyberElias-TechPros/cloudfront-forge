#!/usr/bin/env node
/**
 * Render `docs/API.md` from the generated OpenAPI document (PLAT-019).
 *
 * The document is the source of truth; this script makes it readable in the
 * repository without anyone hand-maintaining a second description of the API.
 *
 * Usage: node scripts/api-docs.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = join(ROOT, "workers", "api", "src", "contract", "openapi.generated.json");
const OUT = join(ROOT, "docs", "API.md");
const check = process.argv.includes("--check");

const spec = JSON.parse(readFileSync(SPEC, "utf8"));
const { info, servers, tags, paths, components, "x-contract": meta } = spec;

const lines = [];
lines.push("# API reference");
lines.push("");
lines.push(
  "> **Generated** from `workers/api/src/contract/openapi.generated.json` by `npm run docs:api`.",
);
lines.push("> Do not edit by hand — the contract is the source of truth and CI fails on drift.");
lines.push("");
lines.push(`**${info.title} v${info.version}** — OpenAPI ${spec.openapi}`);
lines.push("");
lines.push(info.description);
lines.push("");
lines.push("## Servers");
lines.push("");
for (const server of servers) {
  lines.push(`- ${server.description ?? "Server"}: \`${server.url}\``);
}
lines.push("");
lines.push("Live document: `GET /openapi.json` on any deployment.");
lines.push("");

lines.push("## Authentication");
lines.push("");
lines.push(
  "`Authorization: Bearer <Firebase ID token>`. Operations marked **public** need no token. " +
    "The Worker derives the member from the verified token; no endpoint accepts a client-supplied user id.",
);
lines.push("");

lines.push("## Error codes");
lines.push("");
lines.push("Clients branch on `error.code`, never on `error.message`.");
lines.push("");
lines.push("| Code | HTTP | Retryable | Client action | Meaning |");
lines.push("| --- | --- | --- | --- | --- |");
const registry = meta.errorCodes ?? {};
for (const [code, spec] of Object.entries(registry)) {
  lines.push(
    `| \`${code}\` | ${spec.status} | ${spec.retryable ? "yes" : "no"} | \`${spec.action}\` | ${spec.description} |`,
  );
}
lines.push("");
lines.push(
  "Retryable codes return `Retry-After` where applicable; clients should back off with jitter.",
);
lines.push("");

lines.push("## Contract coverage");
lines.push("");
lines.push(
  `${meta.coverage.documented}/${meta.coverage.routes} router entries are documented (${meta.coverage.percent}%). ` +
    "Undocumented routes are listed in `workers/api/src/contract/inventory.generated.json` and are being " +
    "migrated into the contract schema-by-schema (PLAT-002).",
);
lines.push("");

const byTag = new Map();
for (const [path, operations] of Object.entries(paths)) {
  for (const [method, operation] of Object.entries(operations)) {
    const tag = operation.tags?.[0] ?? "Other";
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag).push({ path, method: method.toUpperCase(), operation });
  }
}

lines.push("## Endpoints");
lines.push("");
for (const tag of tags) {
  const entries = byTag.get(tag.name);
  if (!entries?.length) continue;
  lines.push(`### ${tag.name}`);
  lines.push("");
  lines.push(`_${tag.description}_`);
  lines.push("");
  for (const { path, method, operation } of entries.sort((a, b) => a.path.localeCompare(b.path))) {
    lines.push(`#### \`${method} ${path}\``);
    lines.push("");
    lines.push(`**${operation.summary}** — auth: \`${operation["x-auth-tier"] ?? "user"}\``);
    if (operation.description) {
      lines.push("");
      lines.push(operation.description);
    }
    const request = operation.requestBody?.content?.["application/json"]?.schema;
    if (request?.properties) {
      lines.push("");
      lines.push("Body fields:");
      lines.push("");
      for (const [name, schema] of Object.entries(request.properties)) {
        const required = request.required?.includes(name) ? " (required)" : "";
        lines.push(`- \`${name}\`${required}: ${describeSchema(schema)}`);
      }
    }
    const success = operation.responses["200"]?.content?.["application/json"]?.schema;
    const data = success?.properties?.data;
    if (data?.properties) {
      lines.push("");
      lines.push("Response `data` fields:");
      lines.push("");
      for (const [name, schema] of Object.entries(data.properties)) {
        lines.push(`- \`${name}\`: ${describeSchema(schema)}`);
      }
    }
    const statuses = Object.keys(operation.responses).sort();
    if (statuses.length) {
      lines.push("");
      lines.push(`Statuses: ${statuses.map((status) => `\`${status}\``).join(", ")}`);
    }
    lines.push("");
  }
}

function describeSchema(schema) {
  if (!schema || typeof schema !== "object") return "any";
  if (schema.type === "array") return `array of ${describeSchema(schema.items ?? {})}`;
  if (schema.enum) return schema.enum.map((value) => `\`${value}\``).join(" | ");
  if (schema.type === "object") {
    const keys = schema.properties ? Object.keys(schema.properties) : [];
    return keys.length ? `object { ${keys.join(", ")} }` : "object";
  }
  const bounds = [];
  if (schema.minLength !== undefined) bounds.push(`min ${schema.minLength}`);
  if (schema.maxLength !== undefined) bounds.push(`max ${schema.maxLength}`);
  if (schema.minimum !== undefined) bounds.push(`min ${schema.minimum}`);
  if (schema.maximum !== undefined) bounds.push(`max ${schema.maximum}`);
  return `${schema.type ?? "any"}${bounds.length ? ` (${bounds.join(", ")})` : ""}`;
}

const output = `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;

if (check) {
  const current = readFileSync(OUT, "utf8");
  if (current !== output) {
    console.error("docs/API.md is stale. Run `npm run docs:api` and commit the result.");
    process.exit(1);
  }
  console.log("docs/API.md is up to date");
} else {
  writeFileSync(OUT, output, "utf8");
  console.log(
    `docs/API.md written (${lines.length} lines, ${paths ? Object.keys(paths).length : 0} paths)`,
  );
}
