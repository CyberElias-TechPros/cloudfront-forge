# Code Analysis Report: CloudFront Forge / CreatorLoop

**Generated:** 2026-08-16 (Updated: 2026-08-16 post-audit fixes)
**Project:** CreatorLoop (YouTube Creator Accountability Platform)
**Stack:** React/TypeScript (TanStack Start) + Cloudflare Workers + Firebase + D1 SQLite

---

## EXECUTIVE SUMMARY

This project has **HIGH PRIORITY SECURITY ISSUES** and **SIGNIFICANT INCOMPLETE IMPLEMENTATIONS**. Critical credentials are exposed in configuration files, core features are unfinished, and error handling is inconsistent across the codebase. The application is **not production-ready**.

**Risk Level: CRITICAL** ⚠️

**Progress Since Initial Audit (2026-08-16):** Several fixes applied - mock data removed, auth session persistence improved, YouTube API key configured, NVIDIA API key configured, Cloudflare proxy conflict resolved. However, **core security vulnerabilities remain unaddressed**.

---

## 1. SECURITY VULNERABILITIES

### 1.1 CRITICAL: Exposed API Keys in Source Code (STILL EXPOSED)

**Files:**

- `workers/api/wrangler.toml` (Lines 11-12)
- `src/lib/firebase.ts` (Lines 11-17 - fallback values)

**Current State (UPDATED):**

```toml
# wrangler.toml - Lines 11-12 - STILL EXPOSED
AI_API_KEY = "-xOdO9fmfj8oUQx2Fhi7r2YmlHvABJ_OHTGPs5elUGuQ3_atoar8Mg0xqWt77BMv0"
YOUTUBE_API_KEY = "-nyZ_zvsKGd79uE_688rq7Lx95iIZo"
```

**Issues Still Present:**

- NVIDIA AI API key hardcoded in `wrangler.toml` (should be Cloudflare Secret)
- YouTube Data API key hardcoded in `wrangler.toml` (should be Cloudflare Secret)
- Firebase API keys as fallback values in `firebase.ts` (Lines 11-17)
- Cloudflare account ID visible in `wrangler.toml`

**Impact:**

- Public keys discoverable in Git history
- Account takeover risk
- Malicious API abuse & quota exhaustion
- Violates security best practices

**Recommendation (PRIORITY 1):**

- Move ALL secrets to Cloudflare Workers Secrets Store: `wrangler secret put AI_API_KEY`
- Remove all hardcoded credentials from `wrangler.toml`
- Use environment-specific configs (`.dev.vars`, `.prod.vars`)
- Rotate all exposed credentials immediately
- Add `.wrangler` to `.gitignore`

---

### 1.2 CRITICAL: CORS Misconfiguration (STILL VULNERABLE)

**File:** `workers/api/src/index.ts` (Lines 23-26)

**Current State (UNCHANGED):**

```typescript
const headers = new Headers({
  "Access-Control-Allow-Origin": "*", // ← INSECURE - STILL WILDCARD
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
});
```

**Impact:**

- Any origin can make requests to the API
- Enables CSRF attacks
- Credential stuffing attacks possible
- No cross-origin protection for authenticated endpoints

**Recommendation (PRIORITY 1):**

- Whitelist specific frontend domains: `https://loop.freegameplay.site`, `https://cloudfront-forge.vercel.app`
- Implement environment-specific CORS policies
- Add `Access-Control-Allow-Credentials: true` for authenticated routes
- Implement `Vary: Origin` header

---

### 1.3 HIGH: Insufficient Input Validation (STILL PRESENT)

**Files:**

- `workers/api/src/routes/auth.ts` (Lines 16-24)
- `workers/api/src/routes/watch.ts` (Full file)
- All route files using `as any` for body parsing

**Current State (UNCHANGED):**

```typescript
// auth.ts - minimal validation pattern repeated everywhere
const body = (await request.json().catch(() => ({}))) as any; // ← No schema validation
const { firebaseUid, email, displayName, photoUrl } = body;
```

**Issues Still Present:**

- 20+ route files use `as any` for body parsing before Zod validation
- No sanitization of user inputs before validation
- YouTube verification endpoint incomplete with placeholder implementations
- No request size limits

**Recommendation (PRIORITY 2):**

- Use Zod validation on ALL endpoints BEFORE any processing
- Implement consistent input validation middleware
- Add request size limits
- Add XSS/CSRF protection headers

