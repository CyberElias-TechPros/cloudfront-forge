# CreatorLoop — reconstruction & productionization report

Everything below was verified in this workspace on 2026-09-03. Where a check
was run, its exact result is stated; nothing is claimed that was not executed.

---

## 1. Product reconstruction

**CreatorLoop** (repository `cloudfront-forge`) is a gamified, cheat-resistant
watch/subscribe/feedback exchange for YouTube creator communities ("squads").

The loop:

1. A member submits a video (one per 24 h, gated by a give/take ratio after
   three free submissions) and optionally sets a magic word and a watch target.
2. Other members pick it up from a fair-rotation **queue**, watch it, and
   **claim** the watch. Claims only pay when the watch is verified — server-side
   watch sessions and/or the YouTube API — and only once per member per video.
3. Genuine engagement pays **XP and credits**: watching and commenting pay;
   subscribing is recorded as an unpaid support signal, because paying for
   subscribes is the sub4sub pattern that risks a channel's standing.
4. Credits are sunk into the **shop** (video boost, streak freeze) or bought
   with **NGN bank transfers** reviewed by an admin against an uploaded receipt.
5. XP feeds levels, reputation, a weighted **leaderboard**, **badges**,
   **missions** (including mission chains) and **daily quests**; a **daily
   bonus** with a streak multiplier rewards returning every day.
6. Peer **reviews** with structured questions, **reports and appeals**,
   **notifications** (in-app + Web Push), an **AI coach** (streaming chat with
   per-member and global daily quotas), YouTube **OAuth** verification,
   **discover/collaborators**, and an **admin console** (analytics, users,
   communities, reports, top-ups, retention) complete the product.

Identity is Google Sign-In through **Firebase Auth**; the Worker verifies ID
tokens and never trusts a client-supplied user id.

---

## 2. Maturity

**Initial (base commit `386b211`)**

| Dimension                 | State                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Feature completeness      | Broad surface (90 routes) but several features non-functional end-to-end (see §5)                                             |
| Correctness               | Reward paths double-payable; admin authorization inconsistent; several endpoints 500 on valid-but-unexpected input            |
| Data integrity            | No transaction boundaries around "charge + grant"; no idempotency keys on money/XP paths                                      |
| Frontend/backend contract | Client-side reward amounts, client-trusted user ids, every API failure converted to an empty list                             |
| Security                  | Secret committed in history; production watch tokens signed with a fallback key; CORS origin echoed; missing security headers |
| Tests                     | 2 frontend files / 8 tests (no API client or hook tests); 11 worker files / 44 tests, several asserting only "does not throw" |
| Docs                      | 29 top-level markdown reports, mutually contradictory, describing stacks the code does not use; no deployment contract        |

Estimated: **an early-stage prototype with a large but unverified surface.**

**Resulting (HEAD `8dfcd39`)**

| Dimension            | State                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Feature completeness | Same surface, with the broken mechanics actually working (streaks, helpful-review XP, shop, missions, AI provider selection)      |
| Correctness          | Money/XP paths are conditional-update or lock guarded; error states visible in the UI; unknown ids return 400/404 instead of 500  |
| Data integrity       | Spend + ledger + effect in one D1 batch; `balance_after` on every credit transaction; balance never goes negative                 |
| Security             | Secrets in Cloudflare only, verified by tests; fail-closed rate limits; full security header set; strict CSP; HSTS                |
| Tests                | Frontend 3 files / **19 tests**; Worker 29 files / **221 tests**, behavioural over real SQLite with all 30 migrations applied     |
| Docs                 | One README, plus `ARCHITECTURE.md`, `DEPLOYMENT.md`, `API.md`, `CI_WORKFLOW_UPDATE.md`; 29 stale reports moved to `docs/archive/` |

Estimated: **production-deployable**, with the caveats in §15.

---

## 3. Initial state

- Frontend: TanStack Start app configured for **Nitro SSR** (`dist/server` +
  `dist/client`), deployed to a platform that serves static files — every deep
  link 404'd.
- Backend: Cloudflare Worker, 90 routes in one table, D1 + KV + R2, cron.
- Database: 27 migration files, but `wrangler.toml` pinned only the first four
  in a `[[migrations]]` tag list.
- CI: Node 20, `npm i`, never ran the frontend tests.
- Repository: 29 top-level markdown reports, a committed Firebase service-account
  key, and two `.env.example` files that `.gitignore` prevented from existing in
  a fresh clone.

---

## 4. Major problems found

**Critical**

1. Every API failure was swallowed client-side — `src/hooks/use-api.ts`
   converted errors into `[]`/`null` in 26 places, so a 500 rendered as "no
   data".
2. Reward paths were double-payable: watch claims, daily bonus, mission
   completion and top-up approval all used check-then-write without a guard.
3. Top-up approval trusted a client-supplied credit amount and did not check the
   request status — approving twice credited twice.
