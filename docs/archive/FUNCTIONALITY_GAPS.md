# Functionality Gaps & Mock Data Audit

**Date:** 2026-08-16
**Scope:** Full repository audit excluding `node_modules`, `.output`, `.wrangler`
**Methodology:** Static code review, pattern search, endpoint cataloging, frontend/backend contract analysis

---

## Executive Summary

The application has **significant functionality gaps** and **unnecessary mock/fallback data** scattered throughout the codebase. While the core architecture is sound, many features are either stubbed, return synthetic data, or silently fail without user feedback. This makes the app **not production-ready** despite passing typechecks and linting.

**Risk Level: HIGH**

---

## 1. HARDCODED FALLBACK / MOCK DATA

### 1.1 Frontend Hardcoded Values

| File | Line | Issue |
|------|------|-------|
| `src/routes/profile.tsx` | 82 | `const xpPct = 62;` — Hardcoded XP progress percentage. Should be calculated from real XP data. |
| `src/routes/communities.tsx` | 66 | `const currentUser = member ?? { ... hardcoded defaults ... }` — Large hardcoded user fallback object with fake stats. |
| `src/routes/dashboard.tsx` | 51 | `const currentUser = member ?? { ... hardcoded defaults ... }` — Same pattern, fake user data. |
| `src/routes/gamification.tsx` | 46 | `const currentUser = member ?? { ... hardcoded defaults ... }` — Same pattern. |
| `src/routes/missions.tsx` | 72 | `const currentUser = member ?? { ... hardcoded defaults ... }` — Same pattern. |
| `src/routes/profile.tsx` | 66 | `const memberSince = profile?.createdAt ? ... : "Aug 2026"` — Hardcoded fallback date. |
| `src/routes/submit.tsx` | 80-93 | Multiple `placeholder` attributes with example text. These are UI placeholders, not functional gaps, but indicate unfinished UX. |
| `src/routes/ai.tsx` | 176 | `"Explain how peer reviews work on LoopSquad."` — Hardcoded suggestion text. |

**Impact:** Users see fake data when API calls fail. The app gives an illusion of working while showing placeholder values.

---

### 1.2 Backend Dev Fallbacks

| File | Line | Issue |
|------|------|-------|
| `workers/api/src/routes/videos.ts` | 196-205 | `fetchYouTubeMetadata()` returns **synthetic metadata** when `YOUTUBE_API_KEY` is missing or set to `"placeholder"`. Returns fake title `"Test Video"` and duration `600`. This bypasses real YouTube verification entirely in dev. |
| `workers/api/src/routes/videos.ts` | 219-224 | When YouTube API returns no video data, falls back to `title: "YouTube Video"`, `durationSeconds: 0`. No error is thrown — the system accepts empty video metadata. |
| `workers/api/src/services/ai.ts` | 23 | `if (!apiKey || apiKey === "placeholder")` — AI service has placeholder check. If triggered, the AI chat endpoint may return empty/generic responses. |
| `workers/api/src/services/firebase.ts` | 67 | `if (env.ENVIRONMENT !== "development") return null;` — Firebase service method only works in development. In production, it silently returns `null`, potentially breaking auth verification. |
| `workers/api/src/services/user.ts` | 52 | Dev auth service returns `null` silently when Firebase client email is missing. |
| `workers/api/src/middleware/rateLimit.ts` | 30 | `const count = current ? (current as any).count : 0;` — If KV rate limit data is missing, count defaults to `0`, allowing requests through. |

**Impact:** In development, the app can be tested without real API keys. But if these fallbacks leak to production, the system is bypassable and data integrity is compromised.

---

## 2. SILENT ERROR HANDLING / EMPTY FALLBACKS

### 2.1 Frontend Hooks Silently Return Empty Arrays

Most React Query hooks catch errors and return empty arrays `[]` without surfacing errors to users:

| Hook | File | Line | Behavior |
|------|------|------|----------|
| `useAdminReports` | `src/hooks/use-api.ts` | 521 | Returns `[]` on error with only `console.warn` |
| `useAdminMetrics` | `src/hooks/use-api.ts` | 500 | Returns `0` counts on error with only `console.warn` |
| `useAdminUsers` | `src/hooks/use-api.ts` | 535 | Returns `[]` on error with only `console.warn` |
| `useCommunities` | `src/hooks/use-api.ts` | 88 | Returns `[]` on error with only `console.warn` |
| `useReviews` | `src/hooks/use-api.ts` | 166 | Returns `[]` on error with only `console.warn` |
| `useBadges` | `src/hooks/use-api.ts` | 211 | Returns `[]` on error with only `console.warn` |
| `useXp` | `src/hooks/use-api.ts` | 246 | Returns `{ totalXp: 0, currentLevel: 1 }` on error with only `console.warn` |
| `useCredits` | `src/hooks/use-api.ts` | 432 | Returns `{ balance: 0 }` on error with `console.warn` |
| `useStreaks` | `src/hooks/use-api.ts` | 457 | Returns `{ currentStreak: 0, longestStreak: 0 }` on error with only `console.warn` |
| `useLeaderboard` | `src/hooks/use-api.ts` | 471 | Returns `[]` on error with only `console.warn` |
| `useCurrentMember` | `src/hooks/use-api.ts` | 585 | Returns `null` on error with only `console.warn` |
| `useQueueTasks` | `src/hooks/use-api.ts` | 599 | Returns `[]` on error with only `console.warn` |
| `useSubmissions` | `src/hooks/use-api.ts` | 613 | Returns `[]` on error with only `console.warn` |
| `useActivity` | `src/hooks/use-api.ts` | 655 | Returns `[]` on error with only `console.warn` |

**Impact:** When the backend is down or returns errors, the UI shows empty states instead of error messages. Users cannot distinguish between "no data" and "something broke." This is a critical UX and debugging issue.

---

### 2.2 Backend Silent Error Handling

| File | Line | Issue |
|------|------|-------|
| `workers/api/src/lib/database.ts` | 16, 27, 38, 53 | All DB methods (`query`, `querySingle`, `execute`, `batch`) catch errors and return `null`, `[]`, or `false` silently. Only `console.error` is logged. The calling code must check `success` flags, but many routes don't. |
| `workers/api/src/middleware/auth.ts` | 30 | Returns `null` on auth failure. The `index.ts` catches this as `"AUTH_required"` but the error context is lost. |
| `workers/api/src/routes/watch.ts` | 228 | `console.error("Watch submit error:", error);` — logs error but returns generic 500. No detailed error info. |
| `workers/api/src/routes/videos.ts` | 243-245 | `if (!duration) return null;` and `if (!match) return 0;` — Silent failures in duration parsing. |
| `workers/api/src/services/youtube.ts` | 263 | `if (!response.ok) return 0;` — Watch time API errors silently return `0` minutes. |

---

## 3. INCOMPLETE / STUBBED FEATURES

### 3.1 Settings Button (Non-Functional)

| File | Line | Issue |
|------|------|-------|
| `src/routes/profile.tsx` | 85-91 | "Settings" button in `PageHeader` has no `onClick` handler. It does nothing. No settings page exists. |
| `src/components/site-chrome.tsx` | 85-91 | Same non-functional Settings button appears in site chrome. |

**Impact:** Users expect a settings page but get a dead button.

---

### 3.2 Search Functionality (UI Only)

| File | Line | Issue |
|------|------|-------|
| `src/routes/communities.tsx` | 137 | Search input exists but no backend search endpoint is implemented. |
| `src/routes/submit.tsx` | 80 | Search input exists but no search functionality wired. |

**Impact:** Search UI exists but does nothing.

---

### 3.3 Notification System (Partial)

| File | Line | Issue |
|------|------|-------|
| `workers/api/src/routes/notifications.ts` | Full file | CRUD endpoints exist, but no actual notification sending logic (email, push, in-app triggers). Notifications are only created manually or by direct DB insertion. |
| `src/hooks/use-api.ts` | — | `useNotifications` hook exists but no real-time updates (no WebSocket, no polling, no push). |

**Impact:** Notifications are write-only. Users won't receive real-time alerts.

---

### 3.4 AI Conversations (Basic CRUD Only)

| File | Line | Issue |
|------|------|-------|
| `workers/api/src/routes/ai.ts` | Full file | Only basic chat, list conversations, and delete conversation. No conversation branching, no context window management, no streaming responses. |
| `src/routes/ai.tsx` | Full file | Frontend shows "saved conversations" but persistence is basic and no real streaming UX. |

