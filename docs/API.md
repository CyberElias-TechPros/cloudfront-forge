# API catalogue

Generated from `workers/api/src/routes/index.ts` — the single routing table the
Worker matches against. Regenerate after adding routes:

```sh
cd workers/api && npx tsx -e 'import { routes } from "./src/routes/index"; for (const r of routes) console.log(`${r.method} ${r.path ?? r.pattern}`)'
```

Two non-versioned endpoints live outside this table:

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/health` | Liveness probe. Answers even when required secrets are missing, so a misconfigured deploy is distinguishable from a dead one. |

Every route is authenticated unless it is `/health` — including
`/auth/register`, which creates or syncs the *caller's* row from the verified
Firebase ID token and ignores any client-supplied `firebaseUid`. Admin routes
additionally require an `admin` or `super_admin` row in `admin_users`. All
responses use the envelope `{ success, data?, error?, meta }`.

### Auth

| Method | Path | Notes |
| ------ | ---- | ----- |
| `POST` | `/api/v1/auth/register` | Verified token only; body `firebaseUid`/`email` ignored. Returns `{ message, user }` |
| `GET` | `/api/v1/auth/me` | Current user's full row |
| `PUT` | `/api/v1/auth/profile` | Update `displayName` |
| `GET` | `/api/v1/auth/permissions` | Own role/permissions; admins may pass `?userId=` to read another user. `?userId=` is not a public lookup — anonymous callers get 401 |

### Users & profiles

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/api/v1/users/:id` | |
| `GET` | `/api/v1/users/me/profile` | |
| `PUT` | `/api/v1/users/me/profile` | |
| `POST` | `/api/v1/users/me/youtube-channel` | |
| `GET` | `/api/v1/users/me/member` | |
| `GET` | `/api/v1/users/me/youtube-channels` | |
| `GET` | `/api/v1/users/me/insights` | |
| `DELETE` | `/api/v1/users/me` | Soft account deletion: memberships end, videos are archived, open reviews skipped, pending requests/top-ups cancelled, push subscriptions removed. Ledgers stay for audit. |

### Communities

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/api/v1/communities` | |
| `GET` | `/api/v1/communities/:id` | Includes caller's `myRole` and community `settings` |
| `POST` | `/api/v1/communities` | |
| `POST` | `/api/v1/communities/join` | Join by invite code (always immediate) |
| `POST` | `/api/v1/communities/:id/join` | Public communities only: joins immediately or creates a pending request when approval is required (202) |
| `POST` | `/api/v1/communities/:id/leave` | Members leave; owners must archive instead |
| `GET` | `/api/v1/communities/:id/members` | |
| `GET` | `/api/v1/communities/:id/requests` | Managers only: pending join requests |
| `POST` | `/api/v1/communities/:id/requests/:requestId/approve` | Status-locked; capacity re-checked |
| `POST` | `/api/v1/communities/:id/requests/:requestId/reject` | Status-locked |
| `POST` | `/api/v1/communities/:id/members/:userId/role` | Owner only; body `{ role: "member" \| "moderator" }` |
| `POST` | `/api/v1/communities/:id/members/:userId/remove` | Owner or moderator; owners cannot be removed |
| `POST` | `/api/v1/communities/:id/invite/regenerate` | Owner only; old code stops working |
| `DELETE` | `/api/v1/communities/:id` | Owner only; archives the community, its videos and pending requests |
| `PUT` | `/api/v1/communities/:id/settings` | |
| `GET` | `/api/v1/admin/communities` | |

### Videos

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/api/v1/videos` | |
| `POST` | `/api/v1/videos` | |
| `GET` | `/api/v1/videos/:id` | |
| `POST` | `/api/v1/videos/:id/archive` | Owner only; takes the video out of rotation, history kept |

### Reviews

| Method | Path |
| ------ | ---- |
| `GET` | `/api/v1/reviews` |
| `GET` | `/api/v1/reviews/:id` |
| `POST` | `/api/v1/reviews/:id/start` |
| `POST` | `/api/v1/reviews/:id/complete` |
| `POST` | `/api/v1/reviews/:id/answers` |
| `POST` | `/api/v1/reviews/:id/helpful` |

### Missions & quests

| Method | Path |
| ------ | ---- |
| `GET` | `/api/v1/missions` |
| `POST` | `/api/v1/missions` |
| `POST` | `/api/v1/missions/:id/assign` |
| `GET` | `/api/v1/missions/assignments` |
| `POST` | `/api/v1/missions/assignments/:id/complete` |
| `POST` | `/api/v1/missions/assignments/:id/skip` |
| `POST` | `/api/v1/missions/chain` |
| `GET` | `/api/v1/daily-quests` |

### Gamification

| Method | Path |
| ------ | ---- |
| `GET` | `/api/v1/credits` |
| `GET` | `/api/v1/xp` |
| `GET` | `/api/v1/reputation` |
| `GET` | `/api/v1/streaks` |
| `GET` | `/api/v1/badges` |
| `GET` | `/api/v1/leaderboards` |
| `POST` | `/api/v1/gamification/daily-bonus` |

### Queue, submissions & activity

| Method | Path |
| ------ | ---- |
| `GET` | `/api/v1/queue` |
| `GET` | `/api/v1/submissions` |
| `GET` | `/api/v1/activity` |

### Watch verification