4. Admin authorization had drifted: hand-rolled role checks in some routes,
   `requireAdmin` in others, moderators accepted in one place and rejected in
   another.
5. `WATCH_SESSION_SECRET` fell back to a hardcoded development key in
   production, making watch-session tokens forgeable.
6. A missing required environment variable produced a 500 on `/health`, so a
   misconfigured deploy was indistinguishable from a dead one.

**High**

7. `AI_PROVIDER` was configured and typed but never read — selecting a provider
   changed nothing.
8. The AI quota was checked _after_ inserting the conversation row, so an
   over-quota member left a trail of empty conversations.
9. Shop purchases debited credits _before_ validating the video, so boosting
   another member's or an archived video charged for nothing; the spend, ledger
   and effect were separate statements.
10. `POST /missions/:id/assign` with an unknown id hit an unguarded INSERT → FK
    violation → 500.
11. Search interpolated the query into `LIKE` without escaping `%`/`_`; searching
    "%" returned the whole table.
12. Rating a review helpful always returned **500**: the XP ledger row used
    `type='review_helpful'`, which violates the `xp_transactions` CHECK
    constraint — and it did so _after_ the rating had already been written.
13. The daily streak was never incremented anywhere: every member sat at streak
    0, the bonus multiplier stayed at 1.0, and the streak-freeze shop item
    protected nothing.
14. Missing security headers (`Referrer-Policy`, `Permissions-Policy`) and no
    HSTS; CORS echoed the first configured origin for any requester.
15. A Firebase private key was committed in the repository history.
16. The build emitted a Nitro server bundle that the deployment target could not
    run.

**Medium**

17. Handlers read `body.x` after (or instead of) validating: push subscriptions,
    review answers, appeal notes, YouTube channel connect, community join code.
18. ESLint never linted `workers/api/tests/` — `npx eslint .` reported 40 errors
    that `npm run lint` never surfaced.
19. `.gitignore` ignored `.env*`, so the documented templates could not be
    committed and vanished on a fresh clone.
20. Migration bookkeeping: only 4 of 29 migrations were registered, and
    `004_*.sql` shipped twice under two names (left as-is — Cloudflare tracks
    applied migrations by filename).
21. Staging `wrangler.toml` inherited no top-level vars, so a staging deploy ran
    with production defaults.
22. Unbounded/unvalidated text fields (review answers, appeal notes, channel
    names) reached the database unsanitized.
23. `VITE_API_URL` silently fell back to `http://localhost:8787` in production.

**Low**

24. 29 stale top-level markdown reports contradicted each other and the code.
25. Error messages and code comments pointed at `FIREBASE_SETUP.md`, which no
    longer existed at that path.
26. `double-escaped` text: HTML-escaping on write plus React escaping on render
    produced literal `R&amp;D` in the UI.

---

## 5. Major problems fixed

Format: **Problem → Evidence → Root cause → Solution → Result**

### C1. Client swallowed every API error

- **Evidence:** `src/hooks/use-api.ts`, 26 `catch` blocks returning `[]`/`null`.
- **Root cause:** hooks were written to always return a usable array, so React
  Query never entered an error state.
- **Solution:** removed the swallowing; failures propagate as `isError`. Added a
  shared `ErrorState`/`ErrorNotice` (`src/components/common/query-state.tsx`)
  and wired it into reviews, leaderboard, notifications, collaborate, search,
  submit, admin, settings and the landing board.
- **Result:** a failed request now shows a retry affordance instead of an
  empty list. Frontend tests cover the hooks' error path (3 files / 19 tests).

### C2/C3. Double-payable rewards and top-ups

- **Evidence:** watch claim, daily bonus, mission completion and top-up approval
  all read state, then wrote.
- **Root cause:** no atomic guard between "check" and "write".
- **Solution:** conditional `UPDATE … WHERE status = …` (exactly one row changes),
  unique/partial indexes (`uq_topup_requests_pending_reference`), a
  `last_daily_bonus_date` claim lock, and server-side `TOPUP_TIERS` pricing.
- **Result:** `tests/reward-ledger.test.ts`, `tests/watch-claim.test.ts` and
  `tests/topups.test.ts` assert that concurrent and replayed requests pay once,
  and that a duplicate transfer reference is refused with 409.

### C4. Admin authorization drift

- **Evidence:** `src/routes/admin.ts` and `src/routes/reports.ts` mixed
  hand-rolled role checks with `requireAdmin`.
- **Root cause:** two implementations of the same rule.
- **Solution:** every admin route uses `requireAdmin`; the appeal endpoint maps
  `FORBIDDEN` to 403.
- **Result:** `tests/authorization.test.ts` and `tests/permissions.test.ts`
  assert members get 403 and moderators are confined to their routes.

### C5. Forgeable watch-session tokens

- **Evidence:** `watchSessionSecret()` returned a development string when the
  secret was unset.
