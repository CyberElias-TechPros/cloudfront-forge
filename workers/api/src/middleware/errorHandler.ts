import type { Env, ApiResponse } from "../types";
import { toCamelCaseKeys } from "../lib/utils";

export function errorHandler(error: any, request?: Request): Response {
  console.error("API Error:", {
    message: error.message,
    stack: error.stack,
    url: request?.url,
    method: request?.method,
  });

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

  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function createResponse<T>(data: T, status = 200): Response {
  const response: ApiResponse<T> = {
    success: true,
    data: toCamelCaseKeys(data),
    meta: {
      timestamp: new Date().toISOString(),
      version: "v1",
    },
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function createErrorResponse(code: string, message: string, status = 400): Response {
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

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
