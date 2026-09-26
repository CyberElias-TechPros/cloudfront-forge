# LoopSquad product readiness

Updated 2026-09-25. This document describes the product as it exists in the
repository, the end-to-end happy paths, and the operational work that must be
completed before a real launch.

## Product reconstruction

LoopSquad is a creator feedback and growth community for small YouTube squads.
It is not a view-selling or paid-subscribe product. A member submits a video,
other members give verified attention and useful feedback, and the platform
turns those contributions into XP, credits, missions, streaks, insights and
fair queue placement.

### Primary people and jobs

| Person          | Job to be done                                                                   |
| --------------- | -------------------------------------------------------------------------------- |
| Creator         | Submit a video, understand what to improve, and receive useful attention.        |
| Contributor     | Find another creator's video, watch it thoughtfully, and leave genuine feedback. |
| Community owner | Start a private/public squad and manage membership.                              |
| Moderator/admin | Resolve reports, review top-ups, and protect the integrity of the loop.          |

## End-to-end happy paths

### New member

1. Open the public landing page.
2. Choose **Enter the loop**.
3. Authenticate with Google (or the local dev session in development).
4. Firebase provides an ID token; the Worker verifies it and creates the D1 user row.
5. The app loads the profile, member stats, permissions, notifications, and daily quests.
6. The member lands on the dashboard with a clear next action.

### Community owner

1. Open **Communities** and create a community.
2. The Worker creates the community, owner membership, settings, and invite code.
3. Share the invite code.
4. New members join through the invite endpoint; capacity and duplicate membership are enforced.
5. The community detail route shows the member roster and roles.

### Video contribution

1. Open **Submit a video**.
2. Paste a standard YouTube, Shorts, live, embed, or youtu.be URL.
3. Optionally add a title, niche, and magic word.
4. The Worker validates the URL, fetches metadata when configured, falls back to the canonical thumbnail when YouTube is unavailable, and writes an active video.
5. Duplicate videos, cooldowns, ratio gates, and channel conflicts are rejected with a useful response.
6. Review assignments, quest progress, notifications, and analytics are created after submission.

### Verified contribution

1. Open **Watch Queue** and select a squad video.
2. Play the embedded video while the tab is focused.
3. Player time, playback rate, mute state, attention challenges, and optional signed heartbeats are used to determine eligible watch time.
4. The contributor may open YouTube to leave genuine feedback and optionally subscribe. Subscribing is never paid for.
5. The Worker pays eligible watch and feedback rewards exactly once through the credit/XP ledgers.
6. Query caches refresh so the dashboard, queue, activity, missions, streaks and leaderboard stay current.

### Rewards and commerce

1. A member claims the daily bonus once per UTC day.
2. XP updates the canonical level curve; credits update the ledger with `balance_after`.
3. Shop purchases validate ownership and balance before atomically applying a boost or streak freeze.
4. NGN top-ups use fixed server-side tiers. A receipt is stored in private R2, then an admin approves or rejects it.
5. Approval is status-locked and cannot credit twice; every review is auditable.

### Review and moderation

1. A reviewer opens an assigned review and starts it.
2. The review form answers the server-provided questions.
3. Completion validates the score, text, and answer limits, pays once, and notifies the submitter.
4. A member can report a resource; an admin resolves or dismisses it with notes.
5. Affected members can appeal through the appeal route.

## What is implemented

- Vercel-compatible static SPA with SPA fallback, a prerendered public landing page,
  canonical metadata, sitemap, robots rules, and a public-bundle secret leak guard.
- Cloudflare Worker API with D1, KV, R2, cron jobs, rate limiting, structured logs,
  security headers, Firebase token verification, server-side authorization, and
  versioned migrations.
- YouTube URL parsing and metadata degradation path.
- Communities, queue, submissions, reviews, missions, quests, XP, credits,
  streaks, badges, leaderboard, notifications, push, AI chat, YouTube OAuth,
  discover, reports, appeals, shop, top-ups, insights, and admin console.
