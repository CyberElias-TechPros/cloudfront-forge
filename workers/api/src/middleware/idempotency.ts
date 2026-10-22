/**
 * Idempotent writes (PLAT-010).
 *
 * A dropped response is indistinguishable from a dropped request. On a mobile
 * network the client retries, and without help the server performs the write
 * twice: two submissions, two credit spends, two top-up requests.
 *
 * Usage inside a handler, after authentication:
 *
 * ```ts
 * const idem = await beginIdempotentRequest(request, env, { userId, scope: "videos.submit" });
 * if (idem.replay) return idem.replay;
 * // ... do the work ...
 * return idem.finish createResponse(...);
 * ```
 *
 * Requests without an `Idempotency-Key` behave exactly as before, so this is
 * additive for every existing client.
 */
import type { Env, RouteDefinition } from "../types";
import { Database } from "../lib/database";
import { createErrorResponse } from "./errorHandler";

/** How long a stored outcome is replayable. */
export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/** Keys must be opaque tokens: bounded length, URL-safe alphabet. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,255}$/;

export interface IdempotencyOptions {
  /** Internal `users.id`, not the Firebase uid. */
  userId: string;
  /** Endpoint identity, e.g. `videos.submit`. Keys are scoped to it. */
  scope: string;
}

export interface IdempotencyHandle {
  /** A response to return immediately: a replay, a conflict or a bad key. */
  replay?: Response;
  /** The key in use, or `undefined` when the request carried none. */
  key?: string;
  /** Persist the outcome. No-op without a key; only 2xx responses are stored. */
  finish(response: Response): Promise<Response>;
}

const NOOP: IdempotencyHandle = {
  finish: async (response: Response) => response,
};

/** SHA-256 hex of the parts that define "the same request". */
async function fingerprint(request: Request, body: string): Promise<string> {
  const url = new URL(request.url);
  // The body plus the client-visible operation is what matters. Query strings
  // are included because some write endpoints take parameters there.
  const material = `${request.method}\n${url.pathname}\n${url.search}\n${body}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function beginIdempotentRequest(
  request: Request,
  env: Env,
  options: IdempotencyOptions,
): Promise<IdempotencyHandle> {
  const key = (request.headers.get("Idempotency-Key") ?? "").trim();
  if (!key) return NOOP;

  if (!KEY_PATTERN.test(key)) {
    return {
      finish: async (response: Response) => response,
      replay: createErrorResponse(
        "VALIDATION_ERROR",
        "Idempotency-Key must be 8–255 characters of A-Z, a-z, 0-9, '-' or '_'",
        400,
      ),
    };
  }

  // Reading the body for the fingerprint must not consume it for the handler.
  const body = await request.clone().text();
  const requestHash = await fingerprint(request, body);
  const db = new Database(env);
  const now = Date.now();

  const existing = await db.querySingle(
    `SELECT request_hash, status_code, response_body, expires_at
       FROM idempotency_keys
      WHERE user_id = ? AND scope = ? AND idempotency_key = ?`,
    [options.userId, options.scope, key],
  );

  if (existing) {
    const expiresAt = Date.parse(String(existing.expires_at));
    if (Number.isFinite(expiresAt) && expiresAt > now) {
      if (existing.request_hash !== requestHash) {
        return {
          finish: async (response: Response) => response,
          replay: createErrorResponse(
            "IDEMPOTENCY_CONFLICT",
            "This Idempotency-Key was already used with a different request body",
            409,
          ),
        };
      }
      const headers = new Headers({
        "Content-Type": "application/json",
        // Tells the client (and a proxy) that this is not a fresh write.
        "Idempotent-Replay": "true",
      });
      return {
        finish: async (response: Response) => response,
        replay: new Response(String(existing.response_body), {
          status: Number(existing.status_code) || 200,
          headers,
        }),
        key,
      };
    }

    // Expired: free the slot so the key can be reused.
    await db.execute(
      "DELETE FROM idempotency_keys WHERE user_id = ? AND scope = ? AND idempotency_key = ?",
      [options.userId, options.scope, key],
    );
  }

  return {
    key,
    finish: async (response: Response) => {
      // Only successful outcomes are stored. Caching a validation or auth
      // failure would pin a *corrected* retry to the old error (and the body
      // hash would turn it into a 409), which is worse than repeating work.
      if (response.status < 200 || response.status >= 300) return response;

      let body: string;
      try {
        // A handler may return a stream (SSE); only JSON envelopes are stored.
        const contentType = response.headers.get("Content-Type") ?? "";
        if (!contentType.includes("application/json")) return response;
        body = await response.clone().text();
      } catch {
        return response;
      }

      const createdAt = new Date(now).toISOString();
      const expiresAt = new Date(now + IDEMPOTENCY_TTL_SECONDS * 1000).toISOString();
      try {
        await db.execute(
          `INSERT OR IGNORE INTO idempotency_keys
             (id, user_id, scope, idempotency_key, request_hash, status_code, response_body, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [db.uuid(), options.userId, options.scope, key, requestHash, response.status, body, createdAt, expiresAt],
        );
      } catch {
        // Storing is best-effort: the write already succeeded, and failing the
        // request now would be worse than losing the replay window.
      }

      const headers = new Headers(response.headers);
      headers.set("Idempotency-Key", key);
      return new Response(body, { status: response.status, statusText: response.statusText, headers });
    },
  };
}

/** Housekeeping: drop expired keys. Called from the daily job sweep. */
export async function pruneIdempotencyKeys(env: Env): Promise<number> {
  const db = new Database(env);
  const result = await db.execute("DELETE FROM idempotency_keys WHERE expires_at < ?", [
    new Date().toISOString(),
  ]);
  return Number(result.meta?.changes ?? 0);
}

/**
 * Wrap a route so writes become replayable.
 *
 * The identity used to scope keys is the verified token's subject (the Firebase
 * uid), read from the auth result the entry point already attached. Handlers
 * that resolve it again still work — this only reads, never consumes.
 */
export function withIdempotency(route: RouteDefinition, scope: string): RouteDefinition {
  return {
    ...route,
    handler: async (request: Request, env: Env): Promise<Response> => {
      const auth = (request as Request & { __auth?: { userId?: string; isAuthenticated?: boolean } })
        .__auth;
      const subject = auth?.isAuthenticated ? auth.userId : undefined;

      // Anonymous requests have no durable identity to key on: run normally.
      if (!subject) return route.handler(request, env);

      const idem = await beginIdempotentRequest(request, env, { userId: subject, scope });
      if (idem.replay) return idem.replay;
      return idem.finish(await route.handler(request, env));
    },
  };
}