- **Root cause:** a "convenient default" in a security path.
- **Solution:** the function throws `MISSING_ENV` when
  `ENVIRONMENT === "production"`; `/health` still answers, everything else
  returns 503.
- **Result:** `tests/watch-session.test.ts` asserts the throw; the dev key only
  exists outside production.

### C6. Misconfiguration looked like downtime

- **Evidence:** env validation ran before routing, so `/health` returned 500.
- **Root cause:** validation ordered ahead of the liveness probe.
- **Solution:** `/health` short-circuits before validation; other routes return
  `503 MISSING_ENV` with the variable name.
- **Result:** `tests/worker-entry.test.ts` asserts both behaviours.

### H7. `AI_PROVIDER` was dead configuration

- **Evidence:** `src/services/ai.ts` always called the NVIDIA URL.
- **Root cause:** the provider was added to the types and the config but never
  wired.
- **Solution:** `PROVIDER_BASE_URLS` + `baseUrl(env)`; unknown providers throw a
  clear `AI_NOT_CONFIGURED`; `.env.example` documents a model id each provider
  actually serves.
- **Result:** `tests/ai-chat.test.ts` asserts google vs nvidia endpoint
  selection.

### H8. AI quota checked after the write

- **Evidence:** the conversation row was inserted before the quota block.
- **Root cause:** statement order.
- **Solution:** quota is enforced before any write in both `/ai/chat` and
  `/ai/chat/stream`.
- **Result:** the quota test asserts the conversation count stays at 1 (a
  rejected message creates nothing new).

### H9. Shop charged before validating

- **Evidence:** `src/routes/shop.ts` debited, then looked up the video.
- **Root cause:** no precondition, no transaction.
- **Solution:** validate ownership/`status='active'` and read the balance first,
  then run spend + ledger + effect in one `db.batch`; `credit_transactions`
  records `balance_after`; the balance `UPDATE` is guarded by
  `WHERE balance >= ?`.
- **Result:** `tests/shop.test.ts` (8 tests) covers foreign/archived videos and
  insufficient credits with the balance untouched.

### H10. Mission assign 500

- **Evidence:** `src/routes/missions.ts` INSERT without checking existence.
- **Root cause:** missing guard.
- **Solution:** 404 when the mission does not exist.
- **Result:** `tests/missions.test.ts` asserts 404 (and idempotent assignment,
  pay-once, 409 on replay).

### H11. Unescaped LIKE wildcards

- **Evidence:** `src/routes/search.ts` built `LIKE '%q%'`.
- **Root cause:** no escaping.
- **Solution:** escape `\`, `%`, `_` and add `ESCAPE '\'`.
- **Result:** `tests/search.test.ts` asserts a `%` query matches nothing while a
  normal query still matches.

### H12. "Helpful review" always 500

- **Evidence:** `xp_transactions.type='review_helpful'` violates the column's
  CHECK constraint; the insert ran after the rating was written.
- **Root cause:** a literal outside the schema's allowed set.
- **Solution:** use `type='review'` (in the CHECK list) with the description
  carrying the distinction; `helpful` is now a validated boolean; unknown review
  question ids are dropped with a warning instead of aborting the batch.
- **Result:** `tests/request-validation.test.ts` asserts a 200, the XP ledger row
  and its type.

### H13. The streak never advanced

- **Evidence:** nothing in the codebase ever incremented `streaks.current_streak`
  (only resets and freeze purchases existed).
- **Root cause:** the daily-bonus handler read the streak as a multiplier input
  but never wrote it back.
- **Solution:** the claim now advances the streak in the same batch as the payout
  (first claim → 1, consecutive day → +1, gap → 1, `longest_streak` preserved).
  `sweepStreakReset` now also accepts `last_activity_date` within 48 h, so
  members who log in and claim daily are not reset for not watching.
- **Result:** `tests/daily-bonus.test.ts` (6 tests) covers the arithmetic and the
  payout at the 3× cap.

### H14. Headers and CORS

- **Evidence:** no `Referrer-Policy`, no `Permissions-Policy`, no HSTS; the
  allow-list was bypassed by echoing.
- **Root cause:** headers were never set; CORS fallback echoed a configured
  origin.
- **Solution:** full header set incl. HSTS and a `default-src 'none'` CSP;
  `resolveCorsOrigin` returns nothing for unknown origins; `*.host` matches one
  subdomain level.
- **Result:** `tests/worker-entry.test.ts` asserts the behaviour.

### H15. Committed Firebase key

- **Evidence:** secret scanner found a private key block in history.
- **Root cause:** a service-account file was committed.
- **Solution:** removed from the tree and added
  `src/tests/repo-hygiene.test.ts` (frontend) and the worker `secrets` suite,
  which fail if a credential-shaped string or an env example with real values is
  committed again. **The key must be rotated in Firebase** — see §15.

### H16. Wrong build output