| Method | Path |
| ------ | ---- |
| `POST` | `/api/v1/watch/challenge` |
| `POST` | `/api/v1/watch/challenge/:id/answer` |
| `POST` | `/api/v1/watch/start` |
| `POST` | `/api/v1/watch/heartbeat` |
| `POST` | `/api/v1/watch` |

### AI assistant

| Method | Path |
| ------ | ---- |
| `POST` | `/api/v1/ai/chat` |
| `POST` | `/api/v1/ai/chat/stream` |
| `GET` | `/api/v1/ai/conversations` |
| `GET` | `/api/v1/ai/conversations/:id/messages` |
| `DELETE` | `/api/v1/ai/conversations/:id` |

### YouTube

| Method | Path |
| ------ | ---- |
| `GET` | `/api/v1/youtube/oauth/authorize` |
| `GET` | `/api/v1/youtube/oauth/callback` |
| `POST` | `/api/v1/youtube/oauth/callback` |
| `GET` | `/api/v1/youtube/status` |
| `POST` | `/api/v1/youtube/disconnect` |

### Notifications & push

| Method | Path |
| ------ | ---- |
| `GET` | `/api/v1/notifications` |
| `POST` | `/api/v1/notifications` |
| `POST` | `/api/v1/notifications/read-all` |
| `POST` | `/api/v1/notifications/:id/read` |
| `DELETE` | `/api/v1/notifications/:id` |
| `PUT` | `/api/v1/notifications/preferences` |
| `GET` | `/api/v1/notifications/preferences` |
| `POST` | `/api/v1/notifications/push/subscribe` |
| `POST` | `/api/v1/notifications/push/unsubscribe` |

### Search & discovery

| Method | Path |
| ------ | ---- |
| `GET` | `/api/v1/search` |
| `GET` | `/api/v1/discover/collaborators` |

### Reports & appeals

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/api/v1/admin/reports` | Moderation tier (moderator+) |
| `POST` | `/api/v1/admin/reports/:id/resolve` | Moderation tier |
| `POST` | `/api/v1/reports` | |
| `GET` | `/api/v1/reports/mine` | Reports filed against the caller, with appeal state |
| `POST` | `/api/v1/reports/:id/appeal` | One appeal per report per member |
| `GET` | `/api/v1/admin/appeals` | Moderation tier; `?status=pending\|accepted\|rejected` |
| `POST` | `/api/v1/admin/appeals/:id` | Moderation tier; body `{ status: accepted\|rejected, note? }`. Accepting dismisses the report, restores the trust penalty and re-activates a removed video |

### Support

| Method | Path | Notes |
| ------ | ---- | ----- |
| `POST` | `/api/v1/support` | Body `{ topic, message }`; admins notified, optional email ack |
| `GET` | `/api/v1/admin/support` | Moderation tier; `?status=open\|resolved` |
| `POST` | `/api/v1/admin/support/:id/resolve` | Moderation tier; notifies the member |

### Shop (credit sinks)

| Method | Path |
| ------ | ---- |
| `GET` | `/api/v1/shop` |
| `POST` | `/api/v1/shop/purchase` |

### Top-ups (naira)

| Method | Path |
| ------ | ---- |
| `GET` | `/api/v1/topups` |
| `POST` | `/api/v1/topups/proof` |
| `POST` | `/api/v1/topups` |
| `GET` | `/api/v1/topups/mine` |
| `GET` | `/api/v1/admin/topups` |
| `GET` | `/api/v1/admin/topups/:id/proof` |
| `POST` | `/api/v1/admin/topups/:id/approve` |
| `POST` | `/api/v1/admin/topups/:id/reject` |

### Admin (admin tier)

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/api/v1/admin/analytics` | |
| `GET` | `/api/v1/admin/users` | `?status=active\|suspended\|deleted`; includes `status` and `platformRole` |
| `GET` | `/api/v1/admin/metrics` | |
| `GET` | `/api/v1/admin/retention` | |
| `POST` | `/api/v1/admin/users/:id/suspend` | Body `{ reason? }`; member notified; entry gate blocks them everywhere |
| `POST` | `/api/v1/admin/users/:id/reinstate` | |
| `POST` | `/api/v1/admin/users/:id/role` | Body `{ role: "moderator" \| "admin" \| null }`; admin tier manages admins only via super admins; super admins are immutable |
| `POST` | `/api/v1/admin/videos/:id/restore` | Re-activates removed/archived videos |

Two tiers exist: **admin** (`requireAdmin`: super_admin/admin) and
**moderation** (`requireModerator`: adds moderators). Moderators get reports,
appeals, support and video restore; analytics, user management, top-ups and
role changes stay admin-only — matching `ROLE_PERMISSIONS` in
`workers/api/src/middleware/permissions.ts`.

## Conventions

- **Auth**: `Authorization: Bearer <firebase-id-token>`. Accounts that are
  deleted, suspended or banned are rejected at the entry point with a 403 and
  a distinguishable code: `ACCOUNT_DELETED`, `ACCOUNT_SUSPENDED`,
  `ACCOUNT_BANNED`.
- **Errors**: `{ success: false, error: { code, message } }` with a meaningful
  HTTP status (`400` validation, `401` unauthenticated, `403` forbidden,
  `404` not found, `409` conflict, `429` rate limited or quota exceeded,
  `503` service not configured).
- **Pagination**: `?limit=` (max 100) and `?offset=`; list responses return
  `{ items, total, limit, offset }`.
- **Snake/camel**: D1 columns are snake_case; the API converts every key to
  camelCase before responding (`toCamelCaseKeys`).
