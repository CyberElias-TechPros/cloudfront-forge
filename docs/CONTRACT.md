# API contract — how it works and how to change it

**Status:** live since 2026-10-21 (`PLAT-001`, `PLAT-003`, `PLAT-004`, `PLAT-005`, `PLAT-008`).
**Related:** [ROADMAP.md](ROADMAP.md) · [API.md](API.md) (generated) · [ARCHITECTURE.md](ARCHITECTURE.md)

## Why

Two clients (web and the native Android app) consume the same 110-route API. Before this
contract existed, both would have been hand-written against TypeScript types that nothing
verified, and every endpoint change risked silent drift — the single most expensive class of bug
in a two-client product.

The contract is not a document written after the code. **The Zod schemas that handlers validate
with are the contract**, and the OpenAPI document is generated from them.

```
workers/api/src/contract/schemas/*.ts   ← single definition of every payload
        │                                    (imported by handlers for validation)
        ├──► src/contract/registry.ts        ← route → auth tier, schemas, error codes
        │           │
        │           ├──► openapi.generated.json   (served at GET /openapi.json)
        │           ├──► inventory.generated.json (every route + doc status)
        │           └──► docs/API.md              (human-readable reference)
        │
        └──► src/contract/errors.ts          ← error-code registry (status, retryability, action)
```

## Artefacts

| File                                                | Purpose                                                            | Regenerate               |
| --------------------------------------------------- | ------------------------------------------------------------------ | ------------------------ |
| `workers/api/src/contract/openapi.generated.json`   | The OpenAPI 3.1 document, committed and served                     | `npm run contract:build` |
| `workers/api/src/contract/inventory.generated.json` | Every router entry with its auth tier and whether it is documented | `npm run contract:build` |
| `docs/API.md`                                       | Rendered reference for humans                                      | `npm run docs:api`       |

All three are **committed** so the deployed document, the repository and the review diff agree.
CI regenerates them and fails if anything changed (`contract` job in `.github/workflows/ci.yml`).

## Enforced by tests

| Guarantee                                                                                | Test                             |
| ---------------------------------------------------------------------------------------- | -------------------------------- |
| Every registry entry matches a real route                                                | `tests/contract/openapi.test.ts` |
| No duplicate route entries, operation ids or tags                                        | `tests/contract/openapi.test.ts` |
| Path templates match route pattern groups                                                | `tests/contract/openapi.test.ts` |
| Committed JSON equals a fresh build                                                      | `tests/contract/openapi.test.ts` |
| Documented coverage never regresses (floor is now 100%)                                  | `tests/contract/openapi.test.ts` |
| No inline Zod schema survives in `src/routes/*` (all shapes come from the contract)      | `tests/contract/openapi.test.ts` |
| Every operation declares a success schema and unique query parameters                    | `tests/contract/openapi.test.ts` |
| Only registered error codes are returned, always as literals, with the registered status | `tests/contract/errors.test.ts`  |
| `/openapi.json` is served, cached, CORS-aware and available during misconfiguration      | `tests/contract/served.test.ts`  |

## Changing an endpoint

1. **Change the schema first** in `workers/api/src/contract/schemas/`. Handlers import it; there is
   no second definition to keep in sync.
2. **Update or add the registry entry** in `workers/api/src/contract/registry.ts`: route key (must
   match the router exactly), auth tier, request/response schema, error codes, `operationId`.
3. **If you introduce an error code**, register it in `src/contract/errors.ts` with a status, a
   retryability flag, the client action and a one-line description. The conformance test fails
   otherwise — this is deliberate: clients branch on codes, so an unregistered code is a protocol
   change.
4. **Regenerate and commit**:

   ```sh
   npm run contract:build && npm run docs:api && npm run contract:client
   ```

5. **Run the gates**: `npm --prefix workers/api test` (includes contract tests) and
   `npm --prefix workers/api run typecheck`.

## Consuming the contract