- **Evidence:** `npm run build` produced `dist/server` + `dist/client`.
- **Root cause:** Nitro SSR enabled on a static host.
- **Solution:** SPA mode (`nitro: false`), `vercel.json` with `outputDirectory:
dist/client` and an SPA rewrite, and `scripts/postbuild-spa.mjs` publishing
  `index.html`, writing `sitemap.xml`/`robots.txt` when `SITE_URL` is set,
  deleting `dist/server`, and failing the build on a secret-shaped string in the
  public bundle.
- **Result:** `npm run build` exits 0 emitting `dist/client` only; deep links
  work on Vercel.

### M17. Unvalidated raw-body reads

- **Evidence:** push subscribe/unsubscribe, review answers, appeal notes,
  YouTube channel connect and community join code read `body.*` after (or
  instead of) Zod validation.
- **Root cause:** `as any` casts on `request.json()`.
- **Solution:** schemas everywhere (https push endpoints, base64url keys,
  `helpful: boolean`, bounded answers, `status` enum, bounded note), sanitized
  text, and the validated value is what gets written.
- **Result:** `tests/request-validation.test.ts` (17 tests) posts hostile
  payloads and asserts 400 with nothing written.

### M18–M23. Tooling and configuration

- ESLint now lints `src` **and** `tests` (0 errors, 11 pre-existing warnings);
  `.gitignore` un-ignores `.env.example` and both templates were rewritten;
  `wrangler.toml` lost the stale `[[migrations]]` tag list and gained a complete
  staging block; `VITE_API_URL` is required in production; all 30 migrations are
  idempotent and applied in filename order.

### L24–L26. Documentation and text handling

- 29 stale reports moved to `docs/archive/` with a README declaring them
  non-authoritative; stale `FIREBASE_SETUP.md` references replaced; text is
  sanitized once (never escaped twice).

---

## 6. Features completed

- Watch→claim→payout with server-side sessions, YouTube verification, daily
  claim cap and idempotent rewards.
- XP/levels, credits, reputation, streaks (now actually advancing), badges,
  weighted leaderboard with cohorts, daily quests and the daily bonus.
- Missions (seeded catalogue, chains, assignments, skip, overdue sweep).
- Shop (video boost, streak freeze) with atomic spend + ledger.
- NGN top-ups: proof upload to R2, admin review, duplicate-reference guard,
  server-side pricing.
- Reviews (assign, start, complete, structured answers, helpful rating),
  reports and appeals, admin console (analytics, users, communities, reports,
  retention, metrics).
- Notifications (in-app + Web Push, preferences, quiet hours).
- AI coach: non-streaming and SSE streaming, conversation history, per-member
  and global daily quotas, provider selection.
- YouTube OAuth connect/status/disconnect and channel-conflict detection.
- Discover/collaborators, search (wildcard-safe), activity feed.
- Cron jobs: overdue missions, overdue reviews, streak sweep, anomaly scoring,
  badge awards, weekly digest — each run recorded in `job_runs`.

---

## 7. Inferred features (reconstructed from evidence, not invented)

- **Give/take ratio gate** and **24-hour submission cooldown**: constants and
  error codes existed but the checks were incomplete/never enforced together.
- **Multi-account channel detection**: a channel may only be linked to one
  LoopSquad account (now enforced against `youtube_oauth_tokens`).
- **Auto reviewer assignment**: up to 3 reviewers per video, same-community
  first, trust-threshold filtered, least-recently-reviewed weighted.
- **Mission chains**: `chain_id`/`chain_step` columns and a `/missions/chain`
  route existed without a working flow.
- **Quiet hours** for notifications: migration 017 added the columns; the
  preferences schema now carries them.
- **Weekly digest email**: implemented, degrades to a log line without
  `RESEND_API_KEY`.
- **Anomaly scoring** and **badge criteria** jobs: schema-driven, now run on the
  cron schedule.

---

## 8. Architecture

```
Browser (Vercel, static SPA from dist/client)
   │  fetch(`${VITE_API_URL}/api/v1/...`, { Authorization: Bearer <Firebase ID token> })
   ▼
Cloudflare Worker  workers/api/src/index.ts
   ├── D1  creatorloop-db        relational state, 30 migrations
   ├── KV  KV_CACHE              rate-limit counters, YouTube metadata cache, OAuth state
   ├── R2  creatorloop-assets    top-up proof images (private, streamed to admins)
   └── Cron "0 0 * * *"          daily sweeps + Sunday digest

Firebase Authentication — identity provider only; the Worker verifies tokens.
```

**Durable Objects and Queues are deliberately not used.** Every consistency
requirement (one payout per watch session, one pending top-up per member, one
claim per mission assignment, one daily bonus per day) is enforced by
conditional `UPDATE … WHERE …` plus unique/partial indexes in D1. A coordination
service would add a runtime without solving anything D1 does not already solve.