**Impact:** AI feature is functional but basic. No advanced conversation features.

---

### 3.5 Admin Panel (Frontend Only)

| File | Line | Issue |
|------|------|-------|
| `src/routes/admin.tsx` | Full file | Admin UI exists with tabs for users, communities, reports, metrics. However, frontend does not check admin permissions before rendering — it relies entirely on backend `requireAdmin` middleware. |
| `src/components/site-chrome.tsx` | 28 | Admin link is conditionally shown (`member?.isAdmin`) but `isAdmin` is never set by the current API response. |

**Impact:** Admin link may never appear even for admin users, or may appear for non-admins if `isAdmin` is incorrectly set.

---

### 3.6 YouTube Watch Time Verification (Incomplete)

| File | Line | Issue |
|------|------|-------|
| `workers/api/src/services/youtube.ts` | 262-268 | `getWatchTime()` method exists but is **never called** by any route. Watch time verification is not implemented. |
| `workers/api/src/routes/watch.ts` | Full file | Only checks subscription status, not actual watch time. The `REQUIRED_WATCH_SEC = 180` is hardcoded and not validated against YouTube Analytics. |

**Impact:** Users can claim rewards without actually watching videos for the required time. Anti-cheat is incomplete.

---

### 3.7 Video Submission Metadata (Dev Fallback)

| File | Line | Issue |
|------|------|-------|
| `workers/api/src/routes/videos.ts` | 196-205 | Returns fake metadata when YouTube API is not configured. This allows testing but means video verification can be bypassed. |

---

## 4. MISSING BACKEND ENDPOINTS / FRONTEND CONTRACTS

### 4.1 Frontend Expects These Backend Endpoints

All of the following are **implemented** in the backend and match frontend expectations:

| Frontend Call | Backend Route | Status |
|---------------|---------------|--------|
| `POST /api/v1/auth/register` | `auth.ts:25` | ✅ Implemented |
| `GET /api/v1/auth/me` | `auth.ts:62` | ✅ Implemented |
| `PUT /api/v1/auth/profile` | `auth.ts:85` | ✅ Implemented |
| `GET /api/v1/auth/permissions` | `auth.ts:116` | ✅ Implemented |
| `GET /api/v1/communities` | `communities.ts:36` | ✅ Implemented |
| `GET /api/v1/communities/:id` | `communities.ts:63` | ✅ Implemented |
| `POST /api/v1/communities` | `communities.ts:125` | ✅ Implemented |
| `POST /api/v1/communities/join` | `communities.ts:187` | ✅ Implemented |
| `GET /api/v1/missions` | `missions.ts:23` | ✅ Implemented |
| `POST /api/v1/missions` | `missions.ts:54` | ✅ Implemented |
| `GET /api/v1/missions/assignments` | `missions.ts:144` | ✅ Implemented |
| `POST /api/v1/missions/:id/assign` | `missions.ts:101` | ✅ Implemented |
| `POST /api/v1/missions/assignments/:id/complete` | `missions.ts:172` | ✅ Implemented |
| `GET /api/v1/videos` | `videos.ts:29` | ✅ Implemented |
| `POST /api/v1/videos` | `videos.ts:63` | ✅ Implemented |
| `GET /api/v1/reviews` | `videos.ts:257` | ✅ Implemented |
| `GET /api/v1/reviews/:id` | `videos.ts:298` | ✅ Implemented |
| `POST /api/v1/reviews/:id/start` | `videos.ts:396` | ✅ Implemented |
| `POST /api/v1/reviews/:id/complete` | `videos.ts:423` | ✅ Implemented |
| `GET /api/v1/reviews/:id/answers` | `videos.ts:484` | ✅ Implemented |
| `POST /api/v1/watch` | `watch.ts:68` | ✅ Implemented |
| `GET /api/v1/credits` | `gamification.ts:12` | ✅ Implemented |
| `GET /api/v1/xp` | `gamification.ts:53` | ✅ Implemented |
| `GET /api/v1/streaks` | `gamification.ts:122` | ✅ Implemented |
| `GET /api/v1/badges` | `gamification.ts:156` | ✅ Implemented |
| `GET /api/v1/leaderboards` | `gamification.ts:181` | ✅ Implemented |
| `GET /api/v1/notifications` | `notifications.ts:26` | ✅ Implemented |
| `POST /api/v1/notifications` | `notifications.ts:61` | ✅ Implemented |
| `POST /api/v1/notifications/:id/read` | `notifications.ts:104` | ✅ Implemented |
| `DELETE /api/v1/notifications/:id` | `notifications.ts:131` | ✅ Implemented |
| `PUT /api/v1/notifications/preferences` | `notifications.ts:158` | ✅ Implemented |
| `GET /api/v1/notifications/preferences` | `notifications.ts:240` | ✅ Implemented |
| `GET /api/v1/youtube/oauth/authorize` | `youtube.ts:12` | ✅ Implemented |
| `POST /api/v1/youtube/oauth/callback` | `youtube.ts:40` | ✅ Implemented |
| `GET /api/v1/youtube/status` | `youtube.ts:84` | ✅ Implemented |
| `POST /api/v1/youtube/disconnect` | `youtube.ts:114` | ✅ Implemented |
| `GET /api/v1/admin/users` | `admin.ts:18` | ✅ Implemented |
| `GET /api/v1/admin/communities` | `admin.ts:66` | ✅ Implemented |
| `GET /api/v1/admin/reports` | `admin.ts:95` | ✅ Implemented |
| `POST /api/v1/admin/reports` | `admin.ts:210` | ✅ Implemented |
| `POST /api/v1/admin/reports/:id/resolve` | `admin.ts:168` | ✅ Implemented |
| `GET /api/v1/admin/metrics` | `admin.ts:169` | ✅ Implemented |
| `POST /api/v1/ai/chat` | `ai.ts:12` | ✅ Implemented |
| `GET /api/v1/ai/conversations` | `ai.ts:105` | ✅ Implemented |
| `GET /api/v1/ai/conversations/:id/messages` | `ai.ts:124` | ✅ Implemented |
| `DELETE /api/v1/ai/conversations/:id` | `ai.ts:156` | ✅ Implemented |
| `GET /api/v1/queue` | `feed.ts:32` | ✅ Implemented |
| `GET /api/v1/submissions` | `feed.ts:87` | ✅ Implemented |
| `GET /api/v1/activity` | `feed.ts:131` | ✅ Implemented |
| `GET /api/v1/users/me/profile` | `users.ts:69` | ✅ Implemented |
| `PUT /api/v1/users/me/profile` | `users.ts:117` | ✅ Implemented |
| `POST /api/v1/users/me/youtube-channel` | `users.ts:198` | ✅ Implemented |
| `GET /api/v1/users/me/member` | `users.ts:237` | ✅ Implemented |
| `GET /api/v1/users/me/youtube-channels` | `users.ts:318` | ✅ Implemented |

**No missing frontend-to-backend endpoint contracts were found.**

---

## 5. MISSING FRONTEND PAGES / ROUTES

| Expected Route | Status | Issue |
|----------------|--------|-------|
| `/settings` | ❌ Missing | Settings button exists but no settings page. |
| `/auth/signup` | ❌ Missing | Only signin page exists. Registration is handled by Firebase + `/api/v1/auth/register`. |
| `/forgot-password` | ❌ Missing | No password reset flow. |
| `/notifications` | ❌ Missing | Notifications are fetched but no dedicated page. |
| `/search` | ❌ Missing | Search UI exists but no results page. |
| `/communities/:id/members` | ❌ Missing | Community detail page exists but no member list. |
| `/videos/:id` | ❌ Missing | No video detail/watch page. Watch happens via queue. |
| `/reviews/:id` | ✅ Exists | Review detail page exists. |

---

## 6. TYPE SAFETY ISSUES

### 6.1 Backend `any` Usage