- **Live document:** `GET https://<worker>/openapi.json` (`Cache-Control: public, max-age=300`).
- **Web (PLAT-006, shipped):** `npm run contract:client` writes `src/contract/api.generated.ts`
  — 113 operations, ~66 kB of types, no runtime cost (types only). Each entry carries the HTTP
  method, the literal path template, the auth tier, query parameters, `request` and the success
  envelope. Read them through the helpers:

  ```ts
  import type { DataOf, RequestOf, QueryOf } from "@/contract/api.generated";

  type Claim = DataOf<"claimWatch">; // the `data` half of the 200 envelope
  type Submit = RequestOf<"submitVideo">; // request body
  type QueueQuery = QueryOf<"getWatchQueue">;
  ```

  `src/lib/api-client.ts` already derives `WatchClaimResultDTO`, `WatchEvidenceDTO` and
  `WatchHeartbeatDTO` from it, so a change to those handlers breaks `npm run typecheck` instead of
  the UI. Migrating the remaining hand-written DTOs in that file is the rest of PLAT-006.

- **Android (PLAT-007, next):** generate the Kotlin client with `openapi-generator`
  (`kotlin` + `kotlinx.serialization`) into `android/core/network-api`. Generated clients are never
  hand-edited, and the same drift gate applies.

CI regenerates the client and fails on drift, alongside the document and `docs/API.md`.

## Coverage policy

- **110 of 110 router entries are documented** (`x-contract.coverage` in the document, PLAT-002).
- `tests/contract/openapi.test.ts` keeps the floor at 100%: adding a route to the router table
  without a registry entry fails the suite, and `inventory.generated.json` records the audit.
- Request and response shapes live only in `src/contract/schemas/**`; a handler that writes
  `z.object(...)` inline fails the same suite.
- Where a handler's parser is deliberately lenient (AI chat trims strings, the top-up reject reason
  is clamped), the schema documents the accepted shape even though validation is manual. The
  contract test forces the _shape_ into the contract; it does not pretend the handler rejects.
- Response bodies that are still row-shaped are declared field-by-field with `.passthrough()`,
  including the snake_case columns the SQL actually returns. Normalising those names is a breaking
  change tracked separately — a contract that "tidies up" would lie to generated clients.
- Media types are explicit: `multipart/form-data` for the receipt upload, `image/*` for the receipt
  download, `text/event-stream` for `/ai/chat/stream`.

## Wire conformance

`tests/contract/wire.test.ts` drives `worker.fetch` — the entry point Cloudflare
runs — rather than calling handlers directly, and asserts for **every documented
operation** that:

- a `user`/`moderator`/`admin` endpoint answers `401 AUTH_REQUIRED` to an
  anonymous caller, without leaking whether the resource exists;
- an `admin`/`moderator` endpoint answers `403 FORBIDDEN` to an ordinary member;
- a `public` endpoint never answers `401`;
- unknown routes answer `404 NOT_FOUND` in the same envelope, CORS is limited to
  the allow-list, and every failure carries a code from the registry.

It found three real defects the first time it ran, all fixed:

1. Roughly twenty handlers compared `error.message` against `"AUTH_REQUIRED"`
   while `requireAuth` throws `"AUTH_required"`, so an anonymous or
   expired-token request answered `500 INTERNAL_ERROR` instead of `401`. Auth
   failures are now a typed `AuthError` and `isAuthError()` matches both
   spellings — no handler compares message text any more.
2. `requireAdmin`/`requireModerator` threw a plain `Error("FORBIDDEN")` that some
   catches mapped to `500`. They now throw `ForbiddenError`, and the two handlers
   that dropped it return `403 FORBIDDEN`.
3. `GET /leaderboards` and `GET /videos/{videoId}` were documented as
   authenticated but are intentionally public (landing page and shared links);
   the registry now says `public`, so the document tells the truth.

## Versioning and deprecation (PLAT-018)