---

### 1.4 HIGH: Weak Authentication Fallback (PARTIALLY MITIGATED)

**File:** `src/lib/dev-auth.ts` / `workers/api/src/services/firebase.ts`

**Current State (PARTIALLY MITIGATED):**

- Dev tokens properly gated by `import.meta.env.DEV` and `VITE_USE_DEV_AUTH`
- `verifyDevToken` only executes when `env.ENVIRONMENT === "development"` (Line 67)
- Production `ENVIRONMENT = "production"` in `wrangler.toml` - dev tokens rejected in prod

**Remaining Concern:**

- Dev token fallback could be bypassed if `VITE_USE_DEV_AUTH` is accidentally set
- No rate limiting on dev token generation
- No expiry on dev tokens

**Recommendation (PRIORITY 2):**

- Add token expiry to dev sessions
- Implement dev-mode detection that cannot be bypassed
- Log security warnings when dev mode detected

---

### 1.5 MEDIUM: Rate Limiting Implementation (IMPLEMENTED - NEEDS HARDENING)

**File:** `workers/api/src/middleware/rateLimit.ts` (Implemented)

**Current State (IMPLEMENTED):**

```typescript
// src/middleware/rateLimit.ts - IMPLEMENTED
const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX_REQUESTS = 100;
```

**Current Implementation:**

- Uses Cloudflare KV for storage
- 60-second window, 100 requests max per IP
- Properly extracts client IP from `cf-connecting-ip` and `x-forwarded-for`
- Graceful fallback on error (allows request through)

**Remaining Concerns:**

- No per-user rate limits (only per-IP)
- No differentiation between authenticated/unauthenticated limits
- No stricter limits on auth endpoints
- Fallback allows request through on error (fail-open)

**Recommendation (PRIORITY 3):**

- Add per-user rate limits for authenticated requests
- Stricter limits on auth endpoints (5 req/min)
- Implement fail-closed on KV errors for critical endpoints
- Add rate limit headers to responses

---

### 1.6 NEW FINDING: Insecure Default in Rate Limiter (FAIL-OPEN)

**File:** `workers/api/src/middleware/rateLimit.ts` (Line 30)

**Issue:**

```typescript
} catch (error) {
  console.error("Rate limit error:", error);
  return true;  // ← FAIL-OPEN: Allows request through on KV failure
}
```

**Impact:**

- KV errors (network issues, quota exceeded) bypass rate limiting
- Attackers could trigger KV errors to bypass limits

**Recommendation:** Implement fail-closed for critical endpoints (auth, write operations)

---

## 2. INCOMPLETE FEATURES

### 2.1 CRITICAL: YouTube Verification NOT IMPLEMENTED (STILL PLACEHOLDER)

**File:** `workers/api/src/routes/watch.ts` (Lines 32-60)

**Current State (STILL PLACEHOLDER):**

```typescript
async function verifyYouTubeSubscription(
  db: Database,
  watcherId: string,
  videoChannelId: string,
  env: Env,
): Promise<{ subscribed: boolean; reason: string }> {
  const apiKey = env.YOUTUBE_API_KEY;
  if (!apiKey || apiKey === "placeholder") {
    return { subscribed: true, reason: "YouTube API not configured - subs flag accepted" };
  }
  // Only checks subscriber count, NOT actual subscription status
  // TODO: Implement proper OAuth 2.0 flow for subscription verification
}
```

**Current Implementation:**

- Key now configured in `wrangler.toml` (YOUTUBE_API_KEY set)
- Only fetches subscriber count, NOT actual subscription status
- Returns `subscribed: true` if channel has subscribers (incorrect logic)
- **NO actual YouTube subscription verification** - anyone can claim subscribed

**Impact:**

- ANY user can claim subscriptions without verification
- Core gamification system is broken
- Defeats anti-cheat purpose
- Users can game the system for points

**Recommendation (PRIORITY 1 - CRITICAL):**

- Implement YouTube OAuth 2.0 flow for subscription verification
- Use YouTube Data API v3 `subscriptions.list` with `mySubscribers=true`
- Implement YouTube OAuth 2.0 flow for user channel linking
- Add subscription verification with proper error handling
- Add audit logging for verification attempts

---

### 2.2 HIGH: User Permissions Not Implemented (STILL MISSING)

