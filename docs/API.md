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

Every response carries `X-Request-Id` (echoing a caller-supplied one when it is a safe token).
Quote it in support reports: it is also the id on the server's structured request log line.

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

110/110 router entries are documented (100%). Every route in the router table is in the contract, and the CI coverage floor is 100% — adding a route without a registry entry fails the contract tests.

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

#### `DELETE /api/v1/users/me`

**Delete the account and schedule data erasure** — auth: `user`

Response `data` fields:

- `message`: string
- `deletedAt`: string

Statuses: `200`, `400`, `401`, `404`, `409`, `429`, `500`, `503`

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

#### `GET /api/v1/users/me/youtube-channels`

**YouTube channels linked to the caller** — auth: `user`

Response `data` fields:

- `items`: array of object
- `connected`: boolean

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

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

**Video detail** — auth: `public`

Public so a shared video link renders for a visitor who is not signed in. Review text is only included for the owner, an assigned reviewer or a moderator.

Statuses: `200`, `400`, `404`, `429`, `500`, `503`

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

#### `POST /api/v1/missions/assignments/{assignmentId}/skip`

**Skip an assignment (no reward, no penalty beyond the miss)** — auth: `user`

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/missions/chain`

**Create a 2–5 step mission chain (admin)** — auth: `admin`

Body fields:

- `niche` (required): string (min 2, max 50)
- `steps` (required): array of object { title, description, difficulty, xpReward, creditReward, timeEstimateMinutes }

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

### Gamification

_XP, credits, reputation, streaks, quests and leaderboards._

#### `GET /api/v1/badges`

**Badges the caller has earned** — auth: `user`

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/credits`

**Credit balance and the 50 most recent transactions** — auth: `user`

Response `data` fields:

- `balance`: number
- `totalEarned`: number
- `totalSpent`: number
- `transactions`: array of object { id, user_id, type, amount, balance_after, description, reference_id, created_at }

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/daily-quests`

**Today's quests and the caller's progress** — auth: `user`

Response `data` fields:

- `items`: array of object { id, title, description, progress, target, completed, xpReward, creditReward }
- `date`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/gamification/daily-bonus`

**Claim the once-a-day login bonus** — auth: `user`

Response `data` fields:

- `credits`: number
- `multiplier`: number
- `streak`: number

Statuses: `200`, `400`, `401`, `404`, `409`, `429`, `500`, `503`

#### `GET /api/v1/leaderboards`

**XP leaderboard, optionally by cohort** — auth: `public`

Public so the landing page can render it before sign-in.

Statuses: `200`, `400`, `404`, `429`, `500`, `503`

#### `GET /api/v1/reputation`

**Trust score and the events that moved it** — auth: `user`

Response `data` fields:

- `score`: number
- `events`: array of object { id, user_id, event_type, points_change, reason, created_at }

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/streaks`

**Current and longest daily streak** — auth: `user`

Response `data` fields:

- `currentStreak`: number
- `longestStreak`: number
- `lastActive`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/xp`

**XP total, level and progress to the next level** — auth: `user`

Response `data` fields:

- `totalXp`: number
- `currentLevel`: number
- `xpToNextLevel`: number
- `transactions`: array of object { id, user_id, amount, source, description, created_at }

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

### Feed

_The watch queue, the caller's submissions and their activity._

#### `GET /api/v1/activity`

**Unread notifications for the caller (the activity bell)** — auth: `user`

Response `data` fields:

- `items`: array of object { id, type, title, message, created_at }
- `total`: number
- `limit`: number
- `offset`: number

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/queue`

**The next video the caller should watch** — auth: `user`

Response `data` fields:

- `items`: array of object { id, title, duration_seconds, status, created_at, user_id, youtube_video_id, youtube_url, channel_id, magic_word, display_name, photo_url, watch_status, xp_awarded, credits_awarded }
- `total`: number
- `limit`: number
- `offset`: number

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/submissions`

**The caller's videos and the attention each one earned** — auth: `user`

Response `data` fields:

- `items`: array of object { id, title, status, created_at, watch_target, comment_count, watcher_count, subs_count }
- `total`: number
- `limit`: number
- `offset`: number

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

### Communities

_Squads: roster, join requests, settings and invites._

#### `GET /api/v1/communities`

