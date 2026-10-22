#!/usr/bin/env node
/**
 * Generate the web TypeScript client types from the OpenAPI document (PLAT-006).
 *
 * Input : `workers/api/src/contract/openapi.generated.json` (the committed contract)
 * Output: `src/contract/api.generated.ts`
 *
 * The web app already has a hand-written `src/lib/api-client.ts`. That file knows
 * *how* to call the API (auth, retries, envelope unwrapping); it should not also
 * be the place where response shapes are guessed. This generator emits named
 * request/response types per operation straight from the contract, so a handler
 * that changes shape breaks the web build instead of production.
 *
 * Dependency-free on purpose: the mapping is small, and adding a generator
 * toolchain to a repo that already diff-gates its artefacts buys nothing.
 *
 * Usage (from the repo root):
 *   node scripts/api-client.mjs           # write src/contract/api.generated.ts
 *   node scripts/api-client.mjs --check   # fail if the committed file is stale
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = path.join(ROOT, "workers/api/src/contract/openapi.generated.json");
const OUT = path.join(ROOT, "src/contract/api.generated.ts");
const check = process.argv.includes("--check");

const document = JSON.parse(readFileSync(SPEC, "utf8"));

/** Resolve a local `$ref` pointer against the document. */
function resolveRef(ref) {
  const parts = ref.replace(/^#\//, "").split("/");
  let node = document;
  for (const part of parts) node = node?.[part];
  return node;
}

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const propertyKey = (name) => (IDENT.test(name) ? name : JSON.stringify(name));

/** JSON Schema → TypeScript type expression. */
function tsType(schema, depth = 0) {
  if (!schema || typeof schema !== "object") return "unknown";
  if (schema.$ref) return tsType(resolveRef(schema.$ref), depth);

  if (Array.isArray(schema.enum)) {
    const values = schema.enum.map((value) => JSON.stringify(value));
    return values.length === 1 ? values[0] : values.join(" | ");
  }
  if (schema.anyOf || schema.oneOf) {
    const variants = (schema.anyOf ?? schema.oneOf).map((variant) => tsType(variant, depth + 1));
    return [...new Set(variants)].join(" | ");
  }
  if (schema.allOf) return schema.allOf.map((variant) => tsType(variant, depth + 1)).join(" & ");

  switch (schema.type) {
    case "string":
      return schema.format === "date-time" ? "string" : "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array": {
      const item = tsType(schema.items ?? {}, depth + 1);
      return item.includes(" | ") ? `Array<${item}>` : `${item}[]`;
    }
    case "object":
      return objectType(schema, depth);
    default:
      if (schema.properties) return objectType(schema, depth);
      return "unknown";
  }
}

function objectType(schema, depth) {
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const entries = Object.entries(properties);
  if (entries.length === 0) return "Record<string, unknown>";

  const isTopLevel = depth === 0;
  const pad = isTopLevel ? "  " : "  ".repeat(depth + 1);
  const closePad = isTopLevel ? "" : "  ".repeat(depth);
  const lines = entries.map(([name, value]) => {
    const optional = required.has(name) ? "" : "?";
    return `${pad}${propertyKey(name)}${optional}: ${tsType(value, depth + 1)};`;
  });
  const body = lines.join("\n");
  const extra =
    schema.additionalProperties === true || schema.passthrough === true
      ? `\n${pad}[key: string]: unknown;`
      : "";
  return `{\n${body}${extra}\n${closePad}}`;
}

const pascal = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const operations = [];
for (const [routePath, item] of Object.entries(document.paths)) {
  for (const [method, operation] of Object.entries(item)) {
    const body = operation.requestBody?.content ?? {};
    const mediaType = Object.keys(body)[0];
    const requestSchema = mediaType ? body[mediaType].schema : undefined;

    const query = {};
    for (const parameter of operation.parameters ?? []) {
      if (parameter.in !== "query") continue;
      query[parameter.name] = {
        type: parameter.schema?.type ?? "string",
        required: Boolean(parameter.required),
        enum: parameter.schema?.enum,
        description: parameter.description,
        default: parameter.schema?.default,
      };
    }

    const successType = operation.responses["200"]?.content ?? {};
    const successMedia = Object.keys(successType)[0] ?? "application/json";
    const envelope = successType[successMedia]?.schema;

    operations.push({
      id: operation.operationId,
      method: method.toUpperCase(),
      path: routePath,
      auth: operation["x-auth-tier"] ?? "user",
      summary: operation.summary ?? "",
      deprecated: Boolean(operation.deprecated),
      query,
      request: requestSchema ? tsType(requestSchema, 0) : "never",
      response: tsType(envelope ?? {}, 0),
      media: successMedia,
    });
  }
}

operations.sort((a, b) => a.id.localeCompare(b.id));
const errorCodes = document.components.schemas.ErrorCode.enum;

const header = `/**
 * AUTO-GENERATED — do not edit.
 *
 * Produced by \`node scripts/api-client.mjs\` from
 * \`workers/api/src/contract/openapi.generated.json\`. Run \`npm run contract:client\`
 * after changing a schema; CI fails when this file drifts from the contract.
 *
 * Every operation declares the HTTP method, the literal path template, the auth
 * tier, its query parameters, the request body and the success envelope.
 */
`;

const chunks = [header];
chunks.push(
  `export type ErrorCode =\n  | ${errorCodes.map((code) => JSON.stringify(code)).join("\n  | ")};\n`,
);
chunks.push(`export interface ResponseMeta {
  timestamp: string;
  version: string;
}

/** The failure envelope every non-2xx response uses. */
export interface ApiErrorEnvelope {
  success: false;
  error: { code: ErrorCode; message: string };
  meta: ResponseMeta;
}
`);

const opEntries = operations
  .map((operation) => {
    const queryLines = Object.entries(operation.query)
      .map(([name, spec]) => {
        const type = spec.enum
          ? spec.enum.map((v) => JSON.stringify(v)).join(" | ")
          : spec.type === "integer" || spec.type === "number"
            ? "number"
            : spec.type === "boolean"
              ? "boolean"
              : "string";
        return `      ${propertyKey(name)}?: ${type};`;
      })
      .join("\n");
    return `  ${operation.id}: {
    method: ${JSON.stringify(operation.method)};
    path: ${JSON.stringify(operation.path)};
    auth: ${JSON.stringify(operation.auth)};
    summary: ${JSON.stringify(operation.summary)};
    media: ${JSON.stringify(operation.media)};
    query: ${queryLines ? `{\n${queryLines}\n    }` : "Record<string, never>"};
    request: ${operation.request};
    response: ${operation.response};
  };`;
  })
  .join("\n\n");

chunks.push(`/**
 * Operation id → wire details. Index it by the ids in the contract
 * (\`GET /openapi.json\` → \`operationId\`), never by hand-written strings.
 */
export interface OperationRegistry {
${opEntries}
}

export type OperationId = keyof OperationRegistry;
export type Operation<K extends OperationId> = OperationRegistry[K];
export type ResponseOf<K extends OperationId> = OperationRegistry[K]["response"];
export type DataOf<K extends OperationId> = ResponseOf<K> extends { data: infer D }
  ? D
  : ResponseOf<K>;
export type RequestOf<K extends OperationId> = OperationRegistry[K]["request"];
export type QueryOf<K extends OperationId> = OperationRegistry[K]["query"];
export type PathOf<K extends OperationId> = OperationRegistry[K]["path"];
`);

let output = `${chunks.join("\n")}\n`;
const relative = path.relative(ROOT, OUT);

// Format with the repo's Prettier config so the generated file is reviewable
// and passes `npm run format --check`. Prettier is a dev dependency of the web
// app, which is where this file lives; if it is unavailable the raw output is
// still valid TypeScript.
try {
  const prettier = await import("prettier");
  const config = (await prettier.resolveConfig(OUT)) ?? {};
  output = await prettier.format(output, { ...config, filepath: OUT });
} catch {
  /* formatting is cosmetic */
}

if (check) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {
    /* missing file is stale by definition */
  }
  if (current !== output) {
    console.error(`${relative} is stale. Run \`npm run contract:client\` and commit the result.`);
    process.exit(1);
  }
  console.log(`${relative} is up to date`);
} else {
  writeFileSync(OUT, output);
  console.log(
    `${relative} written (${operations.length} operations, ${(output.length / 1024).toFixed(0)} kB)`,
  );
}