**File:** `workers/api/src/routes/auth.ts` (Line 105)

**Current State (UNCHANGED):**

```typescript
// TODO: fetch user permissions from database
```

**Problem:**

- Admin/moderator features have no permission checks
- All authenticated users might have admin access
- No role-based access control (RBAC)

**Recommendation (PRIORITY 2):**

- Implement permission system with roles (admin, moderator, user)
- Add role definitions in database
- Validate permissions on all protected endpoints
- Implement middleware for permission checks

---

### 2.3 HIGH: Profile Initialization Race Condition (PARTIALLY MITIGATED)

**File:** `src/hooks/useAuth.tsx` (Line 59)

**Current State (PARTIALLY MITIGATED):**

```typescript
// Race condition workaround STILL PRESENT
await new Promise((r) => setTimeout(r, 200)); // ← HACK: Race condition workaround
await fetchProfile(user).catch((e) => console.error("Profile fetch failed:", e));
```

**Mitigations Applied:**

- Added `useEffect` with token refresh interval (Lines 135-149)
- Added `auth.currentUser` null check before `getIdToken()`

**Remaining Issue:**

- 200ms arbitrary timeout still present
- Root cause of race condition not fixed
- Silent error handling in `fetchProfile`

**Recommendation (PRIORITY 3):**

- Fix root cause of race condition (use `onAuthStateChanged` promise)
- Implement proper async coordination with `await`
- Add proper error reporting to user

---

## 3. ERROR HANDLING ISSUES

### 3.1 HIGH: Inconsistent Error Responses (STILL PRESENT)

**Files:**

- `src/lib/api.ts` (Lines 18-33)
- `workers/api/src/routes/*`

**Current State (UNCHANGED):**

```typescript
// api.ts - assumes nested data structure without validation
const response = await apiClient.post(url, data);
return response.data.data as T; // ← No validation that data.data exists
```

**Issue:**

- Frontend assumes `response.data.data` structure without validation
- Backend uses different error formats across routes
- Silent error catching without user notification in hooks

**Recommendation (PRIORITY 2):**

- Standardize all API responses with consistent structure
- Implement response validation with Zod
- Add proper error logging and user feedback

---

### 3.2 MEDIUM: Silent Error Handling in Hooks (STILL PRESENT)

**File:** `src/hooks/use-api.ts` (Lines 85-93, 586-589)

**Current State (UNCHANGED):**

```typescript
try {
  const data = await apiClientService.communities.list();
  return data.map(mapCommunity);
} catch (error) {
  console.warn("[useCommunities] API unavailable:", error);
  return []; // ← Silently returns empty array
}
```

**Impact:**

- Users don't know if data failed to load
- No distinction between empty and error states
- Poor UX - no retry mechanism

**Recommendation (PRIORITY 3):**

- Implement error states in query hooks
- Show error messages to users
- Provide retry mechanisms

---

### 3.3 MEDIUM: Navigation on Auth Failure (STILL PRESENT)

**File:** `src/routes/auth/signin.tsx` (Line 38)

**Current State (UNCHANGED):**

```typescript
await api.post("/api/v1/auth/register", {...});
navigate({ to: "/dashboard" });  // ← Navigates even if above fails?
```

**Problem:**

- Unclear error flow
- Could navigate to dashboard without successful registration

---

## 4. DATABASE & SCHEMA ISSUES

### 4.1 HIGH: No Database Transaction Support (STILL MISSING)

**Files:** All in `workers/api/src/routes/`

**Current State (UNCHANGED):**

```typescript
// watch.ts - Multiple DB calls WITHOUT transaction
await ensureReputation(db, userId, now);
await db.execute("INSERT INTO watch_sessions...");
await db.execute("UPDATE users SET..."); // Could fail after reputation created
```

**Issues:**

- Multi-step operations have NO transaction handling
- `watch.ts` performs multiple DB writes without atomicity
- `db.batch()` exists but NOT USED in `watch.ts` for multi-step operations
- Race conditions possible in concurrent operations
- No rollback mechanism

**Recommendation (PRIORITY 2):**

- Use `db.batch()` for all multi-step operations
- Implement ACID compliance verification
- Handle concurrent operations safely

---

### 4.2 MEDIUM: Soft Delete Strategy Unclear (STILL UNCLEAR)

**File:** `workers/api/migrations/001_initial_schema.sql`

