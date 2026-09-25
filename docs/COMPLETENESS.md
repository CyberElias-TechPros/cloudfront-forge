# Completeness audit & the loops that were closed

Updated 2026-09-25. This document records the audit question "what is missing
so the app completely works for every user story?", the gaps found, and what
was implemented to close each one. Everything listed as *implemented* is
covered by the automated suites (frontend 4 files / 26 tests; worker 37 files /
299 tests). The first audit (2026-09-16) found G1–G18; a full second pass on
2026-09-25 found G19–G31 and closed them the same day (see below).

---

## Gaps found

| # | Area | Gap | User story it broke |
| - | ---- | --- | ------------------- |
| G1 | Account lifecycle | No way to delete an account (`users.deleted_at` existed but nothing set it) | GDPR/CCPA right to erasure; Google OAuth policy; "I want to leave the platform" |
| G2 | Account lifecycle | No suspension/ban enforcement — no status column, nothing blocked at the gate | Moderation decisions had no teeth |
| G3 | Community lifecycle | Members could join but never leave | "I want out of this squad" |
| G4 | Community lifecycle | Owners could not manage members (promote/demote, remove) | Running a community with helpers; removing bad actors |
| G5 | Community lifecycle | `require_approval` setting was dead — no join-request flow | Owners of public communities had no gate |
| G6 | Community lifecycle | Invite code could not be rotated | A leaked code could not be invalidated |
| G7 | Community lifecycle | No way to archive a community | Dead communities accumulated forever |
| G8 | Community lifecycle | Rejoining after leaving/being removed hit a UNIQUE violation (500) | "I left and want back in" |
| G9 | Video lifecycle | Creators could not archive their own video (the `archived` state was unreachable) | "Stop serving my old video" |
| G10 | Moderation | Admins could not suspend/reinstate members | Cheat flags had no actor-level action |
| G11 | Moderation | No platform role management (grant/revoke moderator/admin) | The moderator role was defined but ungrantable |
| G12 | Moderation | Moderators had permissions on paper but zero usable routes | Moderator user story was fictional |
| G13 | Moderation | Appeals: no admin queue, and accepting an appeal did NOT reverse the −10 trust penalty nor restore the auto-removed video | "I won my appeal but stayed punished" |
| G14 | Support | No way to contact the team (lost top-up, missing reward, account issues) | Every money/account problem had no channel |
| G15 | Processes | Overdue reviews were flagged by cron but nobody was notified and nothing was reassigned | Submitters waited forever for feedback |
| G16 | Frontend flows | No appeal entry point for members (`useAppealReport` existed but no page used it; members couldn't even see reports against them) | The appeal user story was unwired end-to-end |
| G17 | Frontend flows | Community page "Invite member" button was dead; no settings UI; no onboarding next-actions | First-run members had no guided path |
| G18 | Frontend flows | Suspended/deleted accounts saw a wall of failed requests instead of an explanation | Confusing dead end |

## What was implemented

### Backend (migrations 031–036, 90 → 110 routes)

- **Migrations**: `users.status` (031), `communities.status` (032),
  `join_requests` (033), `support_requests` (034), unique
  `admin_users.user_id` with dedupe (035), `reviews.overdue_notified` (036).
- **Entry-point account gate** (`src/index.ts`): after token verification,
  deleted/suspended/banned accounts are rejected with `ACCOUNT_DELETED` /
  `ACCOUNT_SUSPENDED` / `ACCOUNT_BANNED` (403) before any handler runs — one
  place, every route.
- **Account** (`routes/account.ts`): `DELETE /users/me` closes every open loop
  in one batch — memberships → `left`, videos → `archived`, open reviews →
  `skipped` (submitters notified), join requests → `cancelled`, pending
  top-ups → `rejected`, push subscriptions deleted, open watch sessions
  expired. Ledger/audit history preserved.
- **Community management** (`routes/community-management.ts`): leave, public
  join with approval requests (202 + manager notifications), request
  approve/reject (status-locked, capacity re-checked, applicant notified),
  member role change, member removal, invite-code rotation, community archive
  (videos + pending requests archived, members notified). Archived
  communities disappear from lists, detail, search. Rejoin after leave/remove
  upserts the membership instead of 500-ing.
- **Video archive** (`routes/videos.ts`): owner-only, conditional update,
  409 on repeat or non-archivable state.
- **Admin moderation** (`routes/admin.ts`): appeals queue listing, suspend /
  reinstate (with member notification), platform role management with tier
  rules (super admins immutable, admin tier managed by super admins only,
  self-changes blocked), video restore. User listing exposes `status` and
  `platformRole` and filters `?status=suspended`.
- **Appeals fixed** (`routes/reports.ts`): review is status-locked; accepting
  dismisses the report, **restores the −10 trust penalty** (capped at 100),
  re-activates a removed video, and notifies the appellant; rejecting notifies
  with the optional note. New `GET /reports/mine` gives members the reports
  filed against them with appeal state.
- **Support** (`routes/support.ts`): member submits `{ topic, message }`;
  admins get in-app + push notifications and an optional email acknowledgement
  to the member; moderation tier lists/resolves; member notified on
  resolution.
- **Moderator tier** (`middleware/auth.ts` → `requireModerator`): reports,
  report resolution, appeals, support and video restore accept moderators,
  matching `ROLE_PERMISSIONS`. Analytics, users, communities, metrics,
  retention, top-ups, suspension and role changes stay `requireAdmin`.
- **Cron** (`jobs/sweeps.ts` → `recoverOverdueReviews`): after the 48 h SLA
  sweep, the recovery sweep notifies the late reviewer + submitter once
  (guarded by `overdue_notified`), then reassigns to the least-loaded active
  community member (never the submitter or current reviewer) and tells them.
  Single-member communities keep the review visible as overdue.

### Frontend

- **Settings**: danger zone with typed-confirmation account deletion → sign
  out → home.
- **Community detail**: join-request panel (approve/decline), member table
  with role select + removal, invite copy/regenerate, settings toggles
  (peer review, collaboration, approval gate), archive dialog, leave dialog;
  the dead "Invite member" button now copies the code.
- **Search**: public community results have an "Ask to join" action
  (immediate join or pending request, reflected in the toast).
- **Dashboard**: "Get started" checklist (join a community → submit a video →
  watch & claim) that disappears as steps complete; per-submission archive
  action.
- **Profile**: "Reports & appeals" section — reports against the member with
  status and a one-time appeal dialog (wires the previously orphaned
  `useAppealReport`).
- **Admin console**: appeals panel (accept/reject with consequences
  surfaced), support inbox (resolve + member notified), member moderation
  table (suspend/reinstate, platform role select, status filter); moderator
  role gets the console but only the moderation-tier panels.
- **Support page** (`/support`): topic picker, validated message, success
  state, help-first sidebar; linked from the site footer.
- **Account-block screen**: `Shell` shows the server's reason (suspended /
  banned / deleted) with sign-out instead of failed dashboards.

