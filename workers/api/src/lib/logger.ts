import type { Env } from "../types";

export interface LogContext {
  requestId?: string;
  userId?: string;
  method?: string;
  url?: string;
  [key: string]: unknown;
}

export class Logger {
  constructor(private env: Env) {}

  private format(level: string, message: string, context?: LogContext): void {
    const entry = {
      level,
      timestamp: new Date().toISOString(),
      message,
      environment: this.env.ENVIRONMENT,
      ...context,
    };
    console[level.toLowerCase() as "log" | "info" | "warn" | "error"](JSON.stringify(entry));
  }

  info(message: string, context?: LogContext): void {
    this.format("INFO", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.format("WARN", message, context);
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    const errorContext = { ...context };
    if (error instanceof Error) {
      errorContext.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    } else if (error !== undefined) {
      errorContext.error = error;
    }
    this.format("ERROR", message, errorContext);
  }

  debug(message: string, context?: LogContext): void {
    if (this.env.ENVIRONMENT === "development") {
      this.format("DEBUG", message, context);
    }
  }
}

export function createLogger(env: Env): Logger {
  return new Logger(env);
}
