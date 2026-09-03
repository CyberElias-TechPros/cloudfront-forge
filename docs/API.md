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

Every route is authenticated unless it is `/health`. Admin routes additionally
require an `admin` or `super_admin` row in `admin_users`. All responses use the
envelope `{ success, data?, error?, meta }`.

### Auth

| Method | Path |
| ------ | ---- |
| `POST` | `/api/v1/auth/register` |
| `GET` | `/api/v1/auth/me` |
| `PUT` | `/api/v1/auth/profile` |
| `GET` | `/api/v1/auth/permissions` |

### Users & profiles

| Method | Path |
| ------ | ---- |
| `GET` | `/api/v1/users/:id` |
| `GET` | `/api/v1/users/me/profile` |
| `PUT` | `/api/v1/users/me/profile` |
| `POST` | `/api/v1/users/me/youtube-channel` |
| `GET` | `/api/v1/users/me/member` |
| `GET` | `/api/v1/users/me/youtube-channels` |
| `GET` | `/api/v1/users/me/insights` |

### Communities

| Method | Path |
| ------ | ---- |
| `GET` | `/api/v1/communities` |
| `GET` | `/api/v1/communities/:id` |
| `POST` | `/api/v1/communities` |
| `POST` | `/api/v1/communities/join` |
| `GET` | `/api/v1/communities/:id/members` |
| `PUT` | `/api/v1/communities/:id/settings` |
| `GET` | `/api/v1/admin/communities` |

### Videos

| Method | Path |
| ------ | ---- |
| `GET` | `/api/v1/videos` |
| `POST` | `/api/v1/videos` |
| `GET` | `/api/v1/videos/:id` |

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

| Method | Path |
| ------ | ---- |
| `GET` | `/api/v1/admin/reports` |
| `POST` | `/api/v1/admin/reports/:id/resolve` |
| `POST` | `/api/v1/reports` |
| `POST` | `/api/v1/reports/:id/appeal` |
| `POST` | `/api/v1/admin/appeals/:id` |

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

### Admin

| Method | Path |
| ------ | ---- |
| `GET` | `/api/v1/admin/analytics` |
| `GET` | `/api/v1/admin/users` |
| `GET` | `/api/v1/admin/metrics` |
| `GET` | `/api/v1/admin/retention` |

## Conventions

- **Auth**: `Authorization: Bearer <firebase-id-token>`.
- **Errors**: `{ success: false, error: { code, message } }` with a meaningful
  HTTP status (`400` validation, `401` unauthenticated, `403` forbidden,
  `404` not found, `409` conflict, `429` rate limited or quota exceeded,
  `503` service not configured).
- **Pagination**: `?limit=` (max 100) and `?offset=`; list responses return
  `{ items, total, limit, offset }`.
- **Snake/camel**: D1 columns are snake_case; the API converts every key to
  camelCase before responding (`toCamelCaseKeys`).
