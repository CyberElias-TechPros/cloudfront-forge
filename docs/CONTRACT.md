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
| Documented coverage never regresses (ratchet)                                       | `tests/contract/openapi.test.ts` |
| Only registered error codes are returned, with the registered status                | `tests/contract/errors.test.ts`  |
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

- 45 of 110 router entries are documented today (`x-contract.coverage` in the document).
- The remainder are listed in `inventory.generated.json` with `auth: "undocumented"`.
- **The ratchet only moves up.** `tests/contract/openapi.test.ts` fails if coverage drops; raise
  the floor in that test as endpoints are added. `PLAT-002` progressively moves every remaining
  schema into `src/contract/schemas/` until the whole surface is typed.
- Response bodies can be declared `freeFormDataSchema` (`additionalProperties: true`) while their
  payload is stabilised — visible honesty beats a wrong schema. Replace those with real schemas as
  each endpoint's shape settles.

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
