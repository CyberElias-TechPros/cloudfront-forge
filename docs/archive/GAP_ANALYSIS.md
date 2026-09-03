# LoopSquad — Comprehensive Flow Gap Analysis

Audited: 2026-08-23 · Frontend `src/` (TanStack Start + Firebase) · Backend `workers/api/` (Cloudflare Workers + D1)

Severity legend: **[H]** blocks/breaks a core promise · **[M]** degrades UX or revenue · **[L]** polish

---

## 1. Landing page (`/`)

- **[L]** No live platform stats (video count, watches served) — purely static copy; would improve conversion.
- **[L]** No SEO structured data (JSON-LD) despite being the only public marketing surface besides `/rules`.

## 2. Sign in (`/auth/signin`) & Auth

- **[M]** `src/lib/env-validation.ts` only *warns* in production when Firebase env vars are missing (deliberate anti-crash choice). A misconfigured deploy silently renders an app where sign-in can never work — no banner tells the user why.
- **[M]** Session token lifecycle: if the API JWT expires mid-use, mutations fail once and rely on react-query retry heuristics (`shouldRetryAuth`). No proactive refresh/re-auth prompt flow.
- **[L]** Sign-in errors are only `console.error`'d in the header handler (`site-chrome.tsx handleSignIn`) — user gets zero feedback on failed popup/consent.
- **[L]** No "continue as guest" preview of queue content; every earning route is behind auth.

## 3. Submit video (`/submit`)

- **[M]** Niche selection is cosmetic — 8 buttons set local state only, then toast "coming soon". No niche stored on video or used in matching.
- **[M]** Boosts ("coming soon — no credits charged") — advertised monetization/feature absent.
- **[M]** No duplicate-URL guard surfaced to the user: submitting the same YouTube link twice creates two queue entries (backend has no UNIQUE constraint check on `youtube_video_id` + active status).
- **[L]** Target "20 watches" line is static copy — no per-video target enforced or displayed in queue.
- **[L]** No feedback that metadata fetch failed partially (duration unknown → falls back silently).

## 4. Watch queue & claim (`/queue`) — core loop

- **[H]** `commented` is still self-reported (`watch.ts:110` accepts the boolean; no verification). Comment verification via `commentThreads.list` author-channel match was designed but never implemented.
- **[H]** Watch time has no server-side truth: `getWatchTime()` queries YouTube Analytics `ids=channel==MINE`, which is creator-only data — it always returns 0/fails for watchers, so awarded seconds are whatever the client player-clock measured. Acceptable as best-available, but the "verified watch time" claim is overstated.
- **[H]** The promised enforcement doesn't exist: UI says "Unsubscribing within 30 days reverses the points… Weekly sweeps check every claim", but the worker has **no `scheduled()` handler** — the deployed `0 0 * * *` cron trigger runs nothing. No unsub sweep, no point reversal, no trust-score decay, no streak resets, no mission-overdue transitions.
- **[M]** Re-watch farming: a user can re-open the same task and re-submit watch claims (watch_sessions upserts, but XP/credit awarding on repeat claims depends on status transitions only — no cooldown between claims).
- **[M]** Videos whose metadata lacked `duration_seconds` fall back to the full 180s requirement even if the actual video is shorter.
- **[L]** Queue filter tabs (Pending/In progress/Verified/Expired) map from a single watch_status; "Expired" state is computed nowhere meaningful — tab is near-always empty.
- **[L]** Attention checks referenced in copy ("random attention checks") are not implemented at all.

## 5. YouTube connection (`/settings`, `/profile`)

- **[M]** Google OAuth app is unverified → users see the "unverified app" warning screen, and the app is capped at **100 test users** until audited (needed for any real scale).
- **[M]** OAuth callback hardcodes `https://loop.freegameplay.site/settings?youtube=connected` (`routes/youtube.ts`) — breaks on preview deployments or any other custom domain.
- **[M]** Only `channel_id` is stored; settings shows truncated raw `UC…` ID. Channel title/avatar available in the same `channels.list` call but discarded.
- **[L]** Disconnect deletes local tokens but doesn't guide users to revoke at Google (grant stays live on Google's side).
- **[L]** No reconnect prompt when a refresh token becomes invalid (silent disconnect happens in `getValidAccessToken` catch).
- **[L]** Stale-state cleanup: old rows in `youtube_oauth_states` accumulate forever (expiry comparison in SQL is format-broken and always passes; deletion only happens on success).

## 6. Dashboard (`/dashboard`)

- **[M]** Quests section is an empty array with an empty-state link — no quest engine exists behind it.
- **[L]** StatCard hints partially dynamic; activity feed mixes mock-shaped data with API data.
- **[L]** Streak display relies on `streaks` table rows that nothing increments daily (needs cron).

## 7. Missions (`/missions`)

- **[H]** `POST /api/v1/missions` is gated by `requireAuth` **only** (`routes/missions.ts` ~line 76) — any signed-in user can create platform-wide missions with arbitrary XP/credit rewards, i.e., a self-reward exploit. Needs `requireAdmin`.
- **[M]** No auto-assignment engine: missions only enter a user's board via self-assign; nothing assigns based on behavior/niche.
- **[M]** Due dates are computed on read (`assigned_at + 7 days`) but nothing ever flips assignments to `overdue`/`expired` (cron gap), so the Skip button's target state rarely occurs.
- **[L]** Mission creation has no UI (API-only) — even admins can't manage missions without curl.