**Issue:**

- Tables have `deleted_at` fields but no deletion policies documented
- Unclear if queries filter by `deleted_at`
- No cascading delete strategy

---

### 4.3 MEDIUM: No Schema Versioning (STILL UNCLEAR)

**File:** `workers/api/migrations/`

**Issue:**

- Migrations exist but no clear version tracking
- Down migrations not visible
- Rollback strategy unclear

---

## 5. CONFIGURATION & ENVIRONMENT ISSUES

### 5.1 HIGH: Secrets in Configuration Files (CRITICAL - UNRESOLVED)

**File:** `workers/api/wrangler.toml` (Lines 11-12)

**Current State (UNRESOLVED):**

```toml
AI_API_KEY = "-xOdO9fmfj8oUQx2Fhi7r2YmlHvABJ_OHTGPs5elUGuQ3_atoar8Mg0xqWt77BMv0"
YOUTUBE_API_KEY = "-nyZ_zvsKGd79uE_688rq7Lx95iIZo"
```

**Issue:** Real production API keys committed to version control

**Recommendation:** Move to Cloudflare Secrets Store immediately

---

### 5.2 HIGH: Missing Environment Documentation (STILL MISSING)

**Issue:**

- No `.env.example` file provided
- Environment variable requirements unclear
- Frontend and backend have different env var requirements

**Recommendation:** Create `.env.example` with all required vars

---

### 5.3 MEDIUM: No Environment Variable Validation (STILL PRESENT)

**Files:**

- `src/lib/firebase.ts`
- `src/lib/api.ts`

**Current State (UNCHANGED):**

```typescript
const apiUrl = import.meta.env["VITE_API_URL"] || "http://localhost:8787"; // Silent fallback
```

**Problem:** Silent fallbacks hide misconfiguration

---

### 5.4 MEDIUM: Database ID Hardcoded (STILL PRESENT)

**File:** `workers/api/wrangler.toml` (Line 22)

```toml
database_id = "263dfc51-32c0-4973-9e9e-e9c660ebced7"  # Hardcoded
```

---

## 6. FRONTEND ARCHITECTURE ISSUES

### 6.1 MEDIUM: useAuth Hook Export (RESOLVED - WAS CORRECT)

**File:** `src/hooks/useAuth.tsx` (Line 174)

**Status:** `useAuth` hook IS properly exported (Line 174). Report was incorrect.

### 6.2 MEDIUM: Query Keys Not Centralized (STILL PRESENT)

**File:** `src/hooks/use-api.ts` (Lines 23-42)

**Issue:** Query keys hardcoded in multiple places

### 6.3 MEDIUM: No Loading State Handling in Components (STILL PRESENT)

**File:** `src/routes/dashboard.tsx` (Lines 33-45)

**Issue:** No loading/error states shown during data fetch

---

## 7. TYPE SAFETY ISSUES

### 7.1 MEDIUM: Use of `any` Type (STILL PREVALENT)

**Files:** 20+ route files in `workers/api/src/routes/`

**Current State (UNCHANGED):**

```typescript
// Pattern repeated in 20+ route files
const body = (await request.json().catch(() => ({}))) as any;
const validation = someSchema.safeParse(body);
```

**Files Affected:**

- `src/middleware/rateLimit.ts` (Line 12)
- `src/routes/admin.ts` (Lines 137, 213)
- `src/routes/ai.ts` (Line 16)
- `src/routes/auth.ts` (Lines 19, 72)
- `src/routes/communities.ts` (Lines 129, 191, 305)
- `src/routes/missions.ts` (Lines 58, 180)
- `src/routes/notifications.ts` (Lines 65, 162)
- `src/routes/users.ts` (Lines 121, 202)
- `src/routes/videos.ts` (Lines 67, 215, 431, 494)
- `src/routes/watch.ts` (Line 85)

**Frontend:**

- `src/routes/dashboard.tsx` (Line 32): `const quests: any[] = [];`

**Recommendation:** Replace `any` with proper types, enable `noImplicitAny`

---

### 7.2 MEDIUM: Missing Type Definitions (STILL PRESENT)

**Files:** API routes lack response type definitions, database query results untyped

---

## 8. BUILD & DEPLOYMENT ISSUES

### 8.1 HIGH: No CI/CD Pipeline (STILL MISSING)

**Issue:** No GitHub Actions workflows, no automated tests, no deployment automation

