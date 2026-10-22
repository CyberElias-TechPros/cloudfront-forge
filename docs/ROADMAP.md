# LoopSquad — Implementation Roadmap (web + native Android)

**Version:** 1.0 · **Created:** 2026-10-21 · **Owner:** product + engineering
**Baseline commit:** `e3ebcd9` · **Branch of record:** `arena/f05638e4-cloudfront-forge`
**Scope:** every step from "verified current state" to a launched, measurable, native Android app
plus a web app that earns its place as the public shopfront, account console and billing surface.

> **How to use this document.** This is the index. Every task lives in one of four workstream
> files, each task has a stable ID (`PLAT-003`, `WEB-024`, `AND-041`, `SEC-012`, `OPS-014`,
> `DATA-005`, `GRW-009`), and every task states **why it exists, what "done" means, what it
> integrates with, how big it is, and what it depends on**. Reference the ID in PR titles and
> issues; status lives in the task table and nowhere else.

| Document                                                     | Contains                                                                                        | Tasks   | Effort           |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------- | ---------------- |
| [00-audit-and-baseline.md](roadmap/00-audit-and-baseline.md) | Verified state on 2026-10-21 + 45 findings (`F-01…F-45`) with file/line evidence                | —       | —                |
| [10-platform-api.md](roadmap/10-platform-api.md)             | Contract-first API, native push, integrity & safety, privacy lifecycle (`PLAT`, `SEC`)          | 50      | 143 d            |
| [20-web.md](roadmap/20-web.md)                               | Instrument → performance → SEO/growth → a11y/i18n → monetization → offline/handoff (`WEB`)      | 45      | 120 d            |
| [30-android.md](roadmap/30-android.md)                       | Architecture decisions + the full native Android build, beta, launch and post-GA plan (`AND`)   | 86      | 219 d            |
| [40-ops-data-growth.md](roadmap/40-ops-data-growth.md)       | Environments, SLOs, release engineering, analytics, positioning & growth (`OPS`, `DATA`, `GRW`) | 56      | 96 d             |
| **Total**                                                    |                                                                                                 | **237** | **578 dev-days** |

**Status legend:** ✅ done · 🟡 partial · ⬜ to do · 🔒 blocked (reason required in the row)
**Effort unit:** dev-days of focused work for the role that owns the task (design/QA/PM time is
counted in `OPS`/`GRW` where it is the whole task).

---

## 1. What this product is, and who it must serve

LoopSquad (`cloudfront-forge`) is a **creator feedback and mutual-growth community for small
YouTube channels**. A member submits a video, other members give _verified attention and useful
feedback_, and the system turns those contributions into XP, credits, missions, streaks,
insights and fair queue placement. Identity is Google sign-in via Firebase; the API is a
Cloudflare Worker on D1/KV/R2; the web client is a static SPA on Vercel.

