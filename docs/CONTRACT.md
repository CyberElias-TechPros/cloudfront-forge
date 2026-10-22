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

| Guarantee                                                                           | Test                             |
| ----------------------------------------------------------------------------------- | -------------------------------- |
| Every registry entry matches a real route                                           | `tests/contract/openapi.test.ts` |
| No duplicate route entries, operation ids or tags                                   | `tests/contract/openapi.test.ts` |
| Path templates match route pattern groups                                           | `tests/contract/openapi.test.ts` |
| Committed JSON equals a fresh build                                                 | `tests/contract/openapi.test.ts` |
| Documented coverage never regresses (floor is now 100%)                             | `tests/contract/openapi.test.ts` |
| No inline Zod schema survives in `src/routes/*` (all shapes come from the contract) | `tests/contract/openapi.test.ts` |
| Every operation declares a success schema and unique query parameters               | `tests/contract/openapi.test.ts` |
| Only registered error codes are returned, always as literals, with the registered status | `tests/contract/errors.test.ts`  |
| `/openapi.json` is served, cached, CORS-aware and available during misconfiguration | `tests/contract/served.test.ts`  |

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
   npm run contract:build && npm run docs:api
   ```

5. **Run the gates**: `npm --prefix workers/api test` (includes contract tests) and
   `npm --prefix workers/api run typecheck`.

## Consuming the contract

- **Live document:** `GET https://<worker>/openapi.json` (`Cache-Control: public, max-age=300`).
- **Web:** generate types with `openapi-typescript` from the committed document (part of `PLAT-006`).
- **Android:** generate the Kotlin client with `openapi-generator` (`kotlin` + `kotlinx.serialization`)
  into `android/core/network-api` (part of `PLAT-007`). The generated module is never hand-edited.

Until the generated clients land, `src/lib/api-client.ts` mirrors the documented payloads by hand;
the response types for the watch loop already match the contract (`WatchClaimResultDTO`,
`WatchEvidenceDTO`).

## Coverage policy

- **110 of 110 router entries are documented** (`x-contract.coverage` in the document, PLAT-002).
- `tests/contract/openapi.test.ts` keeps the floor at 100%: adding a route to the router table
  without a registry entry fails the suite, and `inventory.generated.json` records the audit.
- Request and response shapes live only in `src/contract/schemas/**`; a handler that writes
  `z.object(...)` inline fails the same suite.
- Where a handler's parser is deliberately lenient (AI chat trims strings, the top-up reject reason
  is clamped), the schema documents the accepted shape even though validation is manual. The
  contract test forces the *shape* into the contract; it does not pretend the handler rejects.
- Response bodies that are still row-shaped are declared field-by-field with `.passthrough()`,
  including the snake_case columns the SQL actually returns. Normalising those names is a breaking
  change tracked separately — a contract that "tidies up" would lie to generated clients.
- Media types are explicit: `multipart/form-data` for the receipt upload, `image/*` for the receipt
  download, `text/event-stream` for `/ai/chat/stream`.

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