## End-to-end flows now covered

1. **Join → contribute → get reviewed**: sign in → join/create community
   (code or public request with approval) → submit video → reviewers
   auto-assigned → watch & claim → review completed → rewards once.
2. **Review SLA**: reviewer misses 48 h → both parties notified → review
   reassigned to the least-loaded member → new reviewer notified → loop
   continues.
3. **Report → moderation → appeal**: report filed (trust penalty, admins
   notified, 3× misleading auto-removes the video) → admin sees flag →
   member sees report in profile → appeals once → moderator/admin accepts →
   report dismissed, penalty reversed, video restored, everyone notified.
4. **Money**: NGN top-up → receipt upload → admin approves (status-locked,
   single credit) or rejects with reason; problems go through Support to the
   admin inbox.
5. **Moderation**: admin suspends (blocked at the gate with a clear screen),
   reinstates later; roles granted/revoked with tier rules; everything in the
   audit log.
6. **Exit**: member leaves communities at will; owners archive communities;
   creators archive videos; anyone deletes their account and is blocked
   everywhere immediately.

---

## Second-pass audit (2026-09-25)

A full re-audit of every route file, hook, page and business rule — checking
that frontend call sites match backend routes, that cross-cutting policies
(preferences, privacy, rewards, notifications) actually fire, and that no UI
control is a dead end — found 13 further gaps. All were closed the same day.

