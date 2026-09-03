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

  // Database failures are logged with SQL + driver message, but never echoed to
  // the client — the response stays generic.
  if (error instanceof DatabaseError || error.name === "DatabaseError") {
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
