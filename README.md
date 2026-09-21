# CreatorLoop (`cloudfront-forge`)

Gamified, cheat-resistant watch-for-watch growth for YouTube creator communities.
Members earn credits and XP by genuinely watching, subscribing to and commenting
on each other's videos; verification is server-side, rewards are paid once, and a
weighted leaderboard ranks the squad.

**Two runtimes, no more:**

| Layer    | Platform           | What it is                                                          |
| -------- | ------------------ | ------------------------------------------------------------------- |
| Frontend | Vercel             | Static SPA (`dist/client`) built by Vite/TanStack Start in SPA mode |
| API      | Cloudflare Workers | TypeScript Worker on D1 (SQLite), KV, R2 and a daily cron           |
| Identity | Firebase Auth      | Google Sign-In; the Worker verifies ID tokens                       |

---

## Quick start

```sh
# 1. Worker (http://localhost:8787)
cd workers/api
cp .env.example .dev.vars        # fill in real values
npm ci
npm run db:migrate:local
npm run dev

# 2. SPA (http://localhost:3000) — Vite proxies /api/* to the worker
cd ../..
npm ci
npm run dev
```

In development `VITE_API_URL` stays empty: the browser calls same-origin
`/api/*` and Vite forwards to the Worker, so no CORS setup is needed.

---

## Repository layout

```
src/                     React SPA (routes, hooks, components)
  hooks/use-api.ts       React Query hooks — errors propagate, never swallowed
  lib/api.ts             API client: VITE_API_URL, auth header, error mapping
public/sw.js             Service worker (web push notifications)
scripts/postbuild-spa.mjs  Publishes index.html, SEO files, secret-leak guard
workers/api/             Cloudflare Worker
  src/index.ts           Entry: CORS, security headers, rate limits, account gate, routing, cron
  src/routes/index.ts    The single routing table (110 routes)
  src/lib/               database, xp, scoring, audit, sanitize, push, quests…
  src/middleware/        auth + RBAC (admin & moderator tiers), rate limiting, error envelope
  migrations/            001…036, applied in filename order
  tests/                 284 behavioural tests over a real SQLite database
vercel.json              Static SPA deployment + caching + security headers
```

---

## Commands

| Where         | Command                                                | What it does                                       |
| ------------- | ------------------------------------------------------ | -------------------------------------------------- |
| root          | `npm run dev`                                          | Vite dev server with an `/api` proxy to the Worker |
| root          | `npm run build`                                        | Static SPA build + postbuild SEO/secret guard      |
| root          | `npm run preview`                                      | Serve the built SPA                                |
| root          | `npm run lint`                                         | ESLint (frontend + worker)                         |
| root          | `npm test`                                             | Frontend unit tests (Vitest)                       |
| `workers/api` | `npm run dev`                                          | `wrangler dev`                                     |
| `workers/api` | `npm run deploy` / `deploy:staging`                    | Migrate D1, then deploy production / staging       |
| `workers/api` | `npm run db:migrate:local` / `:staging` / `db:migrate` | Apply D1 migrations                                |
| `workers/api` | `npm test`                                             | Worker tests (Vitest + in-memory SQLite)           |
| `workers/api` | `npm run typecheck`                                    | `tsc --noEmit`                                     |

Node **22** is what the project targets. The worker test suite runs on Node 20
as well: it drives a real SQLite database through `node:sqlite` when the runtime
provides it (Node >= 22.5) and falls back to a WebAssembly build of SQLite
otherwise, so CI on Node 20 stays green.

---

## Testing

```sh
npm test                 # frontend: api client, hooks, repo hygiene
cd workers/api && npm test   # 284 tests across 36 files
```

The worker tests are behavioural, not mock theatre: `tests/helpers/test-env.ts`
applies every migration to an in-memory SQLite database (foreign keys on, as D1
has) and provides KV/R2 doubles, so handlers run against the same SQL, indexes
and constraints as production. The database comes from `node:sqlite` when the
runtime has it, otherwise from `node-sqlite3-wasm`; force the fallback with
`SQLITE_DRIVER=wasm npm test` to check that path. Covered: watch claims and payout idempotency, XP/level maths,
leaderboard scoring, admin authorization, top-up review, video submission,
review completion, shop purchases, missions, push encryption (real RFC 8291
decryption), routing, and the Worker entry point (CORS, rate limiting, 503 on a
missing secret).

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — runtime topology, data
  integrity rules, security model
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — the exact Vercel + Cloudflare
  runbook (resources, secrets, migrations, verification, rollback)
- [`docs/API.md`](docs/API.md) — every endpoint, generated from the route table
- [`docs/RECONSTRUCTION_REPORT.md`](docs/RECONSTRUCTION_REPORT.md) — what was
  audited, fixed, tested and what remains open
- [`docs/CI_WORKFLOW_UPDATE.md`](docs/CI_WORKFLOW_UPDATE.md) — CI changes that
  need a one-time manual apply
- [`workers/api/.env.example`](workers/api/.env.example) and
  [`.env.example`](.env.example) — every variable, with what belongs in a secret
- `docs/archive/` — historical audits and status reports, kept for context only

---

## Environment variables at a glance

**Frontend (Vercel, all public):** `VITE_API_URL`, `VITE_FIREBASE_*`,
`VITE_VAPID_PUBLIC_KEY`, optional `VITE_ADSENSE_SLOT_ID`, `SITE_URL`.

**Worker (Cloudflare):** bindings `DB`, `KV_CACHE`, `ASSETS_BUCKET`; secrets
`FIREBASE_PROJECT_ID`, `WATCH_SESSION_SECRET`, `AI_API_KEY`, `YOUTUBE_API_KEY`,
`YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET`, `RESEND_API_KEY`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`; vars `ENVIRONMENT`, `CORS_ORIGINS`,
reward/AI/rate-limit tuning (all documented in `wrangler.toml` and
`.env.example`).

`WATCH_SESSION_SECRET` is **mandatory** when `ENVIRONMENT=production` — the
Worker refuses to sign watch tokens with a fallback key.

---

## Security notes

- Firebase ID tokens are verified against Google's public keys; the dev token is
  accepted only outside production. Identity endpoints derive the account from
  the verified token: `POST /auth/register` ignores any client-supplied
  `firebaseUid` (it can neither read nor pre-create another account), and
  `GET /auth/permissions` answers only for the caller — an admin role is needed
  to read another member's permissions.
- Account lifecycle is complete: members can delete their own account
  (`DELETE /users/me`, soft delete with every open loop closed), and admins can
  suspend/reinstate members. Deleted, suspended and banned accounts are
  rejected at the Worker entry point with `ACCOUNT_DELETED` /
  `ACCOUNT_SUSPENDED` / `ACCOUNT_BANNED` before any handler runs.
- Admin routes require an `admin`/`super_admin` row via `requireAdmin`.
- `CORS_ORIGINS` is enforced (never echoed); `*.example.com` matches one
  subdomain level.
- Requests are Zod-validated and the validated payload — not the raw body — is
  what gets written. Text is stripped of markup, never double-escaped.
- Rate limits are per IP with stricter tiers for auth, expensive and admin
  routes (which fail closed).
- `src/tests/repo-hygiene.test.ts` fails if a credential-shaped string is ever
  committed again.

---

## License

Private — all rights reserved.
