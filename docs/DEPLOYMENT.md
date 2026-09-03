# Deployment runbook

Two independent deploys, in this order: **backend first** (the frontend can
point at it), then **frontend**.

- Frontend → **Vercel**, static SPA from `dist/client`.
- Backend → **Cloudflare Workers**, with D1, KV, R2 and a cron trigger.

---

## 0. Prerequisites

```sh
node -v      # 22 is the target; 20 also works — the worker test suite falls
             # back to a WebAssembly build of SQLite without node:sqlite
npm -v       # >= 10
npx wrangler --version   # >= 3
```

You need: a Cloudflare account (Workers + D1 + KV + R2), a Vercel account, a
Firebase project with Google Sign-In enabled, and (optionally) a YouTube Data
API key, VAPID keypair and AI provider key.

---

## 1. Cloudflare resources (once)

```sh
cd workers/api
npx wrangler login

npx wrangler d1 create creatorloop-db      # → database_id
npx wrangler kv:namespace create KV_CACHE  # → id
npx wrangler r2 bucket create creatorloop-assets
```

Put the returned ids into `workers/api/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "creatorloop-db"
database_id = "<d1 id>"
migrations_dir = "migrations"

[[kv_namespaces]]
binding = "KV_CACHE"
id = "<kv id>"

[[r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "creatorloop-assets"
```

The production ids are already committed; you only change them if you are
deploying your own copy. For staging, replace
`REPLACE_WITH_STAGING_D1_ID` / `REPLACE_WITH_STAGING_KV_ID` in
`[env.staging]` with ids from:

```sh
npx wrangler d1 create creatorloop-db-staging
npx wrangler kv:namespace create KV_CACHE --env staging
npx wrangler r2 bucket create creatorloop-assets-staging
```

> `[env.staging]` does **not** inherit the top-level `[vars]` — every variable is
> duplicated in `[env.staging.vars]` on purpose.

---

## 2. Secrets and variables

Non-secret configuration lives in `wrangler.toml` `[vars]`. Everything else is a
secret and is never committed:

```sh
cd workers/api
npx wrangler secret put FIREBASE_PROJECT_ID
npx wrangler secret put WATCH_SESSION_SECRET   # openssl rand -hex 32
npx wrangler secret put AI_API_KEY
npx wrangler secret put YOUTUBE_API_KEY
npx wrangler secret put YOUTUBE_OAUTH_CLIENT_ID
npx wrangler secret put YOUTUBE_OAUTH_CLIENT_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
```

Staging equivalents: add `--env staging` to each command.

Mandatory in production: `FIREBASE_PROJECT_ID`, `ENVIRONMENT` (a var), and
`WATCH_SESSION_SECRET`. A request to a route other than `/health` with a binding
missing returns `503 MISSING_ENV` rather than failing later in a confusing way.

`CORS_ORIGINS` must contain the exact Vercel origin(s), e.g.

```
CORS_ORIGINS = "https://loop.example.com,*.vercel.app"
```

`*.vercel.app` matches preview deployments (one subdomain level only). Origins
outside the list receive no `Access-Control-Allow-Origin` header at all.

---

## 3. Database migrations

```sh
cd workers/api

# staging first
npx wrangler d1 migrations apply creatorloop-db --env staging --remote

# then production
npx wrangler d1 migrations apply creatorloop-db --remote
```

Migration files are the source of truth and are applied in filename order
(`migrations/001_*.sql` … `030_*.sql`). `wrangler.toml` intentionally has **no**
`[[migrations]]` tags — a hand-maintained tag list drifted out of sync with the
directory and silently skipped files.

`030_seed_missions.sql` seeds the starter mission catalogue with
`INSERT OR IGNORE`, so it is safe on an existing database and gives a fresh
install a populated Missions screen.

---

## 4. Deploy the backend

```sh
cd workers/api
npm ci
npm run lint
npx tsc --noEmit
npm test

npx wrangler deploy                 # production
# or
npm run deploy:staging              # wrangler deploy --env staging
```

