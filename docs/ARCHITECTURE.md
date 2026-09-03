# Architecture

CreatorLoop (repo: `cloudfront-forge`) is a gamified watch/subscribe exchange for
YouTube creator communities. It runs on exactly two runtimes:

```
Browser (Vercel, static SPA)
   │  fetch(`${VITE_API_URL}/api/v1/...`, { Authorization: Bearer <Firebase ID token> })
   ▼
Cloudflare Worker  (workers/api)
   ├── D1    creatorloop-db      — all relational state
   ├── KV    KV_CACHE            — rate-limit counters, YouTube metadata cache, OAuth state
   ├── R2    creatorloop-assets  — uploaded top-up receipts
   └── Cron  "0 0 * * *"          — daily jobs (streaks, sweeps, digests)

Firebase Authentication — identity provider only. The browser signs in with
Google, the Worker verifies the ID token against Google's public keys.
```

No other backend platform is involved: there is no Node server, no SSR runtime
and no second database.

## Why this shape

| Concern | Where it lives | Why |
| --- | --- | --- |
| UI | Vercel static SPA (`dist/client`) | Deploys from a static directory, SPA fallback rewrite for client routing, CDN + immutable asset caching for free |
| API | Cloudflare Worker | Single deployable, cold-start-free, runs next to D1/KV/R2 |
| Relational data | D1 (SQLite) | Transactions, partial/partial-unique indexes, `ON CONFLICT` upserts — all used by the reward ledger |
| Counters & caches | KV | Rate limiting and YouTube metadata, both eventually-consistent by nature |
| Binary uploads | R2 | Top-up receipts are private objects; streamed to admins only |
| Scheduled work | Cron Triggers | Daily streak decay, challenge sweeps, digests |
| Identity | Firebase Auth | Already integrated; the Worker verifies tokens, never trusts the client's user id |

Durable Objects and Queues are deliberately **not** used. Every consistency
requirement in the product (one payout per watch session, one pending top-up per
member, one claim per mission assignment) is enforced with conditional
`UPDATE ... WHERE status = ...` statements plus unique/partial indexes, which is
all D1 needs — a single-object coordination service would add a runtime for no
gain.

## Frontend

- TanStack Start in **SPA mode** (`tanstackStart.spa.enabled`, `nitro: false`).
  `vite build` emits `dist/client`; `scripts/postbuild-spa.mjs` publishes
  `_shell.html` as `index.html`, writes `sitemap.xml`/`robots.txt` when
  `SITE_URL` is set, deletes the unused `dist/server` bundle and fails the build
  if a secret-shaped string reaches the public bundle.
- Data access goes through React Query hooks in `src/hooks/use-api.ts`. Hooks do
  **not** swallow errors: a failed request becomes `isError` so pages can render
  an error state instead of a misleading empty list.
- `src/lib/api.ts` reads `VITE_API_URL`. In `vite dev` the SPA calls same-origin
  `/api/*` and Vite proxies to the Worker, so local development needs no CORS.
  In production `VITE_API_URL` must be set — there is no localhost fallback.

## Worker

```
src/index.ts        entry: CORS, security headers, rate-limit tiers, routing, cron
src/lib/router.ts   regex route matching (patterns compiled once, cached)
src/routes/index.ts the single `routes` table (90 entries) — the only routing source
src/middleware/     auth (Firebase token + admin roles), rate limiting, error envelope
src/lib/            database (D1 wrapper that throws), xp, scoring, audit, sanitize,
                    push (Web Push), quests, rewards, analytics, logger
src/jobs/           cron entry points
migrations/         001…030, applied in filename order
```

### Request lifecycle

1. `/health` short-circuits before any environment validation.
2. `OPTIONS` preflight is answered with the resolved CORS origin.
3. Required bindings are validated (`MISSING_ENV` → `503`).
4. Rate limiting per IP + tier (`auth`, `expensive`, `write`, `read`); auth,
   expensive and admin routes fail closed.
5. `findRoute()` matches method + path; unknown → `404`.
6. The handler runs with `requireAuth` / `requireAdmin` where needed.

### Data integrity rules the schema enforces

- `watch_session_tokens` + conditional updates: one payout per watch session.
- `uq_topup_requests_pending_reference`: a transfer reference can await review
  once; combined with the `pending` status lock, approval cannot double-credit.
- `mission_assignments` status lock: mission rewards are claimable once.
- `credit_accounts`/`credit_transactions`: every spend writes a ledger row with
  `balance_after`, and the spend + effect are written in one batch.
- `admin_users`: role checks live in `requireAdmin`, not in individual handlers.

## Security model

- **AuthN**: Firebase ID tokens verified against Google JWKS; with caching and
  audience/project checks. A dev token is accepted **only** when
  `ENVIRONMENT !== "production"`.
- **AuthZ**: `requireAuth` for members, `requireAdmin` for `admin`/`super_admin`.
- **CORS**: comma-separated allow-list in `CORS_ORIGINS`; `*.example.com` matches
  one subdomain level. Unknown origins get **no** CORS header (the origin is
  never echoed back).
- **Input**: Zod schemas; validated data (not the raw body) is what gets written.
  Text is passed through `sanitize()` (strips markup and control characters) —
  never HTML-escaped, because React escapes at render time and escaping twice
  rendered `R&amp;D` literally.
- **Secrets**: only ever in Cloudflare Secrets or `.dev.vars`. `WATCH_SESSION_SECRET`
  is mandatory in production. `src/tests/repo-hygiene.test.ts` (frontend) and
  `workers/api/tests/architecture.test.ts` (worker) fail if credentials or an
  env example with real values are committed.
- **Rate limiting**: KV counters per IP, stricter on auth/expensive/admin.

## Telemetry

Structured JSON logs (`src/lib/logger.ts`) with `level`, `timestamp`, `message`,
`environment` and context. Database failures log the SQL and driver message but
the client only ever sees a generic `DATABASE_ERROR`.