### 8.2 MEDIUM: ESLint Warnings Suppressed (STILL PRESENT)

**File:** `tsconfig.json` (Lines 17-18)

```json
"noUnusedLocals": false,
"noUnusedParameters": false,
```

### 8.3 MEDIUM: No Build Verification (STILL MISSING)

- No health check on deployed endpoints
- No smoke tests post-deployment
- No monitoring setup documented

---

## 9. TESTING GAPS

### 9.1 HIGH: No Visible Tests (STILL MISSING)

**Files:** No test files in project root (only in node_modules)

---

## 10. DOCUMENTATION GAPS

### 10.1 HIGH: No API Documentation (STILL MISSING)

- No OpenAPI/Swagger docs
- No endpoint documentation
- No request/response schemas

### 10.2 HIGH: No Setup/Deployment Guide (STILL MISSING)

- No `SETUP.md` or `DEPLOY.md`
- No `.env.example` file

### 10.3 MEDIUM: No Architecture Documentation (STILL MISSING)

---

## 11. CODE QUALITY ISSUES

### 11.1 MEDIUM: Hardcoded Constants (STILL PRESENT)

**Files:**

- `src/routes/dashboard.tsx`: Hardcoded description strings
- `workers/api/src/routes/watch.ts`: `REQUIRED_WATCH_SEC = 180`

### 11.2 MEDIUM: No Logging Strategy (STILL PRESENT)

- Console.error/warn calls scattered
- No structured logging
- No log levels
- No correlation IDs

### 11.3 MEDIUM: API Client Timeout Fixed (STILL PRESENT)

**File:** `src/lib/api.ts` (Line 5)

```typescript
const apiClient = axios.create({
  baseURL: apiUrl,
  timeout: 30000, // Fixed 30s timeout
});
```

---

## 12. SPECIFIC FEATURE GAPS

### 12.1 MISSING: Proper OAuth Integration (STILL MISSING)

- YouTube OAuth mentioned but not implemented
- No OAuth callback handlers
- No token refresh logic

### 12.2 MISSING: Notification System (STILL MISSING)

- `queryKeys.notifications` defined but no hook implementation

### 12.3 MISSING: Admin Panel Features (STILL MISSING)

- Admin endpoints exist but no UI components
- Permission system incomplete

---

## 13. PERFORMANCE CONCERNS

### 13.1 MEDIUM: No Query Optimization (STILL PRESENT)

- `use-api.ts`: Using basic React Query without optimization
- No visible database indexes
- No pagination on large queries

### 13.2 MEDIUM: No Lazy Loading (STILL PRESENT)

- No code splitting visible
- No route-based lazy loading

---

## 14. SECURITY BEST PRACTICES NOT FOLLOWED

### 14.1 No HTTPS Enforcement (STILL MISSING)

- No mention of HTTPS redirect
- No HSTS headers visible

### 14.2 No Content Security Policy (STILL MISSING)

- No CSP headers visible
- No script hash validation

### 14.3 No OWASP Top 10 Compliance (STILL MISSING)

- Missing many standard security headers
- No penetration test results

---

## SUMMARY TABLE (UPDATED)

| Category       | Issue                             | Severity | Status                   |
| -------------- | --------------------------------- | -------- | ------------------------ |
| Security       | Exposed API Keys in wrangler.toml | CRITICAL | ❌ UNFIXED               |
| Security       | CORS Misconfiguration (*)         | CRITICAL | ❌ UNFIXED               |
| Security       | Input Validation (as any pattern) | HIGH     | ❌ UNFIXED               |
| Feature        | YouTube Verification              | CRITICAL | ❌ UNFIXED (placeholder) |
| Feature        | User Permissions                  | HIGH     | ❌ UNFIXED               |
| Error Handling | Inconsistent Responses            | HIGH     | ❌ UNFIXED               |
| Config         | Secrets in wrangler.toml          | CRITICAL | ❌ UNFIXED               |
| Testing        | No Tests                          | HIGH     | ❌ UNFIXED               |
| Docs           | No Setup Guide                    | HIGH     | ❌ UNFIXED               |
| Docs           | No API Docs                       | HIGH     | ❌ UNFIXED               |
| Database       | No Transactions                   | HIGH     | ❌ UNFIXED               |
| Security       | Rate Limiter Fail-Open            | MEDIUM   | ❌ NEW                   |
| Security       | Dev Token Fallback                | HIGH     | ⚠️ PARTIAL               |
| Auth           | Race Condition Hack               | HIGH     | ⚠️ PARTIAL               |
| Type Safety    | Use of `any`                      | MEDIUM   | ❌ UNFIXED               |
| Architecture   | No CI/CD                          | MEDIUM   | ❌ UNFIXED               |
| Performance    | No Query Optimization             | MEDIUM   | ❌ UNFIXED               |
| Feature        | YouTube Verification              | CRITICAL | ❌ PLACEHOLDER           |
| Feature        | User Permissions                  | HIGH     | ❌ MISSING               |
| Feature        | OAuth Integration                 | HIGH     | ❌ MISSING               |
| Database       | No Transactions                   | HIGH     | ❌ MISSING               |

