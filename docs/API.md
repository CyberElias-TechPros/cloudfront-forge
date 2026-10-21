# API reference

> **Generated** from `workers/api/src/contract/openapi.generated.json` by `npm run docs:api`.
> Do not edit by hand — the contract is the source of truth and CI fails on drift.

**LoopSquad API v1.0.0** — OpenAPI 3.1.0

HTTP API for LoopSquad: verified watch-for-watch growth for creator communities.

Every response is enveloped:
- success: `{ success: true, data, meta }`
- failure: `{ success: false, error: { code, message }, meta }`

Authenticate with a Firebase ID token (`Authorization: Bearer <token>`). Clients must branch on
`error.code` (see the Error schema), never on `error.message`.

## Servers

- Production: `https://creatorloop-api.autumn-surf-21ec.workers.dev`
- Staging: `https://creatorloop-api-staging.autumn-surf-21ec.workers.dev`
- Local wrangler dev: `http://localhost:8787`

Live document: `GET /openapi.json` on any deployment.

## Authentication

`Authorization: Bearer <Firebase ID token>`. Operations marked **public** need no token. The Worker derives the member from the verified token; no endpoint accepts a client-supplied user id.

## Error codes

Clients branch on `error.code`, never on `error.message`.

| Code | HTTP | Retryable | Client action | Meaning |
| --- | --- | --- | --- | --- |
| `VALIDATION_ERROR` | 400 | no | `fix_input` | The payload failed schema validation. |
| `BAD_REQUEST` | 400 | no | `fix_input` | The request was malformed. |
| `UNAUTHORIZED` | 401 | no | `sign_in` | The presented credential is not valid for this request. |
| `AUTH_REQUIRED` | 401 | no | `sign_in` | A Firebase ID token is required (or it expired). |
| `AUTH_ERROR` | 401 | no | `sign_in` | Authentication could not be completed. |
| `FORBIDDEN` | 403 | no | `none` | The authenticated member is not allowed to perform this action. |
| `ACCOUNT_DELETED` | 403 | no | `contact_support` | This account has been deleted. |
| `ACCOUNT_SUSPENDED` | 403 | no | `contact_support` | This account is suspended. |
| `ACCOUNT_BANNED` | 403 | no | `contact_support` | This account has been banned. |
| `SUBMISSION_COOLDOWN` | 429 | yes | `wait` | The member submitted a video too recently (one per cooldown window). |
| `RATIO_GATE` | 403 | no | `none` | The member's give/take ratio is below the minimum required to submit. |
| `CHANNEL_CONFLICT` | 409 | no | `contact_support` | This YouTube channel is already linked to another account. |
| `AI_NOT_CONFIGURED` | 503 | yes | `none` | The AI coach is not configured on this deployment. |
| `NOT_FOUND` | 404 | no | `none` | The requested resource does not exist (or is not visible to this member). |
| `CONFLICT` | 409 | no | `none` | The request conflicts with the current state of the resource. |
| `INSUFFICIENT_CREDITS` | 400 | no | `upgrade` | The member does not have enough credits for this purchase. |
| `DAILY_LIMIT` | 429 | yes | `wait` | A per-day allowance (e.g. claimable watches) is exhausted. |
| `RATE_LIMITED` | 429 | yes | `wait` | Too many requests from this client in the current window. |
| `QUOTA_EXCEEDED` | 429 | yes | `wait` | A member- or platform-level quota (e.g. AI messages) is exhausted. |
| `INTERNAL_ERROR` | 500 | yes | `retry` | An unexpected server error. Safe to retry with backoff. |
| `DATABASE_ERROR` | 500 | yes | `retry` | The database operation failed. Safe to retry with backoff. |
| `SERVICE_UNAVAILABLE` | 503 | yes | `retry` | A dependency is unavailable. Respect `Retry-After`. |
| `AI_UNAVAILABLE` | 503 | yes | `retry` | The AI provider is not configured or is failing. |
| `MISSING_ENV` | 503 | yes | `contact_support` | The deployment is missing a required binding or secret. |
| `SCHEMA_OUT_OF_DATE` | 503 | yes | `retry` | Migrations have not been applied yet; the service is being updated. |
| `NOT_READY` | 503 | yes | `retry` | A readiness dependency failed (`/ready` gate). |