| # | Area | Gap | User story it broke |
| - | ---- | --- | ------------------- |
| G19 | Notifications | Backend emitted almost nothing (3 call sites); preferences (`email_enabled`/`push_enabled`/quiet hours) were never read; no welcome email | "Tell me when something needs me" — notifications, money, SLA |
| G20 | Money | Top-up approval/rejection never told the creator | "Did my payment go through?" |
| G21 | Review SLA | Overdue/reassignment cron ran silently — neither the delinquent reviewer nor the submitter was told | Fair, transparent review rotation |
| G22 | Rewards | Completing every step of a mission never sent the promised XP/credits | "Missions actually pay out" |
| G23 | Privacy | `GET /users/:id` ignored the `users.public_profile` flag (the flag only gated the richer `/profile/public` route); FE settings had no toggle and no page used the public-profile hook | "Only my squad should see my details" |
| G24 | Communities | No per-community squad rules existed anywhere, yet `/rules` claimed "community-specific rules shown on each community page" | Onboarding/expectations for squads |
| G25 | Admin | `GET /admin/communities` didn't exist; admin page had dead "view all" links and no way to seed missions/quests | Running the platform day-to-day |
| G26 | Notifications (FE) | No per-item delete, no empty state, no "nothing needs you" story | Manageable inbox |
| G27 | Theme | Dark-only despite a themed design system; `/settings` promised hints that didn't exist | "Light mode, please" |
| G28 | Profile (FE) | Backend supported display-name/photo/bio/visibility edits but no UI existed (sibling gap of G13); member names/cards were dead ends | Own your identity, discover squad members |
| G29 | Reputation (FE) | Trust/reward ledger was server-only — members could not see why points changed | "Why did my trust score move?" |
| G30 | Rules (FE) | Dispute-appeal copy on `/rules` promised things the flow doesn't do (public decisions, once-per-week) | Honest expectations about moderation |
| G31 | Onboarding | No first-session orientation beyond G15's dashboard next-actions; profile starts empty with no nudge | First 10 minutes of a new account |

### What was implemented (second pass)

**Backend (migration 037, `lib/notify.ts`, routes 110 → 110 with 2 rewrites):**

- **Central fan-out** (`src/lib/notify.ts`): `notify(env, user_id, event_type,
  …)` is the single entry point — reads the member's `notification_preferences`
  row (in-app always, email gated by `EMAIL_ENABLED` + category, push gated by
  `PUSH_ENABLED` with quiet hours), inserts the in-app row, enqueues Web Push,
  and sends email through `sendEmail` which now honours `EMAIL_FROM` and
  absolutises CTA links against `SITE_URL`. New module tests cover every gate.
- **Welcome email** (`middleware/auth.ts`): first authenticated request claims
  `users.welcome_sent_at` and sends a warm-start email — only when `SITE_URL`
  is configured and exactly once.
- **All money/SLA/reward/moderation events now notify**: top-up approve/reject,
  support submit/resolve fan-out, video assigned/started/completed, overdue +
  reassignment sweeps, mission assignment, report appeals, watch-session
  claims, admin suspend/reinstate/role changes — with `email_enabled` /
  `push_enabled` honoured (local duplicate `notifyUser` helpers removed).
- **Mission completion rewards**: `POST /missions/:id/complete` claims a
  conditional `completed_at` first (idempotent), then grants tier XP/credits.
- **Privacy enforced at the right gate**: `GET /users/:id` returns `profile:
  null` for other users when `public_profile = 0`.
- **Per-community rules**: `communities.rules` (037) with
  `sanitizeMultiline()` (control chars, 5 000 cap), owner-only
  `PUT /communities/:id/settings { rules }`, returned from detail.
- **Preferences hardening**: dedupe + partial unique index on
  `notification_preferences(user_id)` (037), `ON CONFLICT DO NOTHING` on PUT.
- **Admin**: `GET /admin/communities` now returns member counts, owner names,
  status and pagination (replaces the bare id/status list).
- `SITE_URL` documented in `.env.example` and added to `wrangler.toml [vars]`.

**Frontend:**

- **Theme**: `src/lib/theme.ts` (preference `dark|light|system`, default
  dark), a fail-safe inline boot script in `__root.tsx` (applies the class
  before first paint), `.light` token overrides cascading through the
  `@theme inline` bridge, and a radiogroup in `/settings`.
- **Profile editing**: `ProfileEditDialog` on `/profile` (display name, photo,
  bio, goals, audience, visibility) wired to `users.updateProfile`.
- **Notification inbox**: per-item delete, empty state, stagger animation.
- **Gamification**: "Trust & reputation" card on `/gamification` from
  `GET /reputation`.
- **Admin**: communities panel (search, status filter, pagination, seeded via
  the rewritten endpoint) and a mission designer (single mission or 2–5 step
  chain).
- **Member profiles**: `MemberProfileDialog` opened from community member
  cards; private profiles render a friendly explanation, not an error.
- **Squad rules**: `/rules` links correctly; community page shows rules to
  everyone and lets the owner edit them inline (validated, unsaved-changes
  guard); dispute copy corrected to the real appeal flow.
- **Settings**: public-profile switch finally toggles `users.public_profile`.
- Tests: `src/tests/theme.test.ts` added (26 FE tests total).
