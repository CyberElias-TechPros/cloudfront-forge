import type { Env, ApiResponse } from "../types";
import { toCamelCaseKeys } from "../lib/utils";
import { createLogger } from "../lib/logger";
import { DatabaseError } from "../lib/database";

export const SECURITY_HEADERS = new Headers({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  // API responses are JSON, never rendered: nothing may load or execute.
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
});

function withSecurityHeaders(headers: Headers): Headers {
  SECURITY_HEADERS.forEach((value, key) => {
    headers.set(key, value);
  });
  return headers;
}

function isDatabaseError(error: any): boolean {
  return error instanceof DatabaseError || error?.name === "DatabaseError";
}

/**
 * True when a D1/SQLite error says the schema is missing an object the query
 * needs — the signature of unapplied migrations.
 */
export function isSchemaDriftError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /no such (table|column)|has no column named/i.test(message);
}

export function errorHandler(
  error: any,
  request?: Request,
  corsHeaders?: Headers,
  env?: Env,
  _ctx?: ExecutionContext,
): Response {
  const logger = env ? createLogger(env) : null;
  if (logger) {
    logger.error("API Error", error, {
      url: request?.url,
      method: request?.method,
    });
  } else {
    console.error("API Error:", {
      message: error.message,
      stack: error.stack,
      url: request?.url,
      method: request?.method,
    });
  }

  let statusCode = 500;
  let errorCode = "INTERNAL_ERROR";
  let message = "An internal error occurred";

  // A statement that references a table or column the database does not have
  // means the Worker code is ahead of the applied D1 migrations (e.g. the code
  // was deployed but `wrangler d1 migrations apply` never ran). That is a
  // deployment state, not a bug in the request: answer 503 with a distinct
  // code so operators can tell it apart from genuine database failures.
  if (isDatabaseError(error) && isSchemaDriftError(error)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "SCHEMA_OUT_OF_DATE",
          message: "The service is being updated. Please try again shortly.",
        },
        meta: { timestamp: new Date().toISOString(), version: "v1" },
      } satisfies ApiResponse),
      {
        status: 503,
        headers: withSecurityHeaders(
          new Headers({
            "Content-Type": "application/json",
            "Retry-After": "60",
            ...(corsHeaders ? Object.fromEntries(corsHeaders.entries()) : {}),
          }),
        ),
      },
    );
  }

  // Database failures are logged with SQL + driver message, but never echoed to
  // the client — the response stays generic.
  if (isDatabaseError(error)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "DATABASE_ERROR", message },
        meta: { timestamp: new Date().toISOString(), version: "v1" },
      } satisfies ApiResponse),
      {
        status: 500,
        headers: withSecurityHeaders(
          new Headers({
            "Content-Type": "application/json",
            ...(corsHeaders ? Object.fromEntries(corsHeaders.entries()) : {}),
          }),
        ),
      },
    );
  }

  // A deploy that is missing a binding or secret is not "an internal error":
  // 503 tells the caller (and the operator) the service is not ready.
  if (typeof error.message === "string" && error.message.startsWith("MISSING_ENV")) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "MISSING_ENV", message: "Service is not configured" },
        meta: { timestamp: new Date().toISOString(), version: "v1" },
      } satisfies ApiResponse),
      {
        status: 503,
        headers: withSecurityHeaders(
          new Headers({
            "Content-Type": "application/json",
            ...(corsHeaders ? Object.fromEntries(corsHeaders.entries()) : {}),
          }),
        ),
      },
    );
  }

  switch (error.message) {
    case "AUTH_required":
    case "AUTH_TOKEN_INVALID":
      statusCode = 401;
      errorCode = "AUTH_ERROR";
      message = "Authentication required";
      break;
    case "VALIDATION_ERROR":
      statusCode = 400;
      errorCode = "VALIDATION_ERROR";
      message = "Invalid input data";
      break;
    case "NOT_FOUND":
      statusCode = 404;
      errorCode = "NOT_FOUND";
      message = "Resource not found";
      break;
    case "FORBIDDEN":
      statusCode = 403;
      errorCode = "FORBIDDEN";
      message = "Access denied";
      break;
  }

  const response: ApiResponse = {
    success: false,
    error: {
      code: errorCode,
      message: message,
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: "v1",
    },
  };

  const headers = withSecurityHeaders(
    new Headers({
      "Content-Type": "application/json",
      ...(corsHeaders ? Object.fromEntries(corsHeaders.entries()) : {}),
    }),
  );

  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers,
  });
}

export function createResponse<T>(data: T, status = 200, corsHeaders?: Headers): Response {
  const response: ApiResponse<T> = {
    success: true,
    data: toCamelCaseKeys(data),
    meta: {
      timestamp: new Date().toISOString(),
      version: "v1",
    },
  };

  const headers = withSecurityHeaders(
    new Headers({
      "Content-Type": "application/json",
      ...(corsHeaders ? Object.fromEntries(corsHeaders.entries()) : {}),
    }),
  );

  return new Response(JSON.stringify(response), {
    status,
    headers,
  });
}

export function createErrorResponse(
  code: string,
  message: string,
  status = 400,
  corsHeaders?: Headers,
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code: code,
      message: message,
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: "v1",
    },
  };

  const headers = withSecurityHeaders(
    new Headers({
      "Content-Type": "application/json",
      ...(corsHeaders ? Object.fromEntries(corsHeaders.entries()) : {}),
    }),
  );

  return new Response(JSON.stringify(response), {
    status,
    headers,
  });
}