| File | Line | Issue |
|------|------|-------|
| `workers/api/src/routes/admin.ts` | 214 | `(await request.json().catch(() => ({}))) as any` |
| `workers/api/src/routes/communities.ts` | 129, 191, 305 | Same pattern, 3 occurrences |
| `workers/api/src/routes/missions.ts` | 58, 181 | Same pattern, 2 occurrences |
| `workers/api/src/routes/notifications.ts` | 65, 162 | Same pattern, 2 occurrences |
| `workers/api/src/routes/users.ts` | 121, 202 | Same pattern, 2 occurrences |
| `workers/api/src/routes/videos.ts` | 67, 215, 431, 494 | Same pattern, 4 occurrences |
| `workers/api/src/routes/ai.ts` | 16 | Same pattern |
| `workers/api/src/services/ai.ts` | 47, 50 | `as any` on JSON parse |
| `workers/api/src/services/firebase.ts` | 71, 113, 131 | `as any` on JWT payload parse |
| `workers/api/src/middleware/rateLimit.ts` | 30 | `(current as any).count` |
| `workers/api/src/index.ts` | 102-104 | `(request as any).__auth/env/ctx` |
| `workers/api/src/lib/database.ts` | Throughout | `params: any[]`, `any | null` return types |

### 6.2 Frontend `any` Usage

| File | Line | Issue |
|------|------|-------|
| `src/lib/api-client.ts` | 296, 319, 348, 355, 357 | `unknown[]` return types for videos, badges, metrics, users, reports |
| `src/hooks/use-api.ts` | 432 | `return [] as unknown as LeaderboardEntry[]` — double cast |
| `src/routeTree.gen.ts` | 33-108 | Generated file with `as any` casts (acceptable for generated code) |

### 6.3 Backend Type Gaps

| File | Line | Issue |
|------|------|-------|
| `workers/api/src/types/index.ts` | 119 | `details?: any[]` in `AdminMetrics` |
| `workers/api/src/services/user.ts` | 71 | `data: Record<string, any>` — no typed update payload |
| `workers/api/src/routes/videos.ts` | 348 | `let answers: any[] = []` — no typed answer structure |

---

## 7. INFRASTRUCTURE & DEPLOYMENT GAPS

### 7.1 CI/CD Pipeline

| File | Issue |
|------|-------|
| `.github/workflows/ci.yml` | Only runs lint and typecheck. **No tests run in CI.** |
| `.github/workflows/deploy.yml` | Deploys backend and frontend, but no smoke tests or health checks post-deploy. |

### 7.2 Testing

| File | Issue |
|------|-------|
| `workers/api/tests/` | Only 3 test files exist (logger, permissions, youtube). **No tests for:** routes, services, middleware, database. |
| Frontend | **No test files exist.** No unit tests, no component tests, no E2E tests. |

### 7.3 Monitoring & Observability

| File | Issue |
|------|-------|
| `workers/api/src/lib/logger.ts` | Logger exists but is **not used** in any route handler or service. All error logging is still via `console.error`. |
| `workers/api/wrangler.toml` | `[observability]` is enabled but no traces or metrics are emitted. |
| `src/lib/error-capture.ts` | Frontend error capture exists but is only used in `server.ts` for SSR errors. Client-side errors are not captured. |

### 7.4 Security Headers

| File | Issue |
|------|-------|
| `workers/api/src/middleware/errorHandler.ts` | Error responses don't include security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`). |
| `workers/api/src/index.ts` | No HSTS, no CSP, no `X-XSS-Protection` headers. |

### 7.5 Database Migrations

| File | Issue |
|------|-------|
| `workers/api/migrations/` | Only SQL files exist. No migration runner script, no down migrations, no version tracking beyond D1's built-in `[[migrations]]` tags. |

---

## 8. BUSINESS LOGIC GAPS

### 8.1 Gamification

| Issue | Location | Description |
|--------|----------|-------------|
| Hardcoded XP curve | `workers/api/src/routes/watch.ts:11` | `levelForXp()` uses fixed `250 XP per level`. No configurable curve. |
| Hardcoded rewards | `workers/api/src/routes/watch.ts:7-9` | `REQUIRED_WATCH_SEC = 180`, `REWARD_XP = 30`, `REWARD_CREDITS = 10` — all hardcoded. |
| No decay/staleness | `workers/api/src/routes/gamification.ts` | XP and streaks never decay. A user who joined once 6 months ago has the same streak as an active user. |
| No leaderboard pagination | `workers/api/src/routes/gamification.ts` | `GET /api/v1/leaderboards` returns all entries. No pagination for large datasets. |

### 8.2 Reputation System

| Issue | Location | Description |
|--------|----------|-------------|
| Reputation not calculated | `workers/api/src/routes/gamification.ts:91` | `GET /api/v1/reputation` endpoint exists but only returns raw DB values. No algorithmic reputation score calculation. |
| Reputation not displayed | Frontend | No UI component shows reputation score. Only XP and streaks are shown. |