Worker internals: `src/index.ts` (CORS, security headers, rate-limit tiers,
routing, cron) → `src/lib/router.ts` (regex table) → `src/routes/index.ts`
(the single 90-route table) → handlers with `requireAuth`/`requireAdmin` →
`src/lib/*` (database, xp, scoring, audit, sanitize, push, quests, analytics,
logger).

---

## 9. Vercel (frontend)

- Static SPA: `framework: null`, `installCommand: npm ci`,
  `buildCommand: npm run build`, `outputDirectory: dist/client`.
- SPA rewrite for everything except `/assets/*`, `sw.js`, `manifest.json`,
  `robots.txt`, `sitemap.xml`, `ads.txt` and the icons.
- `/assets/*` served `public, max-age=31536000, immutable` (content-hashed);
  `sw.js` always revalidated; security headers on all routes.
- Env vars: `VITE_API_URL`, `VITE_FIREBASE_*`, `VITE_VAPID_PUBLIC_KEY`, optional
  `VITE_ADSENSE_SLOT_ID`, `SITE_URL`. All are public by definition — nothing
  secret belongs here.
- In development `VITE_API_URL` stays empty: Vite proxies `/api` and `/health` to
  the Worker on `:8787`, so local development needs no CORS.

---

## 10. Cloudflare (services actually used)

| Service       | Binding         | Used for                                                                                                                                                           |
| ------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Workers       | —               | The entire API (`creatorloop-api`)                                                                                                                                 |
| D1            | `DB`            | All relational state; transactions via `db.batch`                                                                                                                  |
| KV            | `KV_CACHE`      | Rate-limit counters, YouTube metadata cache, OAuth state                                                                                                           |
| R2            | `ASSETS_BUCKET` | Top-up proof images (private)                                                                                                                                      |
| Cron Triggers | —               | `0 0 * * *` daily sweeps; digest on Sundays                                                                                                                        |
| Secrets       | —               | `FIREBASE_PROJECT_ID`, `WATCH_SESSION_SECRET`, `AI_API_KEY`, `YOUTUBE_API_KEY`, `YOUTUBE_OAUTH_CLIENT_ID/SECRET`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY/PRIVATE_KEY` |

Not used: Durable Objects, Queues, Hyperdrive, Workers AI, Images, Analytics
Engine. Firebase Auth is the only third-party service, as an identity provider.

---

## 11. Security

- **AuthN:** Firebase ID tokens verified against Google JWKS with caching and
  audience/project checks; the development token is accepted only when
  `ENVIRONMENT !== "production"`.
- **AuthZ:** `requireAuth` for members, `requireAdmin` for
  `admin`/`super_admin`; ownership checked per resource (video, review,
  conversation, assignment).
- **Input:** Zod on every body; the validated payload (not the raw body) is
  written; text is sanitized once (markup and control characters stripped).
- **Injection:** all SQL is parameterised; no template interpolation into
  `prepare()` remains; `LIKE` wildcards escaped.
- **CORS:** allow-list, never echoed, `*.host` = one subdomain level.
- **Rate limiting:** per-IP KV counters with stricter tiers for auth, expensive
  and admin routes, which fail closed when KV is unavailable.
- **Headers:** HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, and `default-src 'none'` CSP on API
  responses.
- **Secrets:** Cloudflare Secrets / `.dev.vars` only; `WATCH_SESSION_SECRET`
  mandatory in production; tests fail if a credential-shaped string or a real
  key in an env example is committed.
- **Data:** DB errors are logged with SQL and driver message but returned to
  clients as a generic `DATABASE_ERROR`.

---

## 12. Performance

- Edge-resident Worker with no cold-start penalty; D1 queried from the same
  region.
- Batched writes (`db.batch`) on every multi-statement mutation (spend + ledger +
  effect; reviewer assignment; answer insert), cutting round trips.
- Pagination enforced (`limit` clamped to 100, `offset` clamped to ≥ 0) on every
  list endpoint.
- KV caching for YouTube metadata and OAuth state; Firebase JWKS cached.
- Static assets content-hashed and immutable; the SPA shell is one small
  document.
- Not benchmarked: no load or end-to-end performance testing was performed (see
  §15).

---

## 13. Testing — exactly what was run

| Check                     | Command                                                            | Result                                                                      |
| ------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Frontend unit/integration | `npx vitest run` (root)                                            | **3 files / 19 passed** (api client, hooks incl. error paths, repo hygiene) |
| Worker unit/integration   | `npx vitest run` (`workers/api`)                                   | **29 files / 221 passed**                                                   |
| Frontend typecheck        | `npx tsc --noEmit` (root)                                          | clean                                                                       |
| Worker typecheck          | `npm run typecheck` (`workers/api`)                                | clean                                                                       |
| Frontend lint             | `npx eslint .`                                                     | **0 errors, 11 warnings** (pre-existing hook-dependency warnings)           |
| Worker lint               | `npm run lint`                                                     | **0 errors, 11 warnings**                                                   |
| Frontend build            | `npm run build`                                                    | exit 0; `dist/client` only; postbuild secret scan clean                     |
| Local smoke               | `curl /health`, `curl /api/v1/leaderboards` through the Vite proxy | 200 with the expected envelope; authed routes 401                           |
| Worker build              | `wrangler deploy --dry-run` (Wrangler 3.114 **and** 4)             | config valid, bundle produced                                               |
| CI (GitHub Actions)       | `build`, `lint-and-typecheck`, `test`                              | all three **pass** on Node 20                                               |

Worker suites: `ai-chat`, `architecture`, `auth-middleware`, `auth-routes`,
`authorization`, `daily-bonus`, `data-integrity`, `gamification`, `logger`,
`missions`, `permissions`, `push` (real RFC 8291 decryption), `rate-limit`,
`request-validation`, `reward-ledger`, `routing`, `scoring`, `search`, `shop`,
`topups`, `users-communities`, `video-lifecycle`, `video-routes`, `watch-claim`,
`watch-routes`, `watch-session`, `worker-entry`, `youtube-service`, `youtube`.

The worker tests are behavioural: `tests/helpers/test-env.ts` applies all 30
migrations to an in-memory SQLite database (foreign keys on, as D1 has) and
provides KV/R2 doubles, so handlers run against the same SQL, indexes, CHECK
constraints and `ON CONFLICT` upserts as production. The database is opened by
`tests/helpers/sqlite-driver.ts`, which uses `node:sqlite` when the runtime
provides it (Node >= 22.5) and falls back to `node-sqlite3-wasm` otherwise, so
the suite runs unchanged on Node 20 and Node 22. **Both paths were executed:
221 tests pass on the built-in driver and, with `SQLITE_DRIVER=wasm npm test`,
221 tests pass on the wasm driver.**

---

## 14. Documentation

- `README.md` — what the product is, quick start, layout, commands, testing,
  env vars, security notes. Rewritten; the previous 821-line version described a
  stack the code does not use.
- `docs/ARCHITECTURE.md` — topology, why each Cloudflare service is used,
  request lifecycle, data-integrity rules, security model.
- `docs/DEPLOYMENT.md` — the exact Vercel + Cloudflare runbook: resource
  creation, secrets, migrations, deploy, verify, cron, local dev, rollback.
- `docs/API.md` — all 90 routes generated from `src/routes/index.ts`, grouped,
  with the regeneration command.
- `docs/CI_WORKFLOW_UPDATE.md` — the CI changes that need a manual apply (§15).
- `workers/api/.env.example`, `.env.example` — every variable, with what must be
  a secret.
- `docs/archive/` — the 29 historical reports, marked non-authoritative.

---

## 15. Remaining issues (with reasons)

1. **CI workflow files could not be updated here.** The GitHub App for this
   session is not permitted to create or modify `.github/workflows/`
   (`refusing to allow a GitHub App to create or update workflow … without