---

## RECOMMENDED PRIORITY FIXES (UPDATED)

### Phase 1: CRITICAL (Week 1) - SECURITY BLOCKERS

1. **Move ALL secrets to Cloudflare Secrets** - Remove keys from wrangler.toml
2. **Fix CORS** - Implement domain whitelist (loop.freegameplay.site, cloudfront-forge.vercel.app)
3. **Implement YouTube verification** - Core feature blocker, currently placeholder
4. **Add input validation** - Replace all `as any` with Zod-first parsing

### Phase 2: HIGH (Week 2-3) - FUNCTIONALITY & DATA INTEGRITY

5. **Implement permission system** - Required for multi-user safety
6. **Standardize error handling** - Improve reliability
7. **Add environment validation** - Prevent misconfiguration
8. **Implement database transactions** - Data integrity (use db.batch)
9. **Implement YouTube OAuth verification** - Core feature

### Phase 3: MEDIUM (Week 4+) - QUALITY & OPERATIONS

10. **Fix rate limiter fail-open** - Fail-closed for critical endpoints
11. **Remove hardcoded credentials** - Use secrets management
12. **Standardize error handling** - Improve reliability
13. **Add environment validation** - Prevent misconfiguration
14. **Implement structured logging** - Observability
15. **Create comprehensive tests** - Quality assurance
16. **Write documentation** - Maintainability
17. **Set up CI/CD** - Deployment reliability
18. **Optimize queries** - Performance
19. **Security hardening** - Headers, CSP, HSTS
20. **Fix CORS** - Domain whitelist

---

## UPDATED CONCLUSION

**The application is STILL NOT production-ready.** While some frontend issues have been addressed (mock data removed, auth persistence improved), **critical security vulnerabilities remain unaddressed**:

1. **Secrets still in source control** (CRITICAL)
2. **CORS wide open** (CRITICAL)
3. **YouTube verification is a placeholder** (CRITICAL - core feature broken)
4. **No database transactions** (HIGH - data integrity risk)
5. **No tests, no CI/CD, no documentation** (HIGH)

The project shows good architectural foundation with TanStack Start and Cloudflare Workers, but requires **significant hardening and completion of core features** before production deployment.

**Estimated remediation time: 4-6 weeks** for MVP compliance (unchanged from initial assessment).

---

**Report Updated:** 2026-08-16 (Post-audit fixes review)
**Analysis Method:** Static code review + architecture analysis + runtime verification
**Confidence Level:** HIGH (based on comprehensive codebase inspection)

---

## APPENDIX: FIXES APPLIED SINCE INITIAL AUDIT

| Fix                              | File                       | Status                            |
| -------------------------------- | -------------------------- | --------------------------------- |
| Removed mock quest data          | `src/routes/dashboard.tsx` | ✅ DONE                           |
| Auth session persistence         | `src/hooks/useAuth.tsx`    | ✅ DONE (partial)                 |
| AI_API_KEY configured            | `wrangler.toml`            | ✅ DONE (but in file, not secret) |
| YOUTUBE_API_KEY configured       | `wrangler.toml`            | ✅ DONE (but in file, not secret) |
| Cloudflare proxy conflict        | Vercel/Cloudflare config   | ✅ DONE                           |
| YouTube verification placeholder | `watch.ts`                 | ⚠️ PLACEHOLDER                    |
| Custom domain SSL                | Vercel/Cloudflare          | ✅ DONE (proxy off)               |
| Dashboard mock data              | `dashboard.tsx`            | ✅ REMOVED                        |
