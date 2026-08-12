import type { Env } from "../types";

const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX_REQUESTS = 100;

export async function rateLimitMiddleware(request: Request, env: Env): Promise<boolean> {
  const ip = getIP(request);
  const key = `rate_limit:${ip}`;

  try {
    const current = await env.KV_CACHE.get(key, { type: "json" });
    const count = current ? (current as any).count : 0;

    if (count >= RATE_LIMIT_MAX_REQUESTS) {
      return false;
    }

    await env.KV_CACHE.put(
      key,
      JSON.stringify({
        count: count + 1,
        resetTime: Date.now() + RATE_LIMIT_WINDOW * 1000,
      }),
      { expirationTtl: RATE_LIMIT_WINDOW },
    );

    return true;
  } catch (error) {
    console.error("Rate limit error:", error);
    return true;
  }
}

function getIP(request: Request): string {
  const forwarded =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  return forwarded.split(",")[0]?.trim() ?? "unknown";
}