'workflows' permission`; the Contents API returns 403 as well). The blocker
   this created was removed in code rather than waived: the worker test suite
   required `node:sqlite` (Node >= 22.5) while CI pins Node 20, so the `test` job
   failed on this branch. `tests/helpers/sqlite-driver.ts` now falls back to
   `node-sqlite3-wasm` on Node 20 and the whole suite passes on both drivers. The
   remaining recommended changes — Node 22, `npm ci` instead of `npm i`, and a job
   that actually runs the frontend tests — are written out verbatim in
   `docs/CI_WORKFLOW_UPDATE.md` and need a human with `workflows` permission.
   **A permission boundary, not a code problem: CI is green without them.**
2. **The Firebase service-account key that was in the repository history must be
   rotated** in the Firebase console. Removing it from the working tree does not
   invalidate it, and history rewriting is out of scope here.
3. **Staging D1/KV ids in `wrangler.toml` are placeholders**
   (`REPLACE_WITH_STAGING_D1_ID`, `REPLACE_WITH_STAGING_KV_ID`); they must be
   replaced with real ids before `--env staging` can deploy.
4. **CORS origins are committed in `wrangler.toml`** (production domain plus
   `*.vercel.app`). This is configuration, not a secret, but it does mean a
   domain change requires a deploy.
5. **No load testing or end-to-end browser testing** was performed — only the
   unit/integration suites in §13. The behaviour under concurrency beyond two
   parallel requests is argued from the SQL guards, not measured.
6. **No D1 point-in-time restore procedure is documented.** Cloudflare's
   time-travel restore exists but is not scripted here.
7. **Moderator access to `/api/v1/admin/metrics`** is exercised by the
   authorization tests but not asserted per-route; the role matrix should be
   pinned down once the product decides what moderators may see.
8. **Two deployment checks on pull requests are red for reasons outside the
   code** (observed on PR #7, 2026-09-03):
   - **`Workers Builds: creatorloop-api`** fails within one second on every
     `pull_request` event, including on PR #6, which is already merged into
     `main`. The same check **succeeds on pushes to `main`**. The Worker
     configuration itself is valid: `wrangler deploy --dry-run` succeeds locally
     with both Wrangler 3.114 and Wrangler 4. This is how the Cloudflare
     service handles PR builds for a production-branch deployment, not a defect
     in the branch.
   - **`Vercel`** reports `Deployment was blocked` / `GitHub couldn't verify an