- Atomic or status-locked reward operations and audit records.
- Responsive motion system with reduced-motion support, keyboard-visible focus,
  accessible labels, loading/error states, and a bespoke public experience.
- Frontend/backend contract corrections for Worker camel-cased responses
  (daily quests, top-ups, AI conversations, search, and admin analytics).
- Full lifecycle and moderation (2026-09-16): account deletion (soft, closes
  every open loop), entry-point gate for deleted/suspended/banned accounts,
  community leave / join-requests with approval / member roles / member removal /
  invite-code rotation / archive, video archive, admin suspension & reinstatement,
  platform role management, appeals queue (accepted appeals reverse the penalty
  and restore removed videos), member support channel, overdue-review
  notify-then-reassign sweep, and the "reports against me" appeal entry point.
  See `docs/COMPLETENESS.md` for the gap analysis and user-story flows.

## Launch blockers outside the codebase

These values are intentionally not committed and must be configured per
environment:

- Firebase web configuration and authorized production/preview domains.
- Worker secrets: `WATCH_SESSION_SECRET`, `AI_API_KEY`, YouTube credentials,
  VAPID private key, and optional email credentials.
- Cloudflare production D1/KV/R2 resources and a remote migration run.
- `CORS_ORIGINS` containing only the actual Vercel production and preview
  origins.
- `VITE_API_URL` pointing at the deployed Worker in the Vercel project.
- `SITE_URL` for the production sitemap and absolute social metadata.
- Real bank settlement/reconciliation ownership for NGN top-ups.

No ranking, traffic, or Page 1 outcome is guaranteed. SEO work removes avoidable
technical weaknesses; search visibility still depends on useful public content,
trust, links, competition, and search-engine decisions.

## Release order

1. Create/verify Firebase project and authorized domains.
2. Create production D1, KV, and R2 resources; set binding IDs in Wrangler.
3. Add Worker secrets with `wrangler secret put`.
4. Apply all D1 migrations remotely (the deployment workflow does this before code).
5. Deploy the Worker and require both `/health` and `/ready` to pass before an authenticated profile request.
6. Set Vercel public variables (`VITE_API_URL`, Firebase config, VAPID public key,
   `SITE_URL`) and deploy the SPA.
7. Run the smoke flow: sign in → create/join community → submit video → queue →
   watch/claim → mission → notification → sign out/sign in again.
8. Verify scheduled jobs, Worker logs, rate limits, CORS, and the production
   rollback path.

## Verification status

The repository's automated suites were run on 2026-09-25:

- Frontend: `npm run typecheck`, `npm test` (26 tests / 4 files), and
  `npm run build` — passed.
- End-to-end: `npm run test:e2e` — 6 Playwright smoke flows (real Chromium,
  Vite dev server, `wrangler dev` with local D1) passed in ~25 s; runbook in
  `docs/D1_RESTORE.md` for point-in-time recovery.
- Worker: `npm --prefix workers/api run typecheck`,
  `npm --prefix workers/api test` — 299 tests passed (37 files), including
  readiness/schema-drift coverage and the lifecycle/moderation suites.
- Lint: `npm run lint` — passed with existing non-blocking warnings in generated/UI
  component exports and a few test fixtures.
- Worker bundle: Wrangler 4.135.0 `deploy --dry-run --env=""` — passed.
- Dependency audit: root and Worker, production-only and full trees — zero known vulnerabilities.
- Local smoke: all 37 migration filenames applied; `/health` and `/ready` 200;
  auth registration plus member, permissions, notifications, XP, streaks,
  activity, queue, submissions, daily quests, and communities all returned 200
  with a development token.

Real Google OAuth, YouTube OAuth, AI provider calls, Web Push delivery, R2
production storage, and remote Cloudflare resources remain environment-dependent
and were not represented as verified local integrations.
