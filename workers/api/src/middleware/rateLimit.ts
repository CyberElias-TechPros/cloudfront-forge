import type { Env } from "../types";
import { createLogger } from "../lib/logger";

export interface RateLimitOptions {
  maxRequests?: number;
  windowSeconds?: number;
  failClosed?: boolean;
  keyPrefix?: string;
}

export async function rateLimitMiddleware(
  request: Request,
  env: Env,
  options: RateLimitOptions = {},
): Promise<boolean> {
  const logger = createLogger(env);
  const {
    maxRequests = parseInt(env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
    windowSeconds = parseInt(env.RATE_LIMIT_WINDOW || "60", 10),
    failClosed = false,
  } = options;

  const ip = getIP(request);
  const prefix = options.keyPrefix || "general";
  const key = `rate_limit:${prefix}:${ip}`;

  try {
    const current = await env.KV_CACHE.get(key, { type: "json" });
    const count = current ? (current as any).count : 0;

    if (count >= maxRequests) {
      return false;
    }

    await env.KV_CACHE.put(
      key,
      JSON.stringify({
        count: count + 1,
        resetTime: Date.now() + windowSeconds * 1000,
      }),
      { expirationTtl: windowSeconds },
    );

    return true;
  } catch (error) {
    logger.error("Rate limit error", error);
    // Fail-open for general endpoints, fail-closed for critical endpoints
    return failClosed ? false : true;
  }
}

function getIP(request: Request): string {
  const forwarded =
    request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  return forwarded.split(",")[0]?.trim() ?? "unknown";
}