Two clients ship on independent schedules, so a change that removes a field or
tightens an enum must be announced before it lands rather than discovered by a
crash in the Play Store.

**Policy**

- The API version (`/api/v1`) changes only when a breaking change cannot be
  staged. Everything below is expected within `v1`.
- A deprecated operation or parameter keeps working for **at least one release
  of both clients** (the web build and the next Android version), and never less
  than **90 days**. It responds with `Deprecation: true`, a `Sunset` date and a
  human-readable `Warning` header, and is marked `deprecated: true` in the spec.
- Breaking changes are announced in [`API_CHANGELOG.md`](./API_CHANGELOG.md),
  which is generated from the spec diff, not written by hand.
- The reference client (`src/lib/retry.ts`, `src/lib/api.ts`) surfaces a
  deprecation `Warning` in development builds so nobody ships a new dependency
  on a dying endpoint.

**Where the diff runs**

`node scripts/api-diff.mjs --base origin/main` classifies every difference as
breaking, deprecating or additive. CI runs it on every pull request, publishes
the summary to the job's step summary and comments on the PR; `--check-breaking`
turns a silent break into a red check.

## Corrections vs. earlier documents

The spec diff is honest about documentation fixes, so they appear as breaking
entries even where the server never changed:

- `GET /videos` was documented as `{ videos, pagination }`; the handler has always
  returned `{ items, total, limit, offset }`. The schema now matches the server.

## Rate limits

Two buckets per caller, deliberately different:

- a **hashed bearer token** — the member's own budget (a SHA-256 prefix, not the
  token, so a leaked counter reveals nothing);
- the **coarse IP** — a wider ceiling so one address cannot aggregate an
  unlimited number of free accounts. Carrier NAT puts a whole neighbourhood
  behind one address, so this is a backstop, never the primary limit.

Anonymous callers get the plain per-window budget on their IP. Every response
carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`;
the binding bucket is the one reported, so `Retry-After` never comes as a
surprise. `429` and every `503` include `Retry-After` (documented in the spec as
response headers, so generated SDKs expose them).

## Idempotent writes

Four writes can cost money or duplicate content, so a lost response must be
safe to retry:

| Operation             | Scope            | Why it is guarded                                       |
| --------------------- | ---------------- | ------------------------------------------------------- |
| `POST /videos`        | `videos.submit`  | A retry would publish the same video twice.             |
| `POST /watch`         | `watch.claim`    | A retry would pay the same watch twice.                 |
| `POST /shop/purchase` | `shop.purchase`  | A retry would spend the credits twice.                  |
| `POST /topups`        | `topups.request` | A retry would open two transfer claims for one payment. |

Clients send `Idempotency-Key: <opaque 8–255 char token>`; the server stores the
first **2xx** outcome for 24 hours and replays it byte-for-byte with
`Idempotent-Replay: true`. Rules:

- **No header, no change.** Existing clients behave exactly as before.
- **Same key, different body → `409 IDEMPOTENCY_CONFLICT`.** Silently replaying
  the first response would perform the wrong action.
- **Keys are scoped per member and per endpoint**, so a shared key in a client
  library cannot collide across users or routes.
- **Failures are never stored**, so a corrected retry (add credits, fix the
  payload) works immediately.
- **Expired keys are reusable**; a daily sweep (`prune-idempotency-keys`) deletes
  rows past their window.

## Evidence in the contract

`POST /api/v1/watch` documents an `evidence` object in its response:

```json
{
  "status": "verified",
  "watchVerified": false,
  "xpAwarded": 0,
  "evidence": {
    "level": "self_report",
    "paid": false,
    "verifiedSeconds": 212,
    "reason": "Watch recorded, but this deployment only pays for server-verified attention"
  }
}
```

`level` is one of `youtube_api | signed_session | self_report | none`. Clients render the server's
explanation rather than re-implementing the policy (`SEC-010` in
[roadmap/10-platform-api.md](roadmap/10-platform-api.md)).
