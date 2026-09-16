# Completeness audit & the loops that were closed

Updated 2026-09-16. This document records the audit question "what is missing
so the app completely works for every user story?", the gaps found, and what
was implemented to close each one. Everything listed as *implemented* is
covered by the automated suites (frontend 3 files / 19 tests; worker 36 files /
282 tests).

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
