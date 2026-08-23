# LoopSquad - Innovation & Standards Roadmap

Companion to `GAP_ANALYSIS.md` (all gaps carried forward as P0/P1 fixes).
Audited 2026-08-23. Per flow: where we are -> what best-in-class does -> whether the
obvious fix needs a nudge -> concrete innovations that don't break existing behavior.

Priority legend: **P0** exploit/broken promise | **P1** robustness | **P2** growth | **P3** delight.

---

## 1. Watch-time verification (core loop)

**Current:** player-clock sampling client-side; server trusts submitted seconds; Analytics API path is dead for viewers.
**Benchmark:** Udemy/Coursera progress = client heartbeats cross-checked server-side; ad-tech uses viewability + playback-rate + focus signals.
**Nudge verdict:** keeping only the client timer is below standard. Nudge to signed watch sessions:

- P0->P1 innovation: **Watch-session handshakes.** `POST /watch/start` issues a short-lived HMAC token (userId+videoId+startTs). Heartbeats every ~30s send `{token, playerTime}`; server stores progression slope. Claim requires a plausible heartbeat chain (~1x real time). Kills body-tampering (`watchSeconds: 99999`) and idle-tab tricks.
- P1: **Playback-rate guard.** `player.getPlaybackRate()` > 1.25 stops crediting.
- P1: **Muted-playback signal.** `isMuted()` sampled into heartbeats; muted watch credits 50% or nothing.
- P2: **Attention checks.** Random overlay question mid-watch; fail x2 voids session (already promised in UI copy).
- P2: **Anomaly scoring.** Nightly sweep flags accounts >3 sigma off cohort claim cadence; feeds Trust Score softly.

## 2. Subscribe & comment verification

**Current:** subscription = OAuth-verified. Comment = self-reported.
**Benchmark:** Gleam-style platforms verify via API + spot-checks; YouTube ToS bans *automated* engagement but allows *verification*.
- P1: **Magic-word comments.** Optional per-video secret word shown under the player; verification = `commentThreads.list?searchTerms=word` + author-channel match. Near-spam-proof, still user-authored (ToS-safe).
- P1: **Re-verification ledger.** Cron re-checks subscription at day 7/30 post-claim (readonly scope already held); unsub = auto-deduct + trust hit. This is the sweep the UI promises.
- P2: **Comment-originality hashing.** Normalized text hash per video blocks copy-paste rings.

## 3. Scheduled jobs / fairness enforcement

**Current:** cron trigger deployed, no `scheduled()` handler exists -- nothing runs.
**Benchmark:** `scheduled()` + idempotent cursor sweeps; per-user timers via DO alarms.
**Nudge verdict:** build a tiny job registry so future sweeps are declarative:

```
scheduled(): [unsubReverify(7d/30d), trustDecay, streakReset,
              overdueMissions, overdueReviews]  // each: cursor-paged, idempotent, logged to job_runs table
```
- P0: implement registry + first jobs (they back existing UI promises).
- P2: expose last-run/status in Admin.

## 4. Reviews engine

**Current:** dead end-to-end (no row creation anywhere).
**Benchmark:** peer-review marketplaces: matcher + SLA + quality feedback loop.
- P0: assignment engine on submit: pick N reviewers = same-community members weighted by inverse recency + trust threshold. Insert rows + notify.
- P1: SLA timers (48h accept window -> reassign; overdue flag) via the job registry.
- P2: Review-of-review: submitter rates helpfulness -> feeds reviewer Trust Score. Double-blind optional.
- P3: Review streak badges ("50 constructive reviews").

## 5. Missions & quests

**Current:** open creation exploit; no auto-assignment; no expiry transitions.
- P0: `requireAdmin` on create.
- P1: nightly expiry flips assignments to `expired` -> Skip button becomes meaningful.
- P2 innovation: **Generated daily quests.** Deterministic per-user daily trio from activity data ("Watch 2 videos", "Give 1 review", "Keep your streak") -- zero authoring cost (Duolingo pattern).
- P2: Mission chains: 3-step storylines per niche unlocking badges.

## 6. Gamification economy

**Current:** XP/credits/streaks displayed; shop + daily bonus are stubs; two competing level formulas.
- P1: unify levels server-side (`xp_accounts.level` single formula); delete hardcoded client `xpLevels`.
- P2 innovation: **Real credit sinks**: Boosts (paid queue placement), Profile themes, Streak freeze, Queue-priority ticket. Each = one `credit_transactions` type + small route; ledger already exists.
- P2: Daily bonus with escalating streak multiplier (day 7 = 2x).
- P3: Cohorted leaderboards (rookie/rising/veteran by account age).

## 7. Trust & safety

**Current:** reports admin-writable only; trust score read-only.
**Benchmark:** UGC platforms: user intake -> triage SLA -> strikes -> appeals.
- P1: Report flow (flag button on queue tasks/profiles) -> `reports` with reason enum; user-facing confirmation.
- P1: Trust Score v1: base 100 - strikes*k + verified-claim streak bonus + review helpfulness; computed nightly.
- P2 soft enforcement: trust < 60 -> payouts enter 24h pending window; < 40 -> claims require YouTube connect.
- P3: Appeal flow (one-shot message to admins).

## 8. Notifications