**Who actually uses it** (from the product's own positioning and the manifest's "WhatsApp creator
groups"):

| Person                        | Moment of need                                             | What "meeting them there" means                                                                               |
| ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Small creator (10–5 000 subs) | "I posted. Nobody watched. I don't know what's wrong."     | Fast submission from the YouTube share sheet; guaranteed attention with a deadline; feedback they can act on. |
| Contributor                   | "I have 10 minutes. Give me something worth watching."     | A queue that respects their time, a player that works on a cheap phone, a reward they can see.                |
| Squad owner                   | "I run a WhatsApp group of 40 creators. I need structure." | Invite links that work in chat, rules, roster, moderation, visible squad progress.                            |
| Moderator/admin               | "Something is wrong and someone is cheating."              | Evidence, timers, one-tap actions, audit trail.                                                               |
| Platform operator (you)       | "Is it working, is it safe, does it pay for itself?"       | SLOs, funnels, integrity metrics, unit economics, runbooks.                                                   |

**What "highest possible potential" concretely means here:**

1. **The promise is true.** Verified attention is actually verified, and the reward ledger cannot
   be farmed.
2. **It lives where the audience lives.** A native Android app that works on a 2 GB phone over
   intermittent data, and a web app that loads in under three seconds on the same connection.
3. **It is measurable and improvable.** Every claim in this roadmap is falsifiable by a number.
4. **It is safe to operate.** Policy-compliant, privacy-respecting, recoverable, and supportable
   by one or two people.

---

## 2. Where we are today (verified 2026-10-21)

| Signal                              | Value                                                        | Meaning                                                         |
| ----------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- |
| Web build + typecheck               | ✅ 940.7 kB JS / 83 chunks, 0 type errors                    | Ships, but no budgets or splitting discipline                   |
| Web tests                           | 4 files / 26 tests                                           | Hooks and API client are covered; UI is not                     |
| Worker tests                        | 43 files / 374 tests over real SQLite + all 38 migrations    | Strong asset — the safety net for this plan                     |
| API surface                         | 110 routes over 104 OpenAPI paths; **110/110 documented**    | Contract is complete, CI-gated at a 100% floor                  |
| Android                             | **nothing**                                                  | Greenfield, and its prerequisites are missing                   |
| Verified watching                   | **policy shipped, enforcement staged** (`F-01`)              | `EVIDENCE_POLICY` decides payout: prod `legacy`, staging capped |
| Product analytics / crash reporting | none (`F-36`)                                                | Cannot measure activation, retention or quality                 |
| Play blockers                       | blocking (`F-06`), payments (`F-30`), deletion page (`F-32`) | Cannot submit to Play today even if the app existed             |

Full evidence and the 45-item findings register: **[00-audit-and-baseline.md](roadmap/00-audit-and-baseline.md)**.

### What is already delivered (do not rebuild these)

| Capability                                                                                                     | Where it lives                                                           | Evidence                                                                               |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Reward ledger with pay-once guarantees (conditional updates, `balance_after`, batched spend+effect)            | `workers/api/src/routes/watch.ts`, `shop.ts`, `topups.ts`, `missions.ts` | `tests/reward-ledger.test.ts`, `watch-claim.test.ts`, `shop.test.ts`, `topups.test.ts` |
| Firebase token verification + RBAC (member/moderator/admin/super-admin)                                        | `services/firebase.ts`, `middleware/auth.ts`                             | `tests/authorization.test.ts`, `permissions.test.ts`, `auth-middleware.test.ts`        |
| Account lifecycle: soft delete closing every open loop, suspend/ban gate at the entry point                    | `routes/account.ts`, `index.ts`                                          | `tests/account-lifecycle.test.ts`, `admin-moderation.test.ts`                          |
| Communities: create/join/leave, roles, invite codes, join requests, archive, rules                             | `routes/communities.ts`, `community-management.ts`                       | `tests/community-management.test.ts`, `users-communities.test.ts`                      |
| Videos + reviews: URL parsing, metadata degradation, cooldowns, ratio gates, review SLA sweep and reassignment | `routes/videos.ts`, `jobs/sweeps.ts`                                     | `tests/video-lifecycle.test.ts`, `review-recovery.test.ts`                             |
| Gamification: XP/level curve, streaks, missions + chains, badges, daily quests, leaderboard                    | `routes/gamification.ts`, `missions.ts`, `lib/xp.ts`, `quests.ts`        | `tests/gamification.test.ts`, `missions.test.ts`, `scoring.test.ts`                    |
| Notifications: central `notify()` fan-out, preferences, quiet hours, Web Push (RFC 8291 verified)              | `lib/notify.ts`, `lib/push.ts`                                           | `tests/notify.test.ts`, `push.test.ts`                                                 |
| Moderation: reports, appeals with penalty reversal, support inbox, audit log                                   | `routes/reports.ts`, `support.ts`, `lib/audit.ts`                        | `tests/support.test.ts`, `admin-moderation.test.ts`                                    |
| 37 forward migrations applied in order, verified by `/ready`                                                   | `workers/api/migrations/`                                                | `tests/` bootstraps all migrations in SQLite                                           |
| Web SPA: 25 routes, prerendered landing, theme system, error states, dev auth, secret-leak guard               | `src/**`, `scripts/postbuild-spa.mjs`                                    | `npm run build`, `src/tests/**`                                                        |
| CI/CD: lint + typecheck + 303 worker tests + Vercel/Worker deploy with migration ordering                      | `.github/workflows/*`                                                    | CI configuration                                                                       |

This table is the reason the plan does not start with "build a backend": the backend is real. The
plan starts with **proving the promise** (integrity), **formalising the contract**, and **building
the surface the audience actually uses** (Android).

---

## 3. The three bets this roadmap makes

**Bet 1 — Contract first, then two clients.**
The 110-route API becomes a generated OpenAPI 3.1 contract with generated TypeScript _and_ Kotlin
clients, idempotent writes, request IDs, typed errors and cursor pagination. This is the single
highest-leverage decision: it lets web and Android be built in parallel without drift, makes
contract tests possible, and turns the API into a product (_PLAT-A_).

**Bet 2 — Integrity is the product.**
Signed watch sessions with heartbeat slope verification become mandatory; self-reported time
stops paying; Play Integrity feeds a risk tier; farming detection has evidence and an appeal path.
Without this, growth makes the product worse, not better (_SEC-1_).

**Bet 3 — Android is the primary surface, and it is fully native.**
Kotlin + Jetpack Compose, native navigation/notifications/billing/persistence. Exactly one WebView
exists — the YouTube IFrame player — because YouTube's native Player API was retired and embeds
require the HTML player. Everything else is Compose (_ADR-001_, _§3 of the Android doc_).

---

## 4. Target architecture

```
                     ┌───────────────────────────────┐
   Web (Vercel SPA)  │  Public pages · account console│
   React 19 + TS     │  billing · SEO · PWA           │
                     └──────────────┬────────────────┘
                                    │  HTTPS + Firebase ID token
   Android (native)                 │  (generated clients from one contract)
   Kotlin + Compose   ──────────────┤
   · Compose UI, Nav, Room          │
   · FCM push, Play Billing         │
   · Play Integrity                 │
   · 1 WebView: YouTube IFrame only │
                                    ▼
                     ┌──────────────────────────────────────────┐
                     │ Cloudflare Worker API  /api/v1           │
                     │ router · auth · RBAC · rate limit · Zod  │
                     │ idempotency · request ids · error registry│
                     ├──────────┬──────────┬────────────────────┤
                     │ D1       │ KV       │ R2                 │
                     │ ledger,  │ cache,   │ receipts, exports  │
                     │ claims,  │ rate     │                    │
                     │ content  │ limits   │                    │
                     ├──────────┴──────────┴────────────────────┤
                     │ Cron: streaks · sweeps · digests ·       │
                     │       integrity · retention              │
                     └───────┬───────────┬──────────┬───────────┘
                             │           │          │
                   Firebase Auth    FCM (HTTP v1)  YouTube Data API
                   (Google ID token) + Web Push     + OAuth
                             │           │          │
                        Google Play   Stripe / Paystack (web billing)
                        Billing +     Resend (email)
                        Play Integrity AI provider (coach)
```

**Deliberate non-goals** (documented so they don't creep back): no second runtime, no SSR server,
no message queue, no Durable Objects, no microservices, no Kubernetes, no iOS in this cycle
(decision memo only, `AND-109`).

---

## 5. Milestones

The plan is milestone-gated: a milestone is a **release decision**, not a date. Dates below assume
**Team shape A** (§6). Each milestone lists its exit criteria; the phase-level exit gates live in
the workstream documents.

| Milestone                                       | Target week | Ships                                                                                                                                                                                                                     | Exit criteria (all must hold)                                                                                                                                        |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0 — Baseline**                               | 0 (done)    | Verified audit, roadmap, task IDs                                                                                                                                                                                         | 303 worker + 26 web tests green; findings register published; branch of record agreed                                                                                |
| **M1a — Contract + evidence (done)**            | done        | OpenAPI 3.1 contract generated from the Zod schemas, served at `/openapi.json` and diff-gated in CI; error registry; watch-evidence policy with server-scored heartbeats wired into the claim; generated `docs/API.md`    | 374 worker + 26 web tests green; `EVIDENCE_POLICY=verified_only` provably pays 0 for fabricated watch time; the CI `contract` job fails on drift                     |
| **M1 — Contract & evidence**                    | 6           | OpenAPI + generated TS/Kotlin clients, idempotency, request IDs, error registry, rate-limit v2, analytics/crash reporting, watch-integrity engine behind a flag                                                           | Contract CI gate green; a forged claim pays 0 in staging; web funnel + Android crash dashboards live; `F-01/02` demonstrably closed behind flag                      |
| **M2 — Android internal MVP + web performance** | 12          | Compose app: sign-in, Home, Queue, native player + signed heartbeats, claim, submit, communities, missions, inbox + FCM; web instrumented, split, budgeted, a11y baseline                                                 | Internal-track build completes the full loop on a 2 GB device; push arrives foreground/background/terminated; web p75 LCP ≤2.5 s; app-crash-free ≥99 % in soak       |
| **M3 — Closed beta + growth surface**           | 16          | Reviews, leaderboard, rewards hub, AI coach, shop, search, support/report/block, moderation subset, adaptive layouts, a11y/localisation, Play Billing sandbox; public community/creator pages, structured data, 12 guides | 100 closed testers, ≥30 feedback items triaged; crash-free ≥99.5 %; blocking/report live everywhere; public pages indexable with valid structured data               |
| **M4 — GA (staged) + monetisation**             | 21          | Play production rollout 5→100 %, Play Billing verified server-side, store listing + policy declarations, web billing/account console/consent, deletion page, security review                                              | Play production live and stable at 100 % for 72 h; billing reconciles to ledger; policies submitted truthfully; export + hard-delete verified; threat model reviewed |
| **M5 — Compounding**                            | 26          | Widget, notification actions, referral, i18n #2, ASO experiments, cost/size reduction, accessibility audit, iOS memo                                                                                                      | North-star metric trending up week-over-week; K-factor measured; unit economics documented; next-quarter bets chosen                                                 |
| **M6 — Steady state**                           | 26+         | Continuous improvement cadence                                                                                                                                                                                            | Weekly metrics ritual, fortnightly roadmap review, quarterly business review (`OPS-025`)                                                                             |

---

## 6. Effort, capacity and what to cut

**Measured effort (from the task tables): 578 dev-days across 237 tasks.**

| Workstream                                        | Tasks   | Dev-days | Long pole?                  |
| ------------------------------------------------- | ------- | -------- | --------------------------- |
| Platform & API (`PLAT` 78 + `SEC` 65)             | 50      | 143      | Yes — gates both clients    |
| Web (`WEB`)                                       | 45      | 120      | No (parallelisable)         |
| Android (`AND`)                                   | 86      | 219      | **Yes — the critical path** |
| Ops/Data/Growth (`OPS` 36 + `DATA` 21 + `GRW` 39) | 56      | 96       | Shared across roles         |
| **Total**                                         | **237** | **578**  |                             |

### Team shape A — plan of record (≈26 weeks)

| Role                      | FTE | Owns                                                        |
| ------------------------- | --- | ----------------------------------------------------------- |
| Platform/backend engineer | 2   | `PLAT`, `SEC`, worker half of `OPS`/`DATA`                  |
| Android engineer          | 2   | `AND`                                                       |
| Web engineer              | 1.5 | `WEB`, client halves of `DATA`                              |
| Product designer          | 0.5 | `AND-015`, `WEB-013/014`, listing assets, store screenshots |
| QA / release engineer     | 0.5 | test matrix, Test Lab, release runbooks, pre-launch triage  |
| Product/PM + growth       | 1   | `GRW`, prioritisation, policy position, interviews          |

**Calendar envelope:** M1 → week 6, M2 → 12, M3 → 16, M4 → 21, M5 → 26. Overhead (reviews,
interrupts, support) is absorbed by the 5.5 FTE shape; if you run leaner, see below.

### Team shape B — lean (the honest arithmetic)

| Engineers | Calendar to GA (with ~20 % overhead) | What to cut to fit                                                                                                                                                                                                 |
| --------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1         | ~29 months                           | Not recommended for this scope                                                                                                                                                                                     |
| 2         | ~14–16 months                        | Cut `AND-C` insights/admin/AI/search (≈12 d), `AND-E` (23 d), web content engine + i18n (14 d), referral (5 d), Play Billing deferral to post-GA (6 d — but keep top-ups off-platform), AI coach stays server-only |
| 3         | ~9–10 months                         | Keep everything in the critical path, defer `AND-E` and `GRW-008/012` to M5+                                                                                                                                       |
| 4–5       | ~6–7 months                          | Full plan as written                                                                                                                                                                                               |

**Cut list, in the order to cut** (never cut these: `SEC` integrity, blocking, deletion/export,
billing policy compliance, contract tests):

1. `AND-054` insights, `AND-057` mobile moderation (keep web moderation), `AND-052` AI coach.
2. `AND-100…106` post-GA extras, `AND-109` iOS memo.
3. `WEB-022` 12 guides → 4; `WEB-031` locale #2.
4. `PLAT-029` multi-channel, `PLAT-016` cursor pagination (keep offset with limits).
5. `GRW-019` community programmes, `GRW-012` case studies.

**Never compress:** integrity work, contract generation, Play policy compliance, backup drills.
Those are the items that cost 10× more to retrofit than to do once.

---

## 7. Sequencing and dependencies

```
M0 ─▶ PLAT-001/002/003 (contract) ─┬─▶ PLAT-006 (TS client)  ─▶ WEB work
                                   └─▶ PLAT-007 (Kotlin client) ─▶ AND work
    ─▶ SEC-010/011/012 (evidence) ─▶ SEC-013 (enforce) ─▶ SEC-014/015 (attestation, farming)
    ─▶ OPS-004 (one deploy path) + OPS-002 (staging seed) ─▶ everything releasable
    ─▶ WEB-001/DATA-002 (events) ─▶ all measurement
    ─▶ PLAT-020/021/022 (device push) ─▶ AND-040 (notifications)
    ─▶ PLAT-013 (blocking) ─▶ AND-056 + Play UGC policy
    ─▶ PLAT-010 (idempotency) ─▶ AND-037/044 (submit + offline outbox)
    ─▶ SEC-026/027/028 (delete, export, consent) ─▶ Play data-safety + web console
    ─▶ AND-059 (Play Billing) ─▶ GRW-010 (revenue mix) ─▶ AND-060 (remove manual top-ups)
```

**Hard rules**

1. No Android feature lands before the endpoint it needs is in the contract and covered by a
   contract test.
2. No client launches a money path before idempotency keys are live.
3. No store submission before `PLAT-013` (block), `SEC-026` (deletion) and `AND-083` (declarations).
4. Feature flags land before the feature if the feature can affect payouts or revenue.

---

## 8. Success metrics (baseline → target)

Baselines marked "—" are unmeasured today, which is itself finding `F-36`.

| Metric                                                       | Definition                                            | Baseline | M2      | M4            | M5            |
| ------------------------------------------------------------ | ----------------------------------------------------- | -------- | ------- | ------------- | ------------- |
| North star: weekly verified contributions per active creator | claims with strong evidence ÷ WAU creators            | —        | measure | ≥8            | ≥12           |
| Activation                                                   | new member completes 5-step first session within 24 h | —        | measure | ≥40 %         | ≥50 %         |
| D7 retention (creator)                                       | returns and contributes in week 1                     | —        | measure | ≥25 %         | ≥30 %         |
| D30 retention                                                | contributes in month 1                                | —        | measure | ≥12 %         | ≥15 %         |
| Strong-evidence claim share                                  | signed session or YouTube API                         | ~0 %     | ≥50 %   | ≥90 %         | ≥95 %         |
| Review SLA compliance                                        | reviews completed ≤48 h                               | —        | measure | ≥85 %         | ≥90 %         |
| Web p75 LCP (mobile)                                         | RUM                                                   | —        | ≤2.5 s  | ≤2.2 s        | ≤2.0 s        |
| Android crash-free sessions                                  | Play vitals                                           | n/a      | ≥99 %   | ≥99.5 %       | ≥99.7 %       |
| Push opt-in rate                                             | Android / web                                         | n/a      | measure | ≥25 % / ≥15 % | ≥35 % / ≥20 % |
| API availability                                             | 5xx + timeouts                                        | —        | ≥99.9 % | ≥99.9 %       | ≥99.95 %      |
| Credit inflation                                             | credits spent ÷ credits earned                        | —        | measure | 0.6–0.9       | 0.6–0.9       |
| Unit cost per MAU                                            | infra + AI + email ÷ MAU                              | —        | measure | <$0.05        | <$0.04        |
| Store rating                                                 | Play                                                  | n/a      | n/a     | ≥4.2          | ≥4.3          |
| Referral K-factor                                            | invites → activated members                           | n/a      | n/a     | 0.15          | ≥0.3          |

---

## 9. Top risks and their mitigation

| #   | Risk                                                                    | Likelihood × impact | Mitigation                                                                                                                       | Owner / task                          |
| --- | ----------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| R1  | Rewards are farmed; the leaderboard is meaningless                      | High × Severe       | Evidence-based payouts, signed sessions, attestation, farming detection, appeal path                                             | Platform / `SEC-010…016`              |
| R2  | YouTube ToS or Play policy action (category is full of banned products) | Medium × Severe     | Written refusal policy (no view selling, no sub4sub payouts, no automation), careful store copy, report+block, Play Billing only | PM / `GRW-016`, `AND-060`, `PLAT-013` |
| R3  | Android never reaches GA (scope creep, greenfield)                      | Medium × Severe     | Milestone gates, feature freeze after M3, explicit cut list, 2 Android engineers                                                 | Eng lead / §6                         |
| R4  | Contract drift between web and Android                                  | Medium × High       | Generated clients, CI contract gate, wire-level tests                                                                            | Platform / `PLAT-003/005/009`         |
| R5  | Play rejection (payments, UGC, reviewer access, data safety)            | Medium × High       | Policy checklist in Android doc §9, seeded demo community for reviewers                                                          | Release / `AND-083/084`               |
| R6  | Single-person knowledge risk                                            | High × High         | Runbooks, pairing rotation, this roadmap, seeded staging, `android/README.md`                                                    | Eng lead / `OPS-013/019`              |
| R7  | Data loss or unrecoverable migration                                    | Low × Severe        | Forward-only migrations, `/ready` gate, quarterly restore drills                                                                 | Platform / `OPS-003/006/014`          |
| R8  | Surprise Cloudflare/Firebase/AI bill                                    | Medium × High       | Budgets + alerts, AI token ceiling, retention/pruning, per-user rate limits                                                      | Ops / `OPS-016`, `SEC-021`            |
| R9  | Privacy/legal exposure (NDPR/GDPR, consent, ads)                        | Medium × High       | Consent records, export/delete, data map, subprocessor list, CMP                                                                 | Legal+Eng / `SEC-025…028`, `WEB-037`  |
| R10 | Notification fatigue drives uninstalls                                  | Medium × Medium     | Category matrix, suppression rules, quiet hours, opt-in timing, delivery metrics                                                 | Growth / `GRW-006`, `PLAT-023`        |
| R11 | Device fragmentation on low-end hardware                                | High × Medium       | Device matrix, Test Lab, macrobenchmarks, data-saver mode                                                                        | Android / `AND-065/066`               |
| R12 | Vendor coupling (Lovable config plugin, Firebase, AI provider)          | Medium × Medium     | Owned error reporting, documented exit path per vendor, provider abstraction already present                                     | Eng lead / `WEB-002`, `SEC-021`       |

---

## 10. Roles (RACI, abbreviated)

**R**esponsible · **A**ccountable · **C**onsulted · **I**nformed

| Area                         | Platform eng | Android eng  | Web eng | Design | QA/Release | PM/Growth | Legal/Security |
| ---------------------------- | ------------ | ------------ | ------- | ------ | ---------- | --------- | -------------- |
| Contract & API platform      | R/A          | C            | C       | —      | C          | I         | C              |
| Watch integrity & anti-cheat | R/A          | R (evidence) | I       | —      | C          | I         | C              |
| Android app                  | C            | R/A          | I       | R      | C          | I         | I              |
| Web app                      | C            | I            | R/A     | R      | C          | I         | I              |
| Analytics & dashboards       | R            | C            | R       | I      | I          | A         | C              |
| Store listing & ASO          | I            | C            | I       | R      | C          | R/A       | I              |
| Policy & legal docs          | C            | C            | C       | I      | C          | C         | R/A            |
| Release & on-call            | R            | R            | R       | —      | R/A        | I         | I              |
| Growth & partnerships        | I            | I            | C       | C      | —          | R/A       | C              |

---

## 11. Global definition of done

A task is done only when **all** apply:

1. **Acceptance** — the row's "Done when" is demonstrably true (link the evidence in the PR).
2. **Tests** — automated coverage at the right level (unit for logic, contract for API, UI for
   flows, screenshot for visuals); no test deleted to make CI pass.
3. **Instrumented** — if a member can do it, an event measures it.
4. **Documented** — user-visible behaviour in `docs/`, operational behaviour in a runbook.
5. **Accessible** — keyboard/TalkBack reachable, labelled, contrast-compliant, font-scale safe.
6. **Reversible** — behind a flag if it can affect money, rewards or availability.
7. **Reviewed** — one reviewer for normal changes, two for security/payments/verification.
8. **Observable** — errors are reported with a request ID, and a dashboard or alert exists if it
   can fail in production.

---

## 12. Immediate next ten actions (this week)

| #   | Action                                                                                        | Why now                                           | Acceptance                                                      | Task                                |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------- |
| 1   | Adopt this roadmap as the single source of truth; retire `plan/status.md`/`.v3code` artefacts | Dead planning tooling misleads everyone           | Status lives only in task tables; PR titles use task IDs        | `OPS-021`                           |
| 2   | Start the contract: inventory routes, centralise Zod schemas                                  | Blocks Android, contract tests and SDK work       | `contract:inventory` prints 110 entries; no inline schemas left | `PLAT-001`, `PLAT-002`              |
| 3   | Land the evidence policy matrix behind a flag                                                 | The product's core claim depends on it            | Forged claim pays 0 in staging with tests                       | `SEC-010`                           |
| 4   | Stand up Android CI + Play Console + internal track                                           | Long lead time; unblocks all Android work         | Internal build installable from Play                            | `AND-001…005`, `AND-021`, `AND-022` |
| 5   | Turn on analytics + crash reporting for web                                                   | Without a start line, no later number is credible | Funnel + crash dashboards live                                  | `WEB-001`, `WEB-002`, `AND-019`     |
| 6   | Build the staging seed with a demo community                                                  | Needed for Play review, QA and demos              | Idempotent seed script; reviewer instructions written           | `OPS-002`                           |
| 7   | Collapse to one deploy path                                                                   | Two pipelines caused schema-behind-code incidents | Only one workflow can deploy                                    | `OPS-004`                           |
| 8   | Write the policy position before writing store copy                                           | Cheapest insurance against a category-wide ban    | `docs/POLICY-POSITION.md` approved                              | `GRW-016`                           |
| 9   | Interview 5 creators from the target WhatsApp groups                                          | The Android-first bet should be evidence-backed   | Notes + personas + 3 decisions traced                           | `GRW-002`                           |
| 10  | Add a11y + bundle + contract gates to CI                                                      | Gates added later never get added                 | CI fails on a deliberate regression                             | `WEB-008`, `WEB-026`, `PLAT-005`    |

---

## 13. Governance — keeping this alive

- **Status updates** happen in the task table (`⬜ → 🟡 → ✅`) in the same PR that delivers the work.
  A task may only be marked ✅ with linked evidence (test name, dashboard, screenshot, runbook).
- **Fortnightly roadmap review** (30 min): done / next / blocked, plus one risk re-scored.
- **New work** enters as a new task row with an ID; no "while I'm here" changes to a phase's scope.
- **Scope changes** are recorded in §6's cut list in the same PR that adds the scope.
- **Quarterly**, the roadmap is re-baselined: re-run the audit commands in `00-audit-and-baseline.md`,
  refresh §2 and §8, and archive what changed.
- `npm run roadmap:status` prints task counts by status and workstream (`scripts/roadmap-status.mjs`).

---

## 14. Appendix — conventions & glossary

**ID prefixes:** `PLAT` platform/API · `SEC` security/integrity/data-lifecycle · `WEB` web ·
`AND` Android · `OPS` operations/reliability · `DATA` analytics/measurement · `GRW` growth.

**Findings:** `F-xx` in [00-audit-and-baseline.md](roadmap/00-audit-and-baseline.md), referenced by
the tasks that close them.

**Glossary**

| Term            | Meaning here                                                                   |
| --------------- | ------------------------------------------------------------------------------ |
| Claim           | `POST /watch` — the request that converts a watched video into a payout        |
| Strong evidence | Server-verified watch time from signed heartbeats or the YouTube Data API      |
| Weak evidence   | Client-reported watch time (records the watch; does not pay)                   |
| Heartbeat       | Periodic player-time sample tied to a signed session token                     |
| Session token   | HMAC-signed `user:video:startTs:signature` token issued by `POST /watch/start` |
| Contract        | The OpenAPI document generated from the Worker's Zod schemas                   |
| Outbox          | On-device queue of writes awaiting connectivity, keyed by an idempotency key   |
| Gate            | The checklist that must be satisfied before the next milestone begins          |
