/**
 * OpenAPI 3.1 document builder.
 *
 * Pure function: same registry in, same document out — no timestamps, no
 * environment reads — so the committed artefact can be diff-gated in CI.
 */
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { RouteDefinition } from "../types";
import { routes } from "../routes";
import { endpoints, systemEndpoints, COMMON_ERRORS, TAGS, type EndpointContract } from "./registry";
import { ERROR_CODES, type ErrorCode } from "./errors";

export const API_TITLE = "LoopSquad API";
export const API_VERSION = "1.0.0";
export const API_DESCRIPTION = [
  "HTTP API for LoopSquad: verified watch-for-watch growth for creator communities.",
  "",
  "Every response is enveloped:",
  "- success: `{ success: true, data, meta }`",
  "- failure: `{ success: false, error: { code, message }, meta }`",
  "",
  "Authenticate with a Firebase ID token (`Authorization: Bearer <token>`). Clients must branch on",
  "`error.code` (see the Error schema), never on `error.message`.",
].join("\n");

type JsonSchema = Record<string, unknown>;

/** Convert a Zod schema to a JSON Schema fragment usable inside OpenAPI 3.1. */
export function toJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  const generated = zodToJsonSchema(schema, {
    target: "openApi3",
    $refStrategy: "none",
    errorMessages: false,
  }) as Record<string, unknown>;
  // `$schema` is the only keyword the converter adds that OpenAPI rejects.
  const { $schema, definitions, ...rest } = generated as {
    $schema?: unknown;
    definitions?: unknown;
  } & JsonSchema;
  void $schema;
  void definitions;
  return rest;
}

function envelope(data: JsonSchema | null) {
  return {
    type: "object",
    required: ["success", "data", "meta"],
    properties: {
      success: { type: "boolean", enum: [true] },
      data: data ?? {},
      meta: { $ref: "#/components/schemas/ResponseMeta" },
    },
  } as const;
}

const FREE_FORM: JsonSchema = { type: "object", additionalProperties: true };

function pathParameters(path: string) {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

function queryParameters(endpoint: EndpointContract) {
  return (endpoint.query ?? []).map((param) => ({
    name: param.name,
    in: "query",
    required: param.required ?? false,
    ...(param.description ? { description: param.description } : {}),
    schema: {
      type: param.type ?? "string",
      ...(param.enum ? { enum: param.enum } : {}),
      ...(param.default !== undefined ? { default: param.default } : {}),
    },
  }));
}

function errorStatuses(endpoint: EndpointContract): ErrorCode[] {
  const codes = new Set<ErrorCode>([...(endpoint.errors ?? []), ...COMMON_ERRORS]);
  if (endpoint.auth === "public") codes.delete("AUTH_REQUIRED");
  if (endpoint.auth === "admin" || endpoint.auth === "moderator") codes.add("FORBIDDEN");
  return [...codes].sort();
}

function successSchema(endpoint: EndpointContract) {
  const mediaType = endpoint.responseContentType ?? "application/json";
  if (mediaType === "text/event-stream") return { type: "string", description: "Server-sent events" };
  if (mediaType === "image/*") return { type: "string", format: "binary" };
  return envelope(endpoint.response ? toJsonSchema(endpoint.response) : FREE_FORM);
}

function responsesFor(endpoint: EndpointContract) {
  const mediaType = endpoint.responseContentType ?? "application/json";
  const responses: Record<string, unknown> = {
    "200": {
      description: "Successful response",
      content: {
        [mediaType]: { schema: successSchema(endpoint) },
      },
    },
  };

  const byStatus = new Map<number, ErrorCode[]>();
  for (const code of errorStatuses(endpoint)) {
    const status = ERROR_CODES[code].status;
    byStatus.set(status, [...(byStatus.get(status) ?? []), code]);
  }

  for (const [status, codes] of [...byStatus.entries()].sort((a, b) => a[0] - b[0])) {
    responses[String(status)] = {
      description: codes.map((code) => `${code}: ${ERROR_CODES[code].description}`).join(" · "),
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["success", "error", "meta"],
            properties: {
              success: { type: "boolean", enum: [false] },
              error: {
                type: "object",
                required: ["code", "message"],
                properties: {
                  code: { type: "string", enum: codes },
                  message: { type: "string" },
                },
              },
              meta: { $ref: "#/components/schemas/ResponseMeta" },
            },
          },
        },
      },
    };
  }

  return responses;
}