### 8.3 Mission System

| Issue | Location | Description |
|--------|----------|-------------|
| No mission deadlines | `workers/api/src/routes/missions.ts` | Missions have no `end_date` or `deadline`. They never expire. |
| No mission limits | `workers/api/src/routes/missions.ts` | No limit on how many times a user can complete a mission. |
| No auto-assignment | `workers/api/src/routes/missions.ts` | Missions must be manually assigned. No auto-assignment based on user level/community. |

### 8.4 Review System

| Issue | Location | Description |
|--------|----------|-------------|
| No review deadlines | `workers/api/src/routes/videos.ts` | Reviews never expire or auto-assign. |
| No review quality control | `workers/api/src/routes/videos.ts` | Submitted review answers are not validated for quality or spam. |
| No review notifications | `workers/api/src/routes/notifications.ts` | Users are not notified when assigned a review. |

### 8.5 Community System

| Issue | Location | Description |
|--------|----------|-------------|
| No community moderation | `workers/api/src/routes/communities.ts` | Community creators have no special permissions. No moderation tools. |
| No community rules | `workers/api/src/routes/communities.ts` | Communities have no configurable rules or requirements. |
| No community analytics | `workers/api/src/routes/communities.ts` | No view counts, engagement metrics, or growth stats. |

---

## 9. MISSING ERROR STATES IN UI

### 9.1 Components Without Loading/Error States

| Component | File | Issue |
|-----------|------|-------|
| `Dashboard` | `src/routes/dashboard.tsx` | Added loading state, but no error state. If any query fails, the component shows loading forever or crashes. |
| `Profile` | `src/routes/profile.tsx` | No loading or error states at all. |
| `Communities` | `src/routes/communities.tsx` | No loading/error states for community list or join/create actions. |
| `Missions` | `src/routes/missions.tsx` | No loading/error states. |
| `Queue` | `src/routes/queue.tsx` | No loading/error states for watch claim action. |
| `Reviews` | `src/routes/reviews.tsx` | No loading/error states for review submission. |
| `AI Chat` | `src/routes/ai.tsx` | Has loading and error states, but error state only shows `error` variable without retry button. |

---

## 10. ADDITIONAL GAPS

### 10.1 Dev Auth Still Present

| File | Issue |
|------|-------|
| `src/lib/dev-auth.ts` | Dev authentication bypass still exists in the codebase. It checks `import.meta.env.DEV` and `VITE_USE_DEV_AUTH`. If environment variables are misconfigured, dev auth could be enabled in production. |
| `src/hooks/useAuth.tsx` | Dev profile fetch fallback still present. |

### 10.2 Hardcoded Branding

| File | Issue |
|------|-------|
| Multiple `src/routes/*.tsx` | "LoopSquad" brand name is hardcoded throughout. No configurable branding. |
| `workers/api/src/services/ai.ts` | AI system prompt hardcodes "LoopSquad" brand. |

### 10.3 Missing Rate Limit Configurability

| File | Issue |
|------|-------|
| `workers/api/src/middleware/rateLimit.ts` | Rate limits are hardcoded constants (`RATE_LIMIT_MAX_REQUESTS = 100`, `AUTH_RATE_LIMIT_MAX_REQUESTS = 5`). Not configurable per environment or endpoint. |

### 10.4 No Pagination

| File | Issue |
|------|-------|
| `workers/api/src/routes/feed.ts` | Queue, submissions, and activity endpoints return all records. No pagination. |
| `workers/api/src/routes/gamification.ts` | Leaderboards returns all entries. No pagination. |
| `workers/api/src/routes/notifications.ts` | Has `limit` parameter but no `offset`/`cursor` for pagination. |
| Frontend | No infinite scroll or pagination UI components. |

### 10.5 No Input Sanitization

| File | Issue |
|------|-------|
| `workers/api/src/routes/communities.ts` | User-generated content (community names, descriptions) is not sanitized for XSS. |
| `workers/api/src/routes/videos.ts` | Video titles and descriptions from YouTube are not sanitized before storage/display. |
| `workers/api/src/routes/notifications.ts` | Notification messages are not sanitized. |

---

## 11. PRIORITIZED REMEDIATION PLAN

