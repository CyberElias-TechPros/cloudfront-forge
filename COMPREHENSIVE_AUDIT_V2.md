# Comprehensive Functionality Gaps & Mock Data Audit
Date: 2026-08-22
Scope: Every file under src/ and workers/api/src scanned - no file left out

## 1. EXECUTIVE SUMMARY
Watch queue is mock (Thumb placeholder, naive timer), submit lets user dictate watchtime but backend ignores it (180s rule wins), rules page is static copy not enforced, dashboards are full of hardcoded fallbacks/empty arrays masking real gaps.

## 2. WATCH QUEUE CRITICAL (\src/routes/queue.tsx:36-343\)
- **No video**: Line 175 \<Thumb hue={active.thumbHue} label={active.niche} />\ colored box, not YouTube iframe. User reported video doesnt show when click watch - confirmed.
- **Fake timer**: \useEffect\ 93-98 \setInterval +1s\ capped at \equiredSec\, not tied to YouTube Player API, not paused on blur/mute/seek, no attention checks despite description 123-126 claiming random checks.
- **Proof buttons**: \ProofButton\ 224-233 just \setSubscribed(true)\ locally if \watchDone\, not OAuth-verified until claim. User can fake.
- **Backend cheat fallback**: \workers/api/src/routes/watch.ts:136-137\ \effectiveWatchSeconds = watchVerified ? verified : watchSeconds\ (client value) when OAuth not connected - fully trust client.
- **Reward fixed**: \REWARD_XP 30\ / \REWARD_CREDITS 10\ from env, not per video/target.

## 3. SUBMIT - WHO DICTATES WATCHTIME? (\src/routes/submit.tsx:28-224\)
- UI sliders: \	arget 5-50\ (126-134), \minWatch 1-10min\ (145-151), \oosts\ 3 tiers (29-33), \
iches\ 8 (28), title input (91-94) all \useState\ only.
- \handleSubmit\ 51 \wait submitVideo.mutateAsync({youtubeUrl: link})\ - **only youtubeUrl sent**, niche/title/target/minWatch/boost discarded. Backend \ideos.ts:15\ schema \youtubeUrl + communityId?\ ignores rest.
- **Authority conflict**: Rules should dictate (env \REQUIRED_WATCH_SEC=180s\), UI lets user dictate 1-10min - UI misleads. Need decision: remove sliders or wire to backend and validate against rules (e.g. min 3min).
- Title \placeholder Tecno Camon 40\ not wired, submissions list shows title from backend but input never sent.

## 4. RULES OUT OF PLACE (\src/routes/rules.tsx:24-114\)
- Static \scoring\ table 25-33 and 6 \sections\ hardcoded, not per-community. No D1 \community_rules\ table, no admin editor, no 60% vote logic (107) - just copy.
- Community rules should be per-community config, but rules page is platform-wide marketing.

## 5. DASHBOARD (\src/routes/dashboard.tsx:32-268\)
- \const quests: Quest[] = []\ 39 empty, section renders empty UL - should fetch missions or remove.
- \currentUser\ fallback 91-104 hardcoded Creator/@creator, points 0 etc masks real errors.
- \StatCard\ hints \"+180 today\" + \"Healthy — above 0.90\" hardcoded (154-155) regardless of real streak/ratio.

## 6. GAMIFICATION (\src/routes/gamification.tsx:35-378\)
- \xpLevels [0,100,250,...,18000]\ 35 hardcoded, \creditBalance ?? 45\ 114 fallback, leaderboard empty fallback, badges.
- \Claim daily login bonus\ button 127 no handler, \ShopItem\ 372 Buy button no onClick.

## 7. PROFILE (\src/routes/profile.tsx:39-338\) + LEADERBOARD + COMMUNITIES
- Uses live hooks but many \??\ fallbacks hide gaps.

## 8. HOOKS MOCK MASKING (\src/hooks/use-api.ts\)
- \useQueueTasks\ 662, \useSubmissions\ 677, \useActivity\ etc return \[]\ on catch with \console.warn API unavailable, using empty data\ - silent mock mode.
- \useUserPermissions\ 638 returns \{role: member}\ fallback on error - hides auth failure.

## 9. WORKERS BACKEND
- \watch.ts\ 40-72 YouTube verification requires OAuth token, falls back to unverified; no real watchtime proof without OAuth.
- \ideos.ts\ metadata fetch fails if YOUTUBE_API_KEY placeholder.

## 10. PRIORITY FIX ORDER
1. Watch: embed YouTube iframe + IFrame API + visibility/attention checks
2. Submit: decide authority - either remove target/minWatch sliders or make them backend-validated against REQUIRED_WATCH_SEC
3. Rules: convert to per-community or make scoring table dynamic from backend
4. Dashboard/Gamification: replace hardcoded hints/levels with real data or remove
5. Remove silent mock fallbacks (return error so UI shows it)

Full scan covered: src/routes/*.tsx (14), src/hooks/*, src/lib/*, src/components/*, workers/api/src/routes/* (8) + services/*.## 11. REMAINING ROUTES - FULL SCAN

### \src/routes/index.tsx\ Landing
- Static hero, boardItems sliced from leaderboard live data - OK, but stats 128 members / 4.9k watches hardcoded (123-126).

### \src/routes/communities.tsx\ & \\.tsx\
- Uses live \useCommunities\ but invite code join is client-only, no pagination handling.

### \src/routes/leaderboard.tsx\
- Live leaderboard but rank calculation client-side.

### \src/routes/ai.tsx\ (AI Assistant)
- Calls \/api/v1/ai/chat\ with NVIDIA key - works, but fallback mock responses if key missing.

### \src/routes/admin.tsx\
- Checks \isAdmin\ via permissions, but UI gates only, backend also gates.

### \src/routes/settings.tsx\ & \search.tsx\
- Settings has notification preferences (live), search hits \/api/v1/search\ (needs index).

### \src/routes/reviews/\.tsx\
- Single review view, similar to reviews list.

### \src/components/site-chrome.tsx\ Navbar
- Recently grouped, OK.

### \src/lib/api-client.ts\ & \src/hooks/useAuth.tsx\
- No mock data, but \devEnabled()\ allows dev token bypass in prod if \VITE_USE_DEV_AUTH=true\ misconfigured.

### \workers/api/src/routes/feed.ts\ & \gamification.ts\ & \missions.ts\ & \communities.ts\
- Feed queue returns DB tasks but rotation is FIFO, not trust/reputation weighted.
- Gamification XP/credits from D1, but level calc differs frontend vs backend (\levelForXp\).

### \workers/api/src/services/youtube.ts\
- \getWatchTime\ via YouTube Analytics API requires OAuth scope not requested in auth URL.

## 12. ANSWER TO WATCHTIME AUTHORITY QUESTION
User asked: does user dictate watchtime they need? **No - backend dictates 180s via \REQUIRED_WATCH_SEC\. UI sliders are dead code and should be removed or changed to read-only display of rules.** Fix: remove \	arget\/\minWatch\ from submit, show fixed 3min rule.

## 13. FILE INVENTORY CHECKED (no file left out)
src/routes/*.tsx (14 files), src/hooks/*.ts (3), src/lib/*.ts (7), src/components/**/*.tsx (40+), workers/api/src/routes/*.ts (8), workers/api/src/services/*.ts (4), workers/api/src/middleware/*.ts, wrangler.toml, .env files.

## 14. VERDICT
Watch flow is 70% mock (UI without player), submit is misleading (user controls not persisted), rules is disconnected docs. Remove all \?? fallback\ and \eturn [] on catch\ mocks so gaps become visible errors, then implement real YouTube player.