function requestBodyFor(endpoint: EndpointContract) {
  if (!endpoint.request || endpoint.route.method === "GET") return {};
  const mediaType = endpoint.contentType ?? "application/json";
  const schema =
    mediaType === "multipart/form-data"
      ? {
          type: "object",
          required: ["file"],
          properties: { file: { type: "string", format: "binary" } },
        }
      : toJsonSchema(endpoint.request);
  return { requestBody: { required: true, content: { [mediaType]: { schema } } } };
}

function operationFor(endpoint: EndpointContract) {
  const parameters = [...pathParameters(endpoint.path), ...queryParameters(endpoint)];

  return {
    tags: [endpoint.tag],
    operationId: endpoint.operationId,
    summary: endpoint.summary,
    ...(endpoint.description ? { description: endpoint.description } : {}),
    ...(endpoint.deprecated ? { deprecated: true } : {}),
    security: endpoint.auth === "public" ? [] : [{ bearerAuth: [] }],
    "x-auth-tier": endpoint.auth,
    ...(parameters.length > 0 ? { parameters } : {}),
    ...requestBodyFor(endpoint),
    responses: responsesFor(endpoint),
  };
}

export interface ContractCoverage {
  /** Route entries in the router table. */
  routes: number;
  /** Routes that have a registry entry. */
  documented: number;
  /** Percentage, rounded to one decimal. */
  percent: number;
  undocumented: Array<{ method: string; key: string }>;
}

/** A registry entry documents a route only when method *and* matcher match. */
export function documentsRoute(endpoint: EndpointContract, route: RouteDefinition): boolean {
  if (endpoint.route.method !== route.method) return false;
  if (endpoint.route.path !== undefined) return endpoint.route.path === route.path;
  if (endpoint.route.pattern !== undefined) return endpoint.route.pattern === route.pattern;
  return false;
}

export function computeCoverage(allRoutes: readonly RouteDefinition[] = routes): ContractCoverage {
  const documented = allRoutes.filter((route) =>
    endpoints.some((endpoint) => documentsRoute(endpoint, route)),
  );
  const undocumented = allRoutes
    .filter((route) => !documented.includes(route))
    .map((route) => ({ method: route.method, key: route.path ?? route.pattern ?? "" }));

  return {
    routes: allRoutes.length,
    documented: documented.length,
    percent:
      allRoutes.length === 0 ? 0 : Math.round((documented.length / allRoutes.length) * 1000) / 10,
    undocumented,
  };
}

export function buildOpenApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const endpoint of [...endpoints, ...systemEndpoints]) {
    const method = endpoint.route.method.toLowerCase();
    paths[endpoint.path] ??= {};
    paths[endpoint.path][method] = operationFor(endpoint);
  }

  const coverage = computeCoverage();

  return {
    openapi: "3.1.0",
    info: {
      title: API_TITLE,
      version: API_VERSION,
      description: API_DESCRIPTION,
    },
    servers: [
      { url: "https://creatorloop-api.autumn-surf-21ec.workers.dev", description: "Production" },
      {
        url: "https://creatorloop-api-staging.autumn-surf-21ec.workers.dev",
        description: "Staging",
      },
      { url: "http://localhost:8787", description: "Local wrangler dev" },
    ],
    tags: TAGS.map((tag) => ({ ...tag })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Firebase ID token",
          description:
            "Firebase Authentication ID token. The Worker verifies it against Google's public keys and derives the member from it.",
        },
      },
      schemas: {
        ResponseMeta: {
          type: "object",
          required: ["timestamp", "version"],
          properties: {
            timestamp: { type: "string", format: "date-time" },
            version: { type: "string", example: "v1" },
          },
        },
        ErrorCode: {
          type: "string",
          enum: Object.keys(ERROR_CODES),
          description: "Stable, machine-readable error codes. Branch on these, never on messages.",
        },
      },
    },
    "x-contract": {
      generatedBy: "npm run contract:build",
      coverage,
      /**
       * Full error registry (status, retryability, client action, meaning) so
       * generated documentation and client SDKs do not have to guess.
       */
      errorCodes: Object.fromEntries(
        Object.entries(ERROR_CODES).map(([code, spec]) => [
          code,
          {
            status: spec.status,
            retryable: spec.retryable,
            action: spec.action,
            description: spec.description,
          },
        ]),
      ),
    },
  };
}

export type OpenApiDocument = ReturnType<typeof buildOpenApiDocument>;