### Phase 1: Critical (Fix Before Production)

1. **Remove all dev fallbacks in production paths**
   - `videos.ts`: Remove synthetic metadata fallback
   - `ai.ts`: Remove placeholder API key bypass
   - `firebase.ts`: Remove development-only token acceptance
   - `profile.tsx`: Remove hardcoded `xpPct = 62`
   - All `currentUser ?? { ... }` fallbacks: show proper loading/error states

2. **Add error states to all hooks and components**
   - Replace silent `return []` with proper error states
   - Add `isError` and `error` handling in UI
   - Show retry buttons where appropriate

3. **Fix YouTube watch time verification**
   - Implement `getWatchTime()` call in watch route
   - Validate actual watch time against YouTube Analytics API

4. **Remove or disable dev auth in production**
   - Add strict production environment validation
   - Remove `dev-auth.ts` from production bundle

### Phase 2: High (Fix in Sprint 1)

5. **Implement settings page**
   - Replace dead Settings button with working page
   - Add notification preferences UI
   - Add YouTube connection management (already wired)

6. **Add pagination to all list endpoints**
   - Queue, submissions, activity, leaderboards, notifications, reviews

7. **Implement notification delivery**
   - Email notifications (using Firebase Cloud Functions or similar)
   - In-app notification badges with unread count
   - Real-time updates via WebSocket or polling

8. **Add frontend permission checks**
   - Hide admin link unless user has admin role
   - Add permission guards to protected routes

9. **Implement search**
   - Backend search endpoint for communities/videos
   - Frontend search results page

### Phase 3: Medium (Fix in Sprint 2-3)

10. **Add comprehensive tests**
    - Backend: route tests, service tests, integration tests
    - Frontend: component tests, hook tests, E2E tests

11. **Add structured logging**
    - Replace all `console.error` with `Logger` class
    - Add request correlation IDs
    - Add log levels

12. **Add security headers**
    - CSP, HSTS, X-Frame-Options, X-Content-Type-Options

13. **Add monitoring**
    - Sentry or similar for error tracking
    - Performance monitoring
    - Uptime checks

14. **Add database migration tooling**
    - Down migrations
    - Migration status tracking
    - Rollback procedures

15. **Make constants configurable**
    - Move `REQUIRED_WATCH_SEC`, `REWARD_XP`, rate limits to environment/config
    - Make XP curve configurable

---

## 12. SUMMARY TABLE

| Category | Count | Severity |
|----------|-------|----------|
| Hardcoded fallback data | 8 | HIGH |
| Silent error handling (empty returns) | 14 hooks + backend | HIGH |
| Missing frontend pages | 6 routes | MEDIUM |
| Incomplete backend features | 5 features | HIGH |
| Type safety issues (`any` casts) | 20+ occurrences | MEDIUM |
| Missing tests | Entire frontend + most backend | HIGH |
| Missing monitoring/observability | Logger unused, no Sentry | MEDIUM |
| Missing pagination | 6 endpoints | MEDIUM |
| Missing security headers | All responses | MEDIUM |
| Hardcoded branding | 15+ files | LOW |
| Dev auth in codebase | 2 files | HIGH |
| No input sanitization | 4 endpoints | MEDIUM |

---

## 13. FILES EXAMINED

**Total files audited:** ~120 source files
**Excluded:** `node_modules`, `.output`, `.wrangler`, `workers/api/node_modules`

### Frontend
- `src/routes/*.tsx` (all route components)
- `src/hooks/*.tsx` (all hooks)
- `src/lib/*.ts` (all libraries)
- `src/components/**/*.tsx` (all components)
- `src/router.tsx`, `src/routeTree.gen.ts`, `src/server.ts`, `src/start.ts`

### Backend
- `workers/api/src/index.ts`
- `workers/api/src/routes/*.ts` (all routes)
- `workers/api/src/services/*.ts` (all services)
- `workers/api/src/middleware/*.ts` (all middleware)
- `workers/api/src/lib/*.ts` (all lib files)
- `workers/api/src/types/index.ts`
- `workers/api/wrangler.toml`
- `workers/api/migrations/*.sql`

### Config
- `package.json` (root + workers/api)
- `tsconfig.json` (root + workers/api)
- `vite.config.ts`
- `eslint.config.js`
- `.github/workflows/*.yml`