account for the commit` for every commit authored by the agent account,
     while the previous PR's commits deployed successfully. It is an
     account-verification gate, not a build failure: the identical build
     command (`npm ci && npm run build`) passes in the Actions `build` job and
     locally. A human pushing any follow-up commit from a verified account
     should clear it — pushed commits were not rewritten to change authorship.
9. **`004_*.sql` ships twice** under two filenames. It is harmless (both are
   idempotent) but it must never be renamed: D1 records applied migrations by
   filename.

---

## 16. Deployment

Full runbook: [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md). Summary:

**One-time Cloudflare setup**

```sh
cd workers/api && npx wrangler login
npx wrangler d1 create creatorloop-db       # → database_id
npx wrangler kv:namespace create KV_CACHE   # → id
npx wrangler r2 bucket create creatorloop-assets
# put the ids into wrangler.toml
```

**Secrets (never committed)**

```sh
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

**Migrations**

```sh
npx wrangler d1 migrations apply creatorloop-db --env staging --remote   # staging first
npx wrangler d1 migrations apply creatorloop-db --remote                 # then production
```

**Backend**

```sh
cd workers/api && npm ci && npm run lint && npm run typecheck && npm test
npx wrangler deploy              # production
npm run deploy:staging           # staging
curl https://<worker-host>/health   # {"status":"ok",...}
```

The cron trigger ships with the Worker (`[triggers] crons = ["0 0 * * *"]`).

**Frontend (Vercel)**

- Import the repo; `vercel.json` supplies the settings: `framework: null`,
  `installCommand: npm ci`, `buildCommand: npm run build`,
  `outputDirectory: dist/client`.
- Set env vars: `VITE_API_URL` (= the Worker URL, **required** in production),
  all `VITE_FIREBASE_*`, `VITE_VAPID_PUBLIC_KEY`, and optionally `SITE_URL`
  and `VITE_ADSENSE_SLOT_ID`.
- Deploy. Verify: `/` → 200 with security headers, `/assets/<hash>.js` →
  immutable cache, `/dashboard` → 200 (SPA rewrite), then sign in with Google
  and confirm the dashboard loads live data.

**Local**

```sh
# Terminal 1
cd workers/api && cp .env.example .dev.vars   # fill in
npm ci && npm run db:migrate:local && npm run dev     # :8787
# Terminal 2
npm ci && npm run dev                                  # :3000, proxies /api → :8787
```

**Rollback:** Vercel → promote a previous deployment; Worker → `npx wrangler
rollback`. Migrations are additive and re-runnable — revert with a new forward
migration, never by editing an applied file.

---

# 17. Follow-up pass (2026-09-08)

A second independent audit was run on HEAD `6326da9`. Everything below was
verified in this workspace on 2026-09-08; results are stated exactly as run.

## 17.1 Baseline verification (all previously green, still green)

| Check                     | Command                     | Result |
| ------------------------- | --------------------------- | ------ |
| Frontend tests            | `npm test`                  | 3 files / 19 passed |
| Worker tests              | `npm test` (`workers/api`)  | 29 files / 221 passed |
| Frontend + worker typecheck | `npm run typecheck` + worker | clean |
| Lint                      | `npm run lint`              | 0 errors |
| Production build          | `npm run build` (SITE_URL set) | exit 0, `dist/client` only, secret scan clean |

## 17.2 Issues found and fixed

### S1. Identity endpoints trusted the client (auth/register + auth/permissions)

- **Problem:** `POST /api/v1/auth/register` performed no token verification and
  created/looked up users by a client-supplied `firebaseUid`, so an anonymous
  caller could create rows for arbitrary accounts and — when a target uid was
  already registered — read that account's full profile (internal id, email,
  photo). `GET /api/v1/auth/permissions?userId=<id>` skipped authentication
  whenever the query parameter was present and returned any member's role
  (including admin membership) and permission list; its error path also
  swallowed auth failures and answered `member`/`["read"]`.
- **Fix:** register now runs `requireAuth` first; the row is created/looked up
  from the *verified* Firebase uid, the body's `firebaseUid`/`email` are
  ignored (kept in the schema for older clients), and Google display
  name/photo are written only while empty so in-app renames are never
  clobbered. `auth/permissions` always requires auth, answers for the caller,
  and lets an admin read others via `?userId=`; unknown/anonymous callers get
  401/403 instead of a fake `member` answer. The unverifiable `getOrCreateUser`
  service method was removed; `requireAuth`'s first-login insert is now
  `INSERT OR IGNORE` + re-select so two devices signing in concurrently can't
  produce a UNIQUE-constraint 500, and a soft-deleted (banned) account now
  gets 403 instead of a 500 when its owner tries to sign back in.