Retryable codes return `Retry-After` where applicable; clients should back off with jitter.

## Contract coverage

45/110 router entries are documented (40.9%). Undocumented routes are listed in `workers/api/src/contract/inventory.generated.json` and are being migrated into the contract schema-by-schema (PLAT-002).

## Endpoints

### Auth

_Identity bootstrap and profile._

#### `GET /api/v1/auth/me`

**Bootstrap the signed-in member** — auth: `user`

Response `data` fields:

- `id`: string
- `firebaseUid`: string
- `email`: string
- `displayName`: string
- `name`: string
- `photoUrl`: string
- `level`: number
- `totalXp`: number
- `credits`: number
- `streak`: number
- `niche`: string
- `publicProfile`: boolean
- `createdAt`: string
- `updatedAt`: string
- `lastActive`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/auth/permissions`

**Roles and permissions for the caller** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `PUT /api/v1/auth/profile`

**Update display name or email** — auth: `user`

Body fields:

- `displayName`: string (min 1, max 50)
- `email`: string

Response `data` fields:

- `id`: string
- `firebaseUid`: string
- `email`: string
- `displayName`: string
- `name`: string
- `photoUrl`: string
- `level`: number
- `totalXp`: number
- `credits`: number
- `streak`: number
- `niche`: string
- `publicProfile`: boolean
- `createdAt`: string
- `updatedAt`: string
- `lastActive`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/auth/register`

**Register (or return) the account for the verified token** — auth: `user`

Identity comes exclusively from the bearer token; a client-supplied `firebaseUid` is ignored.

Body fields:

- `firebaseUid`: string (min 1)
- `email`: string
- `displayName`: string (min 1, max 50)
- `photoUrl`: string

Response `data` fields:

- `id`: string
- `firebaseUid`: string
- `email`: string
- `displayName`: string
- `name`: string
- `photoUrl`: string
- `level`: number
- `totalXp`: number
- `credits`: number
- `streak`: number
- `niche`: string
- `publicProfile`: boolean
- `createdAt`: string
- `updatedAt`: string
- `lastActive`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

### Users

_Member profiles, insights and channel links._

#### `GET /api/v1/users/{userId}`

