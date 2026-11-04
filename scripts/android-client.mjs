#!/usr/bin/env node
/** Deterministic Kotlin/Retrofit client from the committed OpenAPI contract.
 * Usage: node scripts/android-client.mjs [--check]. Never edit generated files.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const spec = JSON.parse(
  readFileSync(path.join(ROOT, "workers/api/src/contract/openapi.generated.json"), "utf8"),
);
const OUT = path.join(
  ROOT,
  "android/core/network-api/src/main/java/com/creatorloop/core/networkapi/generated",
);
const check = process.argv.includes("--check");
const pascal = (s) =>
  s.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase());
const camel = (s) => {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
};
const keywords = new Set([
  "as",
  "break",
  "class",
  "continue",
  "do",
  "else",
  "false",
  "for",
  "fun",
  "if",
  "in",
  "interface",
  "is",
  "null",
  "object",
  "package",
  "return",
  "super",
  "this",
  "throw",
  "true",
  "try",
  "typealias",
  "typeof",
  "val",
  "var",
  "when",
  "while",
]);
const ident = (s) => {
  const value = camel(s).replace(/[^a-zA-Z0-9_]/g, "_");
  return keywords.has(value) ? `\`${value}\`` : value;
};
const resolve = (s) => (s?.$ref ? resolve(spec.components.schemas[s.$ref.split("/").pop()]) : s);
const models = [];
function merged(schema) {
  schema = resolve(schema);
  if (schema?.allOf) {
    const parts = schema.allOf.map(merged);
    return {
      type: "object",
      properties: Object.assign({}, ...parts.map((p) => p.properties ?? {})),
      required: [...new Set(parts.flatMap((p) => p.required ?? []))],
      additionalProperties: true,
    };
  }
  return schema ?? {};
}
function typeOf(raw, name) {
  const s = merged(raw);
  const variants = s.anyOf ?? s.oneOf;
  if (variants) {
    const nonNull = variants.filter((v) => resolve(v).type !== "null");
    if (nonNull.length === 1 && nonNull.length !== variants.length)
      return { type: typeOf(nonNull[0], name).type, nullable: true };
    return { type: "JsonElement", nullable: false };
  }
  if (Array.isArray(s.type)) {
    const nonNull = s.type.filter((t) => t !== "null");
    return {
      type: typeOf({ ...s, type: nonNull[0] }, name).type,
      nullable: s.type.includes("null"),
    };
  }
  if (s.enum)
    return {
      type: s.enum.every((v) => typeof v === "boolean") ? "Boolean" : "String",
      nullable: false,
    };
  switch (s.type) {
    case "string":
      return { type: "String", nullable: false };
    case "number":
    case "integer":
      return { type: "Double", nullable: false };
    case "boolean":
      return { type: "Boolean", nullable: false };
    case "array":
      return { type: `List<${typeOf(s.items ?? {}, name + "Item").type}>`, nullable: false };
    case "object":
    default: {
      if (!s.properties || !Object.keys(s.properties).length)
        return { type: "JsonObject", nullable: false };
      const groups = new Map();
      for (const [key, value] of Object.entries(s.properties)) {
        const property = camel(key),
          existing = groups.get(property) ?? [];
        existing.push([key, value]);
        groups.set(property, existing);
      }
      const required = new Set(s.required ?? []);
      const fields = [...groups.entries()].map(([property, entries]) => {
        entries.sort(([a], [b]) => (a === property ? -1 : b === property ? 1 : 0));
        const [key, value] = entries[0];
        const t = typeOf(value, name + pascal(property));
        const optional = !entries.some(([k]) => required.has(k));
        const nullable = t.nullable || optional || entries.some(([, v]) => merged(v).nullable);
        return {
          property,
          key,
          aliases: entries.slice(1).map(([k]) => k),
          type: t.type,
          nullable,
          optional,
        };
      });
      // Required constructor parameters precede defaulted ones.
      fields.sort((a, b) => Number(a.optional) - Number(b.optional));
      models.push({ name, fields });
      return { type: name, nullable: false };
    }
  }
}
const operations = [];
for (const [route, methods] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(methods)) {
    const id = op.operationId,
      name = pascal(id);
    const content = op.requestBody?.content ?? {};
    const media = Object.keys(content)[0];
    const requestSchema = media ? content[media].schema : null;
    const success = op.responses?.["200"]?.content ?? {};
    const responseMedia = Object.keys(success)[0];
    const responseSchema = success[responseMedia]?.schema;
    const rawData = responseSchema?.properties?.data;
    const binary = responseMedia !== "application/json";
    const rawSystem = id === "health" || id === "openApiDocument";
    const responseType = binary
      ? "ResponseBody"
      : rawSystem
        ? "JsonObject"
        : `ApiEnvelope<${typeOf(rawData ?? responseSchema, name + "Response").type}>`;
    const params = [];
    for (const parameter of op.parameters ?? []) {
      const t =
        parameter.in === "path"
          ? "String"
          : parameter.schema?.type === "integer"
            ? "Int"
            : parameter.schema?.type === "number"
              ? "Double"
              : parameter.schema?.type === "boolean"
                ? "Boolean"
                : "String";
      const annotation = parameter.in === "path" ? "Path" : "Query";
      params.push(
        `@${annotation}("${parameter.name}") ${ident(parameter.name)}: ${t}${parameter.required || parameter.in === "path" ? "" : "? = null"}`,
      );
    }
    let bodyType = null;
    if (requestSchema && media === "multipart/form-data") {
      params.push("@Part image: MultipartBody.Part");
    } else if (requestSchema || ["post", "put", "patch", "delete"].includes(method)) {
      bodyType = requestSchema ? typeOf(requestSchema, name + "Request").type : "JsonObject";
      params.push(`@Body body: ${bodyType}${bodyType === "JsonObject" ? " = JsonObject()" : ""}`);
    }
    operations.push({
      id,
      method,
      route,
      auth: op["x-auth-tier"] ?? "public",
      params,
      responseType,
      binary,
      rawSystem,
      multipart: media === "multipart/form-data",
      hasBody: !!bodyType,
    });
  }
}
const header =
  '// GENERATED by scripts/android-client.mjs from the OpenAPI contract. DO NOT EDIT.\n@file:Suppress("UNUSED_PARAMETER", "RedundantNullableReturnType")\npackage com.creatorloop.core.networkapi.generated\n\n';
const modelImports =
  "import kotlinx.serialization.*\nimport kotlinx.serialization.json.*\nimport com.creatorloop.core.networkapi.FlexibleBooleanSerializer\n\n";
let modelText = header + modelImports;
modelText +=
  "@Serializable\ndata class ResponseMeta(val timestamp: String? = null, val version: String? = null, val requestId: String? = null)\n\n";
modelText +=
  "@Serializable\ndata class ApiEnvelope<T>(val success: Boolean = false, val data: T? = null, val error: ApiError? = null, val meta: ResponseMeta? = null)\n\n";
modelText +=
  '@Serializable\ndata class ApiError(val code: String = "INTERNAL_ERROR", val message: String = "Request failed")\n\n';
for (const model of models) {
  modelText += `@Serializable\ndata class ${model.name}(\n`;
  modelText += model.fields
    .map((f) => {
      const annotations = [`@SerialName("${f.key}")`];
      if (f.type === "Boolean")
        annotations.push("@Serializable(with = FlexibleBooleanSerializer::class)");
      if (f.aliases.length)
        annotations.push(`@JsonNames(${f.aliases.map((a) => `"${a}"`).join(", ")})`);
      return `    ${annotations.join(" ")} val ${ident(f.property)}: ${f.type}${f.nullable ? "?" : ""}${f.optional || f.nullable ? " = null" : ""}`;
    })
    .join(",\n");
  modelText += "\n)\n\n";
}
let apiText =
  header +
  "import retrofit2.Response\nimport retrofit2.http.*\nimport okhttp3.ResponseBody\nimport okhttp3.MultipartBody\nimport kotlinx.serialization.json.JsonObject\nimport kotlinx.serialization.json.JsonElement\n\n/** Every operation in the shared contract; auth is enforced by the Worker. */\ninterface LoopApi {\n";
for (const op of operations) {
  const annotation =
    op.method === "delete" && op.hasBody
      ? `@HTTP(method = "DELETE", path = "${op.route.slice(1)}", hasBody = true)`
      : `@${op.method.toUpperCase()}("${op.route.slice(1)}")`;
  apiText += `    ${op.multipart ? "@Multipart\n    " : ""}${annotation}\n    suspend fun ${ident(op.id)}(${op.params.join(", ")}): Response<${op.responseType}>\n\n`;
}
apiText +=
  "}\n\ndata class ContractOperation(val id: String, val method: String, val path: String, val auth: String)\nobject ContractOperations {\n    val all: List<ContractOperation> = listOf(\n";
apiText += operations
  .map(
    (op) =>
      `        ContractOperation("${op.id}", "${op.method.toUpperCase()}", "${op.route}", "${op.auth}")`,
  )
  .join(",\n");
apiText += "\n    )\n}\n";
// JsonNames is experimental but stable enough for wire aliases; opt in module-wide.
modelText = modelText.replace(
  "package com.creatorloop.core.networkapi.generated\n",
  "package com.creatorloop.core.networkapi.generated\n\n@file:OptIn(ExperimentalSerializationApi::class)\n",
);
// file-level opt-in must precede package.
modelText = modelText.replace(
  '// GENERATED by scripts/android-client.mjs from the OpenAPI contract. DO NOT EDIT.\n@file:Suppress("UNUSED_PARAMETER", "RedundantNullableReturnType")\npackage com.creatorloop.core.networkapi.generated\n\n@file:OptIn(ExperimentalSerializationApi::class)\n',
  '// GENERATED by scripts/android-client.mjs from the OpenAPI contract. DO NOT EDIT.\n@file:Suppress("UNUSED_PARAMETER", "RedundantNullableReturnType")\n@file:OptIn(ExperimentalSerializationApi::class)\n\npackage com.creatorloop.core.networkapi.generated\n',
);
const files = { "Models.kt": modelText, "LoopApi.kt": apiText };
mkdirSync(OUT, { recursive: true });
let stale = false;
for (const [name, text] of Object.entries(files)) {
  const target = path.join(OUT, name);
  if (check) {
    if (!existsSync(target) || readFileSync(target, "utf8") !== text) stale = true;
  } else writeFileSync(target, text);
}
const hash = createHash("sha256").update(JSON.stringify(spec)).digest("hex").slice(0, 16);
if (check && stale) {
  console.error("Android client is stale. Run node scripts/android-client.mjs");
  process.exit(1);
}
console.log(
  `Android contract: ${operations.length} operations, ${models.length} models, spec ${hash}${check ? " (verified)" : ""}`,
);