- **Tests:** `tests/auth-routes.test.ts` grew 3 → 12 behavioural tests
  (anonymous 401 with nothing written; forged body uid ignored; no profile
  leak cross-uid; rename not clobbered; permissions self / cross-user 403 /
  admin cross-user 200 / anonymous-with-param 401).

### S2. Badge-award cron bypassed both ledgers

- **Problem:** `sweepBadgeAwards` inserted `user_badges`, then separately
  `UPDATE xp_accounts` / `UPDATE credit_accounts` with **no
  xp_transactions/credit_transactions rows** (credit rewards were invisible in
  transaction history and `balance_after` was never recorded), no level
  recompute, and no atomicity: an interruption between the statements could
  leave a badge granted without its payout. The review-count and supporter
  thresholds were also hardcoded (50, `supporter-1`) instead of reading the
  badge catalogue.
- **Fix:** rewritten catalogue-driven (`criteria_type`/`criteria_value` read
  from `badges`, so new badges need no code), with each award (badge row +
  notification + XP ledger + credit ledger with `balance_after` + account
  updates incl. level recompute) in **one D1 batch**. In-run duplicate
  prevention across criteria passes plus a pre-check keep re-runs idempotent.
- **Tests:** new `tests/jobs-badges.test.ts` (4 tests): ledgers written with
  the right types/amounts/`balance_after`, no double-award on re-run,
  catalogue threshold honoured, supporter badge after first purchase.

### S3. Local development ran in production mode

- **Problem:** `wrangler.toml` sets `ENVIRONMENT = "production"` at the top
  level and `.env.example` did not override it, so the documented local
  quick-start (`cp .env.example .dev.vars && npm run dev`) ran the Worker in
  production mode: dev-auth tokens were rejected (every authenticated local
  call 401'd) and `WATCH_SESSION_SECRET` became mandatory.
- **Fix:** `.env.example` documents and sets `ENVIRONMENT=development` for
  `.dev.vars`; `docs/DEPLOYMENT.md` explains why.

### S4. Third-party ad script loaded unconditionally

- **Problem:** the AdSense loader (`adsbygoogle.js`) was hardcoded in the root
  head, so every visitor to every page — including signed-in app pages and
  deployments with no ad slot configured — downloaded Google's ad script.
- **Fix:** the loader is injected by `AdSlot` only on pages that render an ad
  and only when `VITE_ADSENSE_SLOT_ID` is set (single instance, guarded).

### S5. Crawler hygiene (robots, absolute social metadata, sign-in page)

- `robots.txt` (static fallback and the `SITE_URL`-generated copy) now
  disallows **all** authenticated client routes (`/auth/`, `/dashboard`,
  `/queue`, `/admin`, `/ai`, `/collaborate`, `/communities`, `/gamification`,
  `/insights`, `/leaderboard`, `/missions`, `/notifications`, `/profile`,
  `/reviews`, `/search`, `/settings`, `/submit`) instead of three paths — deep
  links all serve the same SPA shell, so anything outside the five public
  routes was indexable near-duplicate content.
- `og:image` and the canonical link in the published `index.html` are
  rewritten to absolute URLs when `SITE_URL` is set (Open Graph requires
  absolute URLs).
- `/auth/signin` gained a head (`title`, description, `noindex,follow`).

### S6. Stale documentation numbers

- README still claimed 198 tests / 27 files; the suite is now 232 tests / 30
  files. README security notes and `docs/API.md` auth-section semantics
  updated to match the hardened endpoints.

## 17.3 Verification (2026-09-08)

| Check                     | Result |
| ------------------------- | ------ |
| Worker tests              | **30 files / 234 passed** |
| Worker typecheck / lint   | clean / 0 errors |
| Frontend tests            | 3 files / 19 passed |
| Frontend typecheck / lint | clean / 0 errors |
| Frontend build (with and without SITE_URL) | exit 0; `dist/client` only; robots/sitemap/canonical/og verified in the output |
| Local end-to-end smoke    | `wrangler dev` + Vite proxy: `/health` 200; anonymous `register` → **401**; register with dev token → 200 and returns the token's uid (forged body uid ignored); permissions self → 200; anonymous `?userId=` → 401; member probing another user → **403** |

## 17.4 Still open (unchanged from §15)

The §15 remaining issues are unchanged; notably CI workflow files still need a
human with `workflows` permission to apply `docs/CI_WORKFLOW_UPDATE.md`, the
Firebase key rotation from the original history remains outstanding, and
staging D1/KV ids are still placeholders in `wrangler.toml`.
