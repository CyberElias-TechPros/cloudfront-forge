import type { Env, ApiResponse } from "../types";
import { toCamelCaseKeys } from "../lib/utils";
import { createLogger } from "../lib/logger";

const SECURITY_HEADERS = new Headers({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
});

function withSecurityHeaders(headers: Headers): Headers {
  SECURITY_HEADERS.forEach((value, key) => {
    headers.set(key, value);
  });
  return headers;
}

export function errorHandler(error: any, request?: Request, corsHeaders?: Headers, env?: Env): Response {
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