**Public member profile (respects the member's visibility setting)** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/users/me/insights`

**Personal growth insights** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/users/me/member`

**Member card used by the header and dashboard** — auth: `user`

Response `data` fields:

- `id`: string
- `firebaseUid`: string
- `email`: string
- `displayName`: string
- `name`: string
- `photoUrl`: string
- `level`: number
- `totalXp`: number
- `credits`: number
- `streak`: number
- `niche`: string
- `publicProfile`: boolean
- `createdAt`: string
- `updatedAt`: string
- `lastActive`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/users/me/profile`

**Full profile of the caller** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `PUT /api/v1/users/me/profile`

**Update profile, goals and visibility** — auth: `user`

Body fields:

- `displayName`: string (min 1, max 50)
- `bio`: string (max 500)
- `country`: string (max 100)
- `language`: string (max 50)
- `experienceLevel`: `beginner` | `intermediate` | `advanced`
- `niche`: string (max 100)
- `contentCategories`: string (max 500)
- `goals`: string (max 500)
- `lookingFor`: `collaboration` | `feedback` | `support` | `mentorship`
- `publicProfile`: boolean

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/users/me/youtube-channel`

**Link a YouTube channel to the member** — auth: `user`

Body fields:

- `channelId` (required): string (min 1)
- `channelName`: string

Statuses: `200`, `400`, `401`, `404`, `409`, `429`, `500`, `503`

### Watch

_Verified watch sessions and payouts._

#### `POST /api/v1/watch`

**Claim a watched video** — auth: `user`

Payout depends on the evidence level: server-verified watch time (YouTube API or signed session) pays; self-reported time is recorded but pays nothing under the `evidence` policy.

Body fields:

- `videoId` (required): string (min 1)
- `watchSeconds` (required): number (min 0, max 86400)
- `subscribed`: boolean
- `commented`: boolean
- `sessionToken`: string (max 512)

Response `data` fields:

- `status`: `started` | `verified` | `claimed`
- `claimable`: boolean
- `attentionBlocked`: boolean
- `xpAwarded`: number
- `creditsAwarded`: number
- `watchVerified`: boolean
- `subscribed`: boolean
- `commented`: boolean
- `rewardBreakdown`: object { watch, subscribe, comment }
- `evidence`: object { level, paid, verifiedSeconds, reason }
- `subReason`: string
- `level`: number
- `totalXp`: number

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

#### `POST /api/v1/watch/challenge`

**Issue a mid-watch attention challenge** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/watch/challenge/{challengeId}/answer`

**Answer an attention challenge** — auth: `user`

Body fields:

- `answer` (required): any

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/watch/heartbeat`

**Record a player-time sample** — auth: `user`

Body fields:

- `sessionToken` (required): string (min 1, max 512)
- `playerTime` (required): number (min 0, max 86400)

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/watch/start`

**Open a signed watch session** — auth: `user`

Returns `{ sessionToken: null, enabled: false }` while `WATCH_SESSIONS_ENABLED` is off; the claim then falls back to weak evidence (SEC-010).

Body fields:

- `videoId` (required): string (min 1)

Response `data` fields:

- `sessionToken`: string
- `enabled`: boolean
- `startTs`: number

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

### Videos

_Submissions and archive._

#### `GET /api/v1/videos`

**List videos visible to the caller** — auth: `user`

Response `data` fields:

- `videos`: array of object { id, youtubeVideoId, youtubeUrl, title, thumbnailUrl, durationSeconds, status, createdAt }
- `pagination`: object { limit, offset, total }

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/videos`

**Submit a YouTube video to the loop** — auth: `user`

Body fields:

- `youtubeUrl` (required): string
- `communityId`: string
- `title`: string (min 1, max 200)
- `magicWord`: string (min 2, max 30)
- `niche`: string (max 50)

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

#### `GET /api/v1/videos/{videoId}`

**Video detail** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/videos/{videoId}/archive`

**Archive one of the caller's videos** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

### Reviews

_Structured peer reviews._

#### `GET /api/v1/reviews`

**Reviews assigned to or submitted by the caller** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/reviews/{reviewId}`

**Review detail with questions** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/reviews/{reviewId}/answers`

**Draft the structured answers for a review** — auth: `user`

Body fields:

- `answers`: array of object { questionId, ratingValue, textAnswer }

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/reviews/{reviewId}/complete`

**Complete a review and trigger its single payout** — auth: `user`

Body fields:

- `score`: number (min 1, max 5)
- `feedbackText`: string (max 2000)
- `answers`: array of object { questionId, ratingValue, textAnswer }

Statuses: `200`, `400`, `401`, `404`, `409`, `429`, `500`, `503`

#### `POST /api/v1/reviews/{reviewId}/helpful`

**Rate a received review as helpful** — auth: `user`

Body fields:

- `helpful` (required): boolean

Statuses: `200`, `400`, `401`, `404`, `409`, `429`, `500`, `503`

#### `POST /api/v1/reviews/{reviewId}/start`

**Mark a review in progress** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `409`, `429`, `500`, `503`

### Missions

_Missions, chains and assignments._

#### `GET /api/v1/missions`

**Missions available to the caller** — auth: `user`

Response `data` fields:

- `missions`: array of object { id, title, description, difficulty, xpReward, creditReward, status }

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/missions`

**Create a mission (admin)** — auth: `admin`

Body fields:

- `title` (required): string (min 5, max 200)
- `description` (required): string (max 1000)
- `difficulty`: `easy` | `medium` | `hard`
- `xpReward`: number (min 0)
- `creditReward`: number (min 0)
- `timeEstimateMinutes`: number (min 1, max 300)
- `chainId`: string
- `chainStep`: number (min 1, max 3)

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `POST /api/v1/missions/{missionId}/assign`

**Assign a mission to the caller** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `409`, `429`, `500`, `503`

#### `GET /api/v1/missions/assignments`

**The caller's mission assignments** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/missions/assignments/{assignmentId}/complete`

**Complete an assignment (pays once)** — auth: `user`

Body fields:

- `completionData`: string (max 2000)

Statuses: `200`, `400`, `401`, `404`, `409`, `429`, `500`, `503`

#### `POST /api/v1/missions/chain`

**Create a 2–5 step mission chain (admin)** — auth: `admin`

Body fields:

- `niche` (required): string (min 2, max 50)
- `steps` (required): array of object { title, description, difficulty, xpReward, creditReward, timeEstimateMinutes }

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

### Shop

_Credit sinks._

#### `GET /api/v1/shop`

**Shop catalogue and the caller's balance** — auth: `user`

Response `data` fields:

- `items`: array of object { id, name, description, cost, itemType }
- `balance`: number

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/shop/purchase`

**Spend credits on a boost or streak freeze** — auth: `user`

Body fields:

- `itemType` (required): `boost` | `streak_freeze`
- `videoId`: string

Statuses: `200`, `400`, `401`, `404`, `409`, `429`, `500`, `503`

### Top-ups

_NGN top-ups (web only — not sold in the Play app)._

#### `GET /api/v1/admin/topups`

**Top-up review queue (admin)** — auth: `admin`

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `GET /api/v1/topups`

**Server-defined top-up tiers** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/topups`

**Request a top-up awaiting admin review** — auth: `user`

Web only. The Android app must route purchases through Play Billing (AND-059/060).

Body fields:

- `tierId` (required): string (min 1, max 32)
- `proofImage`: string (min 1, max 512)
- `proofImageName`: string (max 255)
- `proofImageType`: string (max 64)
- `transferReference`: string (min 4, max 64)

Statuses: `200`, `400`, `401`, `404`, `409`, `429`, `500`, `503`

#### `GET /api/v1/topups/mine`

**The caller's top-up requests and their state** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

### Notifications

_Inbox, preferences and push registration._

#### `GET /api/v1/notifications`

**Inbox for the caller** — auth: `user`

Response `data` fields:

- `notifications`: array of object { id, type, title, message, isRead, createdAt }
- `unreadCount`: number

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `DELETE /api/v1/notifications/{notificationId}`

**Delete one notification** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/notifications/{notificationId}/read`

**Mark one notification read** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/notifications/preferences`

**Per-channel notification preferences** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `PUT /api/v1/notifications/preferences`

**Update preferences and quiet hours** — auth: `user`

Body fields:

- `emailEnabled`: boolean
- `pushEnabled`: boolean
- `inAppEnabled`: boolean
- `whatsappEnabled`: boolean
- `missionReminders`: boolean
- `reviewRequests`: boolean
- `communityUpdates`: boolean
- `quietHoursStart`: number (min 0, max 23)
- `quietHoursEnd`: number (min 0, max 23)

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/notifications/push/subscribe`

**Register a Web Push subscription (web and PWA only)** — auth: `user`

Body fields:

- `endpoint` (required): string (min 1, max 2048)
- `keys` (required): object { p256dh, auth }

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/notifications/push/unsubscribe`

**Remove a Web Push subscription** — auth: `user`

Body fields:

- `endpoint` (required): string (min 1, max 2048)

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/notifications/read-all`

**Mark the whole inbox read** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

### System

_Health, readiness and the API document._

#### `GET /health`

**Liveness probe (answers even when configuration is incomplete)** — auth: `public`

Statuses: `200`, `400`, `404`, `429`, `500`, `503`

#### `GET /openapi.json`

**This document** — auth: `public`

Statuses: `200`, `400`, `404`, `429`, `500`, `503`

#### `GET /ready`

**Readiness gate — verifies bindings and applied schema** — auth: `public`

Statuses: `200`, `400`, `404`, `429`, `500`, `503`