**Squads the caller belongs to** — auth: `user`

Response `data` fields:

- `items`: array of object { id, name, description, slug, is_public, isPublic, max_members, maxMembers, logo_url, banner_url, owner_id, invite_code, status, created_at, updated_at }
- `total`: number
- `limit`: number
- `offset`: number

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/communities`

**Create a squad (the caller becomes owner)** — auth: `user`

Body fields:

- `name` (required): string (min 3, max 100)
- `description`: string (max 500)
- `isPublic`: boolean
- `maxMembers`: number (min 10, max 10000)

Response `data` fields:

- `message`: string
- `communityId`: string
- `inviteCode`: string
- `slug`: string

Statuses: `200`, `400`, `401`, `404`, `409`, `429`, `500`, `503`

#### `GET /api/v1/communities/{communityId}`

**One squad: roster, settings and the caller's role** — auth: `user`

Response `data` fields:

- `community`: object { id, name, description, slug, is_public, isPublic, max_members, maxMembers, logo_url, banner_url, owner_id, invite_code, status, created_at, updated_at }
- `memberCount`: number
- `members`: array of object { id, userId, displayName, photoUrl, role, joined_at, joinedAt }
- `settings`: object
- `isOwner`: boolean
- `isMember`: boolean
- `role`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `DELETE /api/v1/communities/{communityId}`

**Archive a squad (soft delete, history preserved)** — auth: `user`

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `POST /api/v1/communities/{communityId}/invite/regenerate`

**Rotate a leaked invite code (owner only)** — auth: `user`

Response `data` fields:

- `message`: string
- `inviteCode`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `POST /api/v1/communities/{communityId}/join`

**Join a public squad, or submit a request when approval is required** — auth: `user`

Body fields:

- `message`: string (max 300)

Response `data` fields:

- `message`: string
- `communityId`: string
- `communityName`: string
- `requestId`: string
- `pending`: boolean

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

#### `POST /api/v1/communities/{communityId}/leave`

**Leave a squad (owners must archive instead)** — auth: `user`

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/communities/{communityId}/members`

**Active roster of a squad** — auth: `user`

Response `data` fields:

- `members`: array of object { id, userId, displayName, photoUrl, role, joined_at, joinedAt }

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `POST /api/v1/communities/{communityId}/members/{memberId}/remove`

**Remove a member from the squad (owner only)** — auth: `user`

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `POST /api/v1/communities/{communityId}/members/{memberId}/role`

**Promote or demote a member (owner only)** — auth: `user`

Body fields:

- `role` (required): `member` | `moderator`

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `GET /api/v1/communities/{communityId}/requests`

**Pending join requests (owner/moderator only)** — auth: `user`

Response `data` fields:

- `items`: array of object { id, message, status, requestedAt, userId, displayName, photoUrl }

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `POST /api/v1/communities/{communityId}/requests/{requestId}/approve`

**Approve a join request** — auth: `user`

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

#### `POST /api/v1/communities/{communityId}/requests/{requestId}/reject`

**Reject a join request** — auth: `user`

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

#### `PUT /api/v1/communities/{communityId}/settings`

**Update squad settings and rules (owner only)** — auth: `user`

Body fields:

- `allowPeerReview`: boolean
- `allowCollaboration`: boolean
- `requireApproval`: boolean
- `defaultLanguage`: string (min 2, max 10)
- `rules`: string (max 5000)

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `POST /api/v1/communities/join`

**Join a squad with an invite code** — auth: `user`

Body fields:

- `inviteCode` (required): string (min 4, max 20)

Response `data` fields:

- `message`: string
- `communityId`: string
- `communityName`: string
- `requestId`: string
- `pending`: boolean

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

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

#### `POST /api/v1/admin/topups/{topupId}/approve`

**Approve a transfer and credit the account** — auth: `admin`

Response `data` fields:

- `message`: string
- `credits`: number
- `balance`: number

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

#### `GET /api/v1/admin/topups/{topupId}/proof`

**Receipt image for a top-up (admin browsers render it inline)** — auth: `admin`

Binary image response (jpeg/png/webp), not a JSON envelope.

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `POST /api/v1/admin/topups/{topupId}/reject`

**Decline a transfer with a reason** — auth: `admin`