## 8. Gamification (`/gamification`)

- **[M]** Shop buttons and daily bonus are toast stubs — no purchase ledger, no inventory, no credit deduction path exists.
- **[M]** XP levels shown come from hardcoded client-side thresholds (`xpLevels`), while backend `xp_accounts.level` uses its own formula — the two can disagree.
- **[L]** Badge definitions partly static; no award triggers beyond initial seed.
- **[L]** Streak freeze/multipliers implied by shop item names have no mechanics.

## 9. Reviews (`/reviews`)

- **[H]** **No code path ever creates a review row** — there is no `INSERT INTO reviews` anywhere in the worker. Reviewers see an empty list forever; start/complete routes operate on rows that cannot exist. The entire review flow is currently unreachable end-to-end (needs an assignment engine: submit → pick N reviewers → insert rows + notify).
- **[M]** `review_questions` seeding: completion scoring expects question rows, but there's no seed script/migration populating them.
- **[L]** Overdue status appears in queries but nothing sets it (cron gap again).

## 10. Communities (`/communities`)

- **[M]** Roles (`owner/admin/moderator/mentor/member`) are stored but most community management endpoints don't enforce them consistently (moderation actions like remove-video/report-to-community are thin).
- **[L]** Invite codes exist but there's no share/copy affordance in the UI.
- **[L]** Community-scoped queues (queue shows platform-wide videos; community context unused in matching).

## 11. Leaderboard (`/leaderboard`)

- **[L]** Single global board; no weekly/monthly windows despite gamification copy referencing seasons.
- **[L]** No pagination/virtualization guard for large user counts (top-N query only — fine short-term).

## 12. Search (`/search`)

- **[L]** Backend does simple LIKE matching — no FTS index, no relevance ranking; fine at small scale.
- **[L]** Search entry point was removed from navbar (intentional), so `/search` is now orphaned — reachable only by URL. Either restore an entry point or fold search into pages.

## 13. Profile (`/profile`)

- **[M]** Connected-channels card reads `youtube_channels` (manual-entry table from `users.ts` POST) while OAuth writes `youtube_oauth_tokens` — two disconnected sources of truth; profile may show stale/manual channels.
- **[L]** Public profile toggle is a "coming soon" switch; all profiles effectively public to members.

## 14. Notifications & preferences

- **[M]** Email/push toggles persist to `notification_preferences` but **nothing consumes them** — no email sender, no push service anywhere in the worker. In-app is the only real channel.
- **[M]** No unread badge/count surfaced in the navbar (notifications page exists but is discoverable only via menu).
- **[L]** Notification inserts are scattered and inconsistent (some routes notify, others silently skip).

## 15. AI Assistant (`/ai`)

- **[M]** No per-user rate limiting or daily quota on chat completions — each message hits the NVIDIA API with your key (cost/abuse exposure).
- **[L]** System prompt is generic; no tool use over platform data (e.g., "how many credits do I have").
- **[L]** Conversation titles are auto-generic; no delete-conversation endpoint parity check.

## 16. Admin (`/admin`)

- **[M]** Reports table is only writable by **admins** (`admin.ts:229`) — regular users have no "report video/user" flow, so the moderation pipeline has no intake.
- **[M]** Admin panel is mostly read-only dashboards; no actions to disable videos/users or resolve reports (status field exists, no transition UI/route parity).
- **[L]** Trust scores displayed but nothing modifies them (needs cron + report outcomes).

## 17. Monetization (AdSense)

- **[M]** `VITE_ADSENSE_SLOT_ID` unset → slots render nothing; Auto Ads not confirmed enabled. Revenue = zero until one path is activated.
- **[M]** Site approval pending in AdSense console — no ads serve until approved regardless of code.
- **[M]** No `ads.txt` at the domain root — AdSense requires it for full monetization and it protects inventory.
- **[L]** Only 2 placements (dashboard, queue sidebar); leaderboard/gamification pages have natural footer spots if more fill is wanted later.

## 18. Platform-wide / cross-cutting

- **[H]** Cron jobs absent entirely (see §4): unsub reversal, trust decay, streak resets, overdue missions/reviews, notification digests — all UI promises with no executor. Add a `scheduled()` export in `index.ts` wired to D1 sweeps.
- **[M]** CORS allowlist is exactly two domains; adding any new domain (preview, app subdomain) breaks API calls.
- **[M]** Rate limiting covers auth heavily but not expensive routes (AI, submit with external YouTube fetches) — burst abuse possible.
- **[L]** Tests: worker unit tests exist for select handlers; no integration tests for the money paths (claim awarding, mission completion rewards).
- **[L]** No request-level audit log for reward transactions beyond `*_transactions` tables (good enough short-term).

---

### Suggested priority order

| # | Gap | Why first |
|---|-----|-----------|
| 1 | Mission create → `requireAdmin` | Active reward-printing exploit |
| 2 | Implement `scheduled()` sweeps | Every fairness promise depends on it |
| 3 | Review assignment engine | Entire flow currently dead |
| 4 | Comment verification | Last unverified claim in core loop |
| 5 | Ads: slot ID/Auto Ads + `ads.txt` + approval | Revenue currently $0 |
| 6 | User-facing report flow | Moderation has no intake |
| 7 | AI quotas + rate limits | Cost containment |