Verify:

```sh
curl https://<worker-host>/health
# {"status":"ok","environment":"production","timestamp":"..."}
```

Tail logs with `npm run tail` (`wrangler tail`).

Note the Worker URL (`https://<worker>.<subdomain>.workers.dev` or a custom
domain) — the frontend needs it next.

---

## 5. Deploy the frontend (Vercel)

Import the repository in Vercel and keep these settings (they are committed in
`vercel.json`, so the dashboard only needs the environment variables):

| Setting          | Value                       |
| ---------------- | --------------------------- |
| Framework Preset | `Other` / `framework: null` |
| Build Command    | `npm run build`             |
| Output Directory | `dist/client`               |
| Install Command  | `npm ci`                    |

Environment variables (Vercel → Project → Settings → Environment Variables):

| Variable                            | Value                                                             |
| ----------------------------------- | ----------------------------------------------------------------- |
| `VITE_API_URL`                      | `https://<worker-host>` — **required**, there is no fallback      |
| `VITE_FIREBASE_API_KEY`             | Firebase web API key                                              |
| `VITE_FIREBASE_AUTH_DOMAIN`         | `<project>.firebaseapp.com`                                       |
| `VITE_FIREBASE_PROJECT_ID`          | same value as the Worker's `FIREBASE_PROJECT_ID`                  |
| `VITE_FIREBASE_STORAGE_BUCKET`      | `<project>.appspot.com`                                           |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender id                                                |
| `VITE_FIREBASE_APP_ID`              | Firebase app id                                                   |
| `VITE_VAPID_PUBLIC_KEY`             | same public key as the Worker's `VAPID_PUBLIC_KEY`                |
| `SITE_URL`                          | `https://loop.example.com` (enables `sitemap.xml` + `robots.txt`) |
| `VITE_ADSENSE_SLOT_ID`              | optional                                                          |

Then **Deploy**. Vercel runs `npm ci && npm run build`, which produces
`dist/client` only; the SPA fallback rewrite in `vercel.json` sends every
non-asset route to `/index.html` so client-side routing works on refresh.

### Verify after deploy

```sh
curl -I https://<site>/               # 200 + security headers
curl -I https://<site>/assets/<hash>.js   # Cache-Control: immutable
curl https://<site>/dashboard         # 200 (serves index.html)
```

Sign in with Google, then check that the dashboard loads live data (no
`Failed to fetch` in the console).

---

## 6. Cron

`wrangler.toml` declares:

```toml
[triggers]
crons = ["0 0 * * *"]
```

The schedule is deployed with the Worker — nothing else to configure. Confirm it
under Cloudflare → Workers → `creatorloop-api` → Triggers.

---

## 7. Local development

```sh
# Terminal 1 — Worker on http://localhost:8787
cd workers/api
cp .env.example .dev.vars       # then fill in real values
npm ci
npm run db:migrate:local        # wrangler d1 migrations apply creatorloop-db --local
npm run dev

# Terminal 2 — SPA on http://localhost:3000
npm ci
npm run dev                     # Vite proxies /api and /health to :8787
```

Leave `VITE_API_URL` empty locally: the Vite proxy means the browser calls
same-origin `/api/*`.

---

## 8. Rollback

- **Frontend**: Vercel → Deployments → Promote a previous deployment (instant).
- **Backend**: `npx wrangler rollback` (or redeploy the previous commit).
- **Migrations**: D1 has no automatic down-migration. Every migration in this
  repository is written to be additive and re-runnable; if you must revert one,
  write a new forward migration rather than editing an applied file — already
  applied migrations are tracked by filename in `d1_migrations`.

---

## 9. CI

GitHub Actions (`.github/workflows/ci.yml`) lint, typecheck, test and build both
packages. See [`CI_WORKFLOW_UPDATE.md`](./CI_WORKFLOW_UPDATE.md): the workflow
files still need a one-time manual update to Node 22 and to run the frontend
test job — the App used for automation is not permitted to change files under
`.github/workflows/`.