Body fields:

- `reason`: string (max 500)

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

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

#### `POST /api/v1/topups/proof`

**Upload a payment receipt to R2** — auth: `user`

multipart/form-data with a single `file` field (jpeg/png/webp, max 5 MB). Returns the `proof:<path>` token to send with the top-up.

Response `data` fields:

- `path`: string
- `name`: string
- `type`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

### Notifications

_Inbox, preferences and push registration._

#### `GET /api/v1/notifications`

**Inbox for the caller** — auth: `user`

Response `data` fields:

- `notifications`: array of object { id, type, title, message, isRead, createdAt }
- `unreadCount`: number

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/notifications`

**Create a notification for the caller (system/admin use)** — auth: `user`

Body fields:

- `type` (required): string (min 1)
- `title` (required): string (min 1, max 200)
- `message` (required): string (min 1, max 1000)
- `data`: object

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

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

### Safety

_Reports, appeals and the enforcement trail._

#### `POST /api/v1/admin/appeals/{appealId}`

**Accept or reject an appeal** — auth: `moderator`

Body fields:

- `status` (required): `accepted` | `rejected`
- `note`: string (max 2000)

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

#### `POST /api/v1/reports`

**Report a video, review, comment, member or squad** — auth: `user`

Body fields:

- `reportedUserId`: string
- `resourceType` (required): `video` | `review` | `comment` | `user` | `community`
- `resourceId` (required): string (min 1)
- `reason` (required): `spam` | `inappropriate` | `harassment` | `cheating` | `misleading` | `other`
- `description`: string (max 1000)

Response `data` fields:

- `message`: string
- `reportId`: string

Statuses: `200`, `400`, `401`, `404`, `409`, `429`, `500`, `503`

#### `POST /api/v1/reports/{reportId}/appeal`

**Appeal a report the caller was named in** — auth: `user`

Body fields:

- `reason` (required): string (min 10, max 2000)

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

#### `GET /api/v1/reports/mine`

**Reports the caller filed, with appeal state** — auth: `user`

Response `data` fields:

- `items`: array of object { id, reason, resource_type, resource_id, status, created_at, resolution_notes, appealed }

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

### Support

_Member support requests and the operator queue._

#### `GET /api/v1/admin/support`

**Support queue (moderator view)** — auth: `moderator`

Response `data` fields:

- `items`: array of object { id, topic, message, status, createdAt, resolvedAt, displayName, email }

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `POST /api/v1/admin/support/{supportId}/resolve`

**Mark a support request resolved** — auth: `moderator`

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

#### `POST /api/v1/support`

**Contact the team about an account, credit or moderation problem** — auth: `user`

Body fields:

- `topic` (required): `account` | `credits` | `community` | `video` | `moderation` | `bug` | `other`
- `message` (required): string (min 10, max 2000)

Response `data` fields:

- `message`: string
- `supportId`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

### Admin

_Operator console: analytics, metrics, retention, moderation actions._

#### `GET /api/v1/admin/analytics`

**Funnel totals, event counts and the daily trend** — auth: `admin`

Response `data` fields:

- `period`: string
- `totals`: object { submits, claims, reviews, claimRate }
- `events`: array of object { event_type, count }
- `dailyTrend`: array of object { day, event_type, count }

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `GET /api/v1/admin/appeals`

**Appeals awaiting review** — auth: `moderator`

Response `data` fields:

- `items`: array of object { id, reason, status, createdAt, reviewedAt, note, reportId, userId, displayName }

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `GET /api/v1/admin/communities`

**Every squad with its owner and member count** — auth: `admin`

Response `data` fields:

- `items`: array of object { id, name, slug, description, status, is_public, member_count, owner_name, created_at }
- `total`: number
- `limit`: number
- `offset`: number

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `GET /api/v1/admin/metrics`

**Headline counts used by the operator dashboard and alerting** — auth: `admin`

Response `data` fields:

- `users`: number
- `communities`: number
- `videos`: number
- `reviews`: number
- `pendingReports`: number

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `GET /api/v1/admin/reports`

**Report queue (moderator view)** — auth: `moderator`

Response `data` fields:

- `items`: array of object { id, reason, resource_type, resource_id, status, created_at, reporter_name, reported_name, description }

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `POST /api/v1/admin/reports/{reportId}/resolve`

**Close a report as resolved or dismissed** — auth: `moderator`

Body fields:

- `status` (required): `resolved` | `dismissed`
- `resolutionNotes`: string (max 2000)

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `GET /api/v1/admin/retention`

**Weekly cohort retention (week 1 and week 4)** — auth: `admin`

Response `data` fields:

- `cohorts`: array of object { date, total, week1Retention, week4Retention }

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `GET /api/v1/admin/users`

**Member directory with trust score and platform role** — auth: `admin`

Response `data` fields:

- `items`: array of object { id, email, display_name, photo_url, status, created_at, trust_score, platform_role }
- `total`: number
- `limit`: number
- `offset`: number

Statuses: `200`, `400`, `401`, `403`, `404`, `429`, `500`, `503`

#### `POST /api/v1/admin/users/{userId}/reinstate`

**Lift a suspension** — auth: `admin`

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

#### `POST /api/v1/admin/users/{userId}/role`

**Grant or remove the moderator/admin platform role** — auth: `admin`

Body fields:

- `role` (required): `moderator` | `admin`

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

#### `POST /api/v1/admin/users/{userId}/suspend`

**Suspend a member and record the reason** — auth: `admin`

Body fields:

- `reason`: string (max 500)

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

#### `POST /api/v1/admin/videos/{videoId}/restore`

**Return a removed video to the queue** — auth: `moderator`

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `403`, `404`, `409`, `429`, `500`, `503`

### AI

_The platform-aware coach._

#### `POST /api/v1/ai/chat`

**Ask the platform-aware growth coach a question** — auth: `user`

Body fields:

- `message` (required): string (min 1)
- `conversationId`: string

Response `data` fields:

- `conversationId`: string
- `reply`: string
- `conversation`: object { id, title }

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `POST /api/v1/ai/chat/stream`

**Same as /ai/chat but streams tokens** — auth: `user`

Responds with text/event-stream chunks rather than one JSON envelope.

Body fields:

- `message` (required): string (min 1)
- `conversationId`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/ai/conversations`