**Current:** in-app only; email/push toggles persist but NO sender exists anywhere.
**Benchmark:** preference-aware multi-channel with digests + quiet hours.
- P1: Web Push via VAPID + service worker (zero-cost on CF Workers) honoring `pushEnabled`.
- P1: Email digests via Resend/MailChannels Worker binding honoring `emailEnabled`; weekly summary default-on, transactional immediate.
- P2: Navbar unread badge (count query already exists in routes).
- P2: Quiet hours field in preferences.

## 9. AI Assistant

**Current:** unquota'd NVIDIA calls on the paid key; generic chat.
- P1: per-user daily quota (counter reset by registry) + global spend ceiling env var. Industry non-negotiable.
- P2 innovation: **Platform-aware coach.** Tool-calls into own DB: "Which of my videos has lowest claim rate?", title suggestions by niche. Same model + function schema.
- P3: Streaming responses (SSE).

## 10. Communities & WhatsApp roots

**Current:** join/roles exist; community context unused by core loop.
- P2 innovation: **Community squads**: community-scoped queue filter + weekly community leaderboard; WhatsApp group <-> community mapping via invite codes (attribution counted on join).
- P3: "Share my submission to WhatsApp" prebuilt wa.me link with OG image.

## 11. Monetization

**Current:** AdSense script live; slots inert pending slot-ID/approval; boosts are stubbed UI.
- P1: activate ads path: slot-ID env OR Auto Ads low-load; **add `ads.txt`** (missing today, required for full inventory).
- P2 innovation: **Creator Boosts made real**: credits (later cash) pin video top-of-queue for 24h, labeled "Boosted".
- P3: Supporter badge as second sink.

## 12. Platform hardening (standards nudges)

| Area | Now | Industry bar | Nudge |
|---|---|---|---|
| Auth | Custom JWT verify | Short-lived access + rotation | P1: 15-min access + refresh w/ reuse detection |
| Rate limiting | KV fixed-window (auth only) | Sliding window per-route classes | P1: extend to `/ai`, `/videos`, `/watch`; P2: DO sliding window |
| CORS | Hardcoded origins list | Config-driven allowlist | P1: parse `CORS_ORIGINS` everywhere + preview option |
| OAuth state | Broken SQL date compare | Epoch INTEGER TTL | P1: store `expires_at` epoch int; nightly purge |
| YouTube channel identity | TWO sources of truth: manual `youtube_channels` table (Profile) vs `youtube_oauth_tokens.channel_id` (Settings/verification) | Single source | P1: unify -- OAuth row wins; status/settings read both coherently; deprecate manual table |
| Duplicate submissions | Same URL can be queued twice | UNIQUE active constraint | P1: reject re-submit of an active video (409) |
| OAuth redirect | Hardcoded loop.freegameplay.site | Origin-derived/config | P1: derive frontend origin from env allowlist |
| Error tracking | Console + Lovable reporter | Sentry-class breadcrumbs | P2: Logpush or Sentry tunnel |
| Backups | D1 Time Travel (auto) | + restore drill | P3: quarterly restore doc |
| Tests | Unit tests partial | Money-path coverage | P1: integration tests for claim/mission/reward ledgers |
| SEO/a11y | Minimal | Public pages indexed | P2: sitemap + OG images for public pages; a11y pass |

## 13. Data & growth instrumentation (net-new)

- P2: event pipeline (`video_submitted`, `watch_claimed`, `review_completed`, `signup`) -> analytics table or PostHog; funnel dashboard in Admin (submit->watch->claim conversion).
- P3: cohort retention view (W1/W4) in Admin.

## 14. Mobile experience

Audience lives in WhatsApp = mobile-first.
- P2: PWA (manifest + service worker + install banner); unlocks push.
- P3: Android share-target so "share to LoopSquad" appears in the share sheet for YouTube links -> prefills submit form.

---

## Consolidated backlog (gaps merged + innovations)

| Pri | Item | Type | Effort |
|----|------|------|--------|
| P0 | Missions create -> requireAdmin | Gap | XS |
| P0 | ads.txt + AdSense activation path | Gap | S |
| P0 | Duplicate video submission block (409) | Gap | S |
| P0 | OAuth state epoch fix + hardcoded redirect removal | Gap | S |
| P0 | scheduled() registry + first sweeps | Gap+Inv | M |
| P0 | Review assignment engine v0 | Gap | M |
| P1 | Signed watch sessions + heartbeats + rate/mute guards | Innovation | L |
| P1 | Magic-word + author-match comment verification | Gap+Inv | M |
| P1 | Report flow intake + Trust Score v1 | Gap+Inv | M |
| P1 | AI quotas + spend ceiling | Gap | S |
| P1 | Channel source-of-truth unification | Gap | S |
| P1 | Web Push + email digest honoring prefs | Gap+Inv | M |
| P1 | Rate-limit classes for /ai,/videos,/watch; CORS pass; reward-ledger tests | Gap | M |
| P2 | Daily generated quests; mission chains | Innovation | M |
| P2 | Credit sinks: Boosts/themes/freeze/priority | Innovation | M |
| P2 | Attention checks; anomaly scoring -> trust | Innovation | M |
| P2 | Platform-aware AI coach; unread badge; quiet hours | Innovation | S-M |
| P2 | Community squads + WA share links; PWA; analytics funnel | Innovation | M |
| P3 | Cohort leaderboards; review-of-review; appeals; streaming AI; share-target | Innovation | S each |

Sequencing note: every P0/P1 above is additive or permission-hardening -- none change existing
claim/award response shapes, so nothing breaks while landing them. Signed watch sessions ship
behind an env flag with legacy fallback during rollout.