**The caller's AI conversations** — auth: `user`

Response `data` fields:

- `conversations`: array of object { id, title, created_at, updated_at }

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `DELETE /api/v1/ai/conversations/{conversationId}`

**Delete a conversation and its messages** — auth: `user`

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/ai/conversations/{conversationId}/messages`

**Messages in one conversation** — auth: `user`

Response `data` fields:

- `messages`: array of object { id, role, content, created_at }

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

### YouTube

_Channel linking and OAuth._

#### `POST /api/v1/youtube/disconnect`

**Revoke the stored YouTube tokens** — auth: `user`

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/youtube/oauth/authorize`

**Begin the YouTube OAuth flow** — auth: `user`

Response `data` fields:

- `authUrl`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/youtube/oauth/callback`

**OAuth redirect target (bounces back to the SPA)** — auth: `public`

Google redirects the browser here; the handler then redirects to the SPA with a result flag.

Statuses: `200`, `400`, `404`, `429`, `500`, `503`

#### `POST /api/v1/youtube/oauth/callback`

**Finish the OAuth exchange from a client** — auth: `public`

Response `data` fields:

- `message`: string

Statuses: `200`, `400`, `404`, `429`, `500`, `503`

#### `GET /api/v1/youtube/status`

**Whether the caller has a usable YouTube connection** — auth: `user`

Response `data` fields:

- `connected`: boolean
- `channelId`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

### Discovery

_Search and collaborator matching._

#### `GET /api/v1/discover/collaborators`

**Members open to collaborating** — auth: `user`

Response `data` fields:

- `items`: array of any
- `intent`: string

Statuses: `200`, `400`, `401`, `404`, `429`, `500`, `503`

#### `GET /api/v1/search`

**Search squads and videos** — auth: `user`

Response `data` fields:

- `communities`: array of object { id, name, description, slug, is_public, isPublic, max_members, maxMembers, logo_url, banner_url, owner_id, invite_code, status, created_at, updated_at }
- `videos`: array of object { id, title, duration_seconds, status, created_at, user_id, youtube_video_id, youtube_url, channel_id, magic_word, display_name, photo_url, watch_status, xp_awarded, credits_awarded }

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

