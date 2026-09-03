# LoopSquad — Complete App Reference
## Everything About This App: User Cases, Stories, Flows, Actions, Connections & Architecture

Generated: 2026-08-26

---

## Table of Contents

1. [What LoopSquad Is](#1-what-loopsquad-is)
2. [User Personas & Stories](#2-user-personas--stories)
3. [Complete User Flows](#3-complete-user-flows)
4. [Every Action A User Can Take](#4-every-action-a-user-can-take)
5. [All API Endpoints](#5-all-api-endpoints)
6. [Database Schema — All 40 Tables](#6-database-schema--all-40-tables)
7. [Authentication & Session Flow](#7-authentication--session-flow)
8. [Anti-Cheat & Trust System](#8-anti-cheat--trust-system)
9. [Gamification Economy](#9-gamification-economy)
10. [Community System](#10-community-system)
11. [Notification System](#11-notification-system)
12. [AI Assistant](#12-ai-assistant)
13. [Admin & Moderation](#13-admin--moderation)
14. [Cron Jobs & Background Sweeps](#14-cron-jobs--background-sweeps)
15. [External Integrations](#15-external-integrations)
16. [Frontend Architecture](#16-frontend-architecture)
17. [Backend Architecture](#17-backend-architecture)
18. [Deployment & Infrastructure](#18-deployment--infrastructure)
19. [All Rules & Enforcement](#19-all-rules--enforcement)
20. [Known Gaps & Future Work](#20-known-gaps--future-work)

---

## 1. What LoopSquad Is

**LoopSquad** is a gamified, cheat-proof follow-for-follow platform designed for WhatsApp creator groups. YouTube creators join communities, submit their videos, and other members watch them for verified time, subscribe to their channel, and leave genuine comments. In return, they earn points, credits, streaks, trust scores, and climb the leaderboard.

**Core promise:** Fair YouTube growth where nobody gets cheated. Every watch is verified. Every subscription is confirmed via YouTube API. Every comment is checked for a magic word. Attention checks prevent botting. Anomaly detection catches manipulation. Trust scores reflect genuine participation.

**Tagline:** "Grow together. Nobody gets cheated."

**Tech Stack:**
- Frontend: React 19 + TanStack Router/Start + Tailwind CSS + shadcn/ui
- Backend: Cloudflare Workers + D1 (SQLite) + KV + R2
- Auth: Firebase Auth (Google sign-in)
- AI: NVIDIA API (Llama 3.1 8B)
- Email: Resend
- Push: VAPID Web Push
- Hosting: Vercel (frontend) + Cloudflare (backend)
- PWA: Service worker, manifest, Android share-target

---

## 2. User Personas & Stories

### Persona 1: The New Creator (Rookie)
**Who:** A WhatsApp group member who just started their YouTube channel. Has <100 subscribers. Wants real engagement.

**Stories:**
- I sign in with Google and join my WhatsApp group's LoopSquad community
- I connect my YouTube channel so others can verify my subscriptions
- I submit my first video with a magic word for the comment keyword
- I watch 2 other creators' videos to build my give/take ratio
- I complete my daily quests (watch 2, review 1, submit 1)
- I earn my first XP, credits, and build a streak
- I see myself on the leaderboard climbing from the bottom

### Persona 2: The Active Creator (Rising)
**Who:** Regular contributor. Has 100-1000 subscribers. Participates daily. Cares about streaks and leaderboard position.

**Stories:**
- I check my dashboard every morning for queue tasks and quest progress
- I submit a video, set a magic word, and share it to WhatsApp
- I watch videos in the queue, verify subscriptions, leave comments with the magic word
- I pass attention checks during my watch sessions
- I claim my daily bonus with streak multiplier
- I purchase a video boost to get more visibility
- I purchase a streak freeze to protect my streak during busy days
- I complete missions for extra XP and credits
- I review assigned videos and give constructive feedback
- I rate helpful reviews from other creators
- I use the AI assistant to get growth tips
- I check my badges and aim for the next one

### Persona 3: The Veteran Creator
**Who:** Established creator. 1000+ subscribers. Community leader. High trust score.

**Stories:**
- I create a new community and share the invite code in my WhatsApp group
- I manage my community members and settings
- I mentor newer creators through the review system
- I maintain a high trust score through consistent genuine participation
- I appear in the "Veteran" cohort leaderboard
- I earn special badges for review streaks and community support

### Persona 4: The Admin/Moderator
**Who:** Platform administrator. Manages the entire LoopSquad ecosystem.

**Stories:**
- I monitor the admin dashboard for platform health metrics
- I review flagged content and resolve reports
- I handle appeals from users who were penalized
- I track cohort retention (W1/W4) to understand engagement
- I monitor the analytics funnel (submit → watch → claim conversion)
- I review the low-trust watchlist for potential bad actors
- I create missions and mission chains for the platform

### Persona 5: The Cheater/Abuser (Adversarial)
**Who:** Someone trying to game the system for points without genuine participation.

**Stories (blocked):**
- I try to watch my own video → BLOCKED (self-watch guard)
- I try to submit the same video twice → BLOCKED (duplicate check)
- I try to submit more than 1 video per 24h → BLOCKED (daily limit)
- I try to claim watch time without actually watching → BLOCKED (attention checks, session verification)
- I try to subscribe then immediately unsubscribe → DETECTED (re-verification sweep, trust penalty)
- I try to use multiple accounts → DETECTED (channel_id conflict detection)
- I try to watch at 2x speed → BLOCKED (playback rate guard >1.25x)
- I try to watch with tab hidden → BLOCKED (visibility tracking)
- I try to leave the same comment on multiple videos → DETECTED (comment-originality hashing)
- I try to inflate my watch time → DETECTED (anomaly scoring, 3σ flagging)
- I try to submit misleading content → BLOCKED (3 reports = auto-pull)

---

## 3. Complete User Flows

### Flow 1: First-Time User Onboarding
```
1. User visits loop.freegameplay.site
2. Sees landing page with tagline, stats, how-it-works steps
3. Clicks "Sign In with Google"
4. Firebase Google OAuth popup opens
5. User authorizes → Firebase creates/authenticates user
6. Frontend calls POST /api/v1/auth/register with Firebase UID
7. Backend creates user row in users table (or retrieves existing)
8. User redirected to /dashboard
9. Dashboard shows empty state: no points, no streak, no quests
10. User prompted to:
    a. Connect YouTube channel (/settings → YouTube OAuth)
    b. Join a community (/communities → join with invite code)
    c. Submit their first video (/submit)
    d. Start watching queue (/queue)
```

### Flow 2: YouTube Channel Connection
```
1. User goes to /settings or /profile
2. Clicks "Connect YouTube Channel"
3. Backend generates OAuth state UUID, stores in youtube_oauth_states (10min TTL)
4. User redirected to Google OAuth consent screen
5. Scope: youtube.readonly (read-only access)
6. User authorizes → Google redirects to /api/v1/youtube/oauth/callback
7. Backend exchanges code for access + refresh tokens
8. Backend saves tokens in youtube_oauth_tokens (upsert)
9. Backend fetches channel ID via channels?mine=true
10. Backend saves channel_id on oauth row + youtube_channels table
11. User redirected to /settings?youtube=connected
12. Settings shows "Connected: UC..." with disconnect option
```

### Flow 3: Video Submission
```
1. User goes to /submit
2. Pastes YouTube URL
3. Optional: enters title, magic word (comment keyword), selects niche
4. Clicks "Add to Queue"
5. Frontend sends POST /api/v1/videos { youtubeUrl, communityId?, title?, magicWord?, niche? }
6. Backend validates:
   a. YouTube URL format → extract video ID
   b. Duplicate check → reject if same youtube_video_id already active
   c. 24h limit → reject if user submitted within last 24h
   d. Ratio gate → reject if (given + watch_hours) / received < 0.80 (new users exempt if received=0)
   e. Multi-account check → reject if channel_id conflicts with another user
7. Backend fetches YouTube metadata (title, thumbnail, duration, channel) via Data API v3
   (cached in KV for 24h)
8. Backend inserts video row (status='active', give_take_ratio=1.0)
9. Backend auto-assigns up to 3 reviewers:
   a. Same community members preferred
   b. Least-recently-reviewed weighted
   c. Trust threshold filtered
10. Backend notifies reviewers (push + in-app)
11. Backend notifies community members (in-app)
12. Backend progresses daily quest (submit_video)
13. Backend tracks analytics event (video_submitted)
14. Returns video ID to frontend
15. Frontend shows success + WhatsApp share toast
```

### Flow 4: Watch & Claim (Core Loop)
```
1. User goes to /queue
2. Sees list of active videos from other users
3. Can filter by: community, status (All/Pending/In Progress/Verified/Expired)
4. Boosted videos appear first in queue
5. User clicks a video → YouTube IFrame player loads

6. WATCH SESSION STARTS:
   a. Frontend loads YouTube IFrame API
   b. Creates YT.Player with video ID
   c. Calls POST /api/v1/watch/start → receives HMAC-signed session token
   d. Timer starts counting (wall-clock fallback if YT API unavailable)
   e. Heartbeat every 30s: POST /api/v1/watch/heartbeat { token, playerTime }

7. ANTI-CHEAT GUARDS (continuous):
   a. Tab hidden → pause timer
   b. Playback rate > 1.25x → pause timer, halve credit at muted
   c. Player seeked backward → ignore
   d. Video paused → pause timer
   e. Window blur → pause timer

8. ATTENTION CHECK (at 40-70% of required watch time):
   a. Random threshold calculated once per session
   b. Frontend calls POST /api/v1/watch/challenge { videoId }
   c. Backend generates arithmetic question (e.g., "7 + 3 = ?")
   d. Stores SHA-256 hash of answer, TTL 120s
   e. Overlay appears: "Quick check: What is 7 + 3?"
   f. User has 2 attempts
   g. First-try correct: +1 trust score
   h. Failed twice: -5 trust score, session voided (attentionVoided=true)

9. USER ACTIONS DURING WATCH:
   a. Clicks "I subscribed" → opens YouTube channel in new tab → sets subscribed=true
   b. Clicks "I commented" → opens YouTube video in new tab → sets commented=true
   c. If magic word exists → hint banner shown: "Comment with: [magic word]"

10. CLAIM (after required seconds reached):
    a. Timer shows "Claim" button
    b. User clicks Claim
    c. Frontend sends POST /api/v1/watch { videoId, watchSeconds, subscribed, commented, sessionToken }
    d. Backend verifies:
       - Video exists and is active
       - Not own video (self-watch block)
       - Watch seconds >= required (180s or video length)
       - If YouTube connected: verify subscription via OAuth API
       - If YouTube connected: verify watch time via Analytics API
       - If magic word set: verify comment via commentThreads API + author-channel match
       - If attention check failed: block the watch component
    e. Tiered rewards — each step pays on its own (nothing is compulsory):
       - Watch     → +10 XP · +4 credits, +1 reputation, watch_minutes
       - Subscribe → +10 XP · +3 credits, subscriptions_given/received
       - Comment   → +10 XP · +3 credits
       - Full engagement (all three) → +30 XP · +10 credits total
       - Only the newly completed components are paid (idempotent, no double-pay)
       - Set watch_session status = 'verified' (watch done) → 'claimed' (all three)
       - Notify video owner (in-app) when the watch component is first paid
       - Progress daily quest (watch_videos)
       - Track analytics event (watch_claimed)
    f. Returns { status, claimable, xpAwarded, creditsAwarded, subReason }
```

### Flow 5: Peer Review
```
1. Video is submitted → up to 3 reviewers auto-assigned
2. Reviewer sees assignment in /reviews "Assigned" tab
3. Reviewer clicks "Start Review" → POST /api/v1/reviews/:id/start
   - Status changes to 'in_progress'
   - Video submitter notified
4. Reviewer watches the video (embedded player)
5. Reviewer answers questions:
   a. "Did the creator watch the full video and engage genuinely?" (Yes/No)
   b. "Was the subscribed confirmation and comment genuine?" (Yes/No)
   c. "Rate the overall quality and effort" (1-5 stars)
   d. "What actionable feedback would help?" (Free text, optional)
6. Reviewer clicks Submit → POST /api/v1/reviews/:id/complete
   - Backend calculates score (average of rating answers)
   - Awards XP + credits to reviewer
   - Updates video owner reputation
   - Progresses daily quest (give_reviews)
   - Tracks analytics event (review_completed)
7. Video owner sees feedback in /reviews "Completed" tab
8. Video owner can rate review as helpful → POST /api/v1/reviews/:id/helpful
   - +1 trust score to reviewer
```

### Flow 6: Community Management
```
1. CREATOR creates community:
   - POST /api/v1/communities { name, description, isPublic, maxMembers }
   - Auto-generates invite code (8-char alphanumeric)
   - Auto-generates slug
   - Creator becomes owner (role='owner')
   
2. MEMBER joins community:
   - Gets invite code (shared via WhatsApp)
   - POST /api/v1/communities/join { inviteCode }
   - Checks max members limit
   - Creates community_members row (role='member')
   
3. COMMUNITY-SCOPED CONTENT:
   - Queue filter: GET /api/v1/queue?communityId=X → shows only community members' videos
   - Community leaderboard: weekly rankings within community
   - Community notifications: member join/leave events
   
4. OWNER manages community:
   - PUT /api/v1/communities/:id/settings
   - Toggle: allowPeerReview, allowCollaboration, requireApproval
   - Set: defaultLanguage
   - View members with roles and trust scores
```

### Flow 7: Daily Engagement Cycle
```
MORNING:
1. User opens app → dashboard shows stat cards (points, streak, ratio, trust)
2. Checks today's quests: watch 2 videos, give 1 review, submit 1 video
3. Checks notifications for new review assignments, community updates

DURING DAY:
4. Watches 2 videos in queue → claims rewards → completes "watch" quest
5. Completes 1 review → claims rewards → completes "review" quest
6. Submits 1 video → completes "submit" quest
7. All 3 quests complete → bonus XP + credits auto-awarded

EVENING:
8. Claims daily bonus (5cr × streak multiplier)
9. Checks leaderboard position
10. Purchases boost or streak freeze if enough credits

EVERY 30 SECONDS (while watching):
11. Heartbeat sent to verify session is real

NIGHTLY (cron at midnight):
12. Streak check: if no claim in 48h → consume freeze or reset streak
13. Overdue missions: assignments older than 7 days → expired
14. Overdue reviews: reviews older than 48h → overdue
15. Anomaly scoring: flag accounts >3σ off cohort cadence
16. Badge awards: check thresholds and award badges
17. (Sundays) Weekly digest email sent
```

### Flow 8: Report & Moderation
```
1. USER flags content:
   - Clicks flag on queue task or profile
   - Selects reason: spam/inappropriate/harassment/cheating/misleading/other
   - Adds description (optional)
   - POST /api/v1/reports { reportedUserId, resourceType, resourceId, reason, description }
   
2. BACKEND processes:
   - Inserts report (status='pending')
   - Applies -10 trust penalty to reported user
   - Notifies all admins (push + in-app)
   - If resourceType=video AND reason=misleading:
     - Counts reports with same reason on same video
     - If count >= 3 → auto-set video status='removed'
   
3. ADMIN reviews:
   - Sees reports in /admin with status filters
   - Clicks "Penalise" or "Dismiss"
   - POST /api/v1/admin/reports/:id/resolve { status: resolved/dismissed, resolutionNotes? }
   
4. USER appeal (one-shot):
   - POST /api/v1/reports/:id/appeal { reason }
   - Only the reported user can appeal
   - Admin reviews appeal: POST /api/v1/admin/appeals/:id { status: accepted/rejected, note? }
   - If accepted → original report dismissed
```

### Flow 9: Gamification & Economy
```
CREDITS:
- Earn: up to +7 per watch claim (watch +4 · feedback +3; subscribe is trust-only), +daily bonus, +missions, +badge rewards
- Spend: Video boost (50cr), Streak freeze (30cr)
- Track: credit_accounts (balance) + credit_transactions (ledger)

XP (Experience Points):
- Earn: up to +20 per watch claim (watch +10 · feedback +10; subscribe is trust-only), +missions, +daily quests, +badge rewards
- Level up: formula floor(50 * level^2 * 0.8) XP per level
- Track: xp_accounts (total_xp, level) + xp_transactions (ledger)

REPUTATION (Trust Score):
- Start: 100
- Gain: +1 per verified claim, +1 per helpful review, +1 per attention check pass
- Lose: -5 per attention check fail, -10 per report filed against you, -2 per anomaly flag
- Track: reputation_accounts (score) + reputation_events (audit log)

STREAKS:
- Track: daily activity (watch claim within 48h)
- Freeze: consume one freeze instead of losing streak on break
- Reset: cron job checks every midnight

LEADERBOARD:
- Score formula: round(xp*0.4 + credits*0.3 + reputation*0.3)
- Filters: weekly/monthly/all-time, rookie/rising/veteran cohorts
- Display: rank, name, niche, points, watch minutes, subs given, streak, trust %
```

### Flow 10: AI Assistant
```
1. User goes to /ai
2. Types a question about growing their channel
3. Frontend sends POST /api/v1/ai/chat/stream { message, conversationId? }
4. Backend:
   a. Checks daily quota (20/user, 500/global)
   b. Loads or creates conversation + messages (last 20 for context)
   c. Builds platform-aware prompt with user's live data:
      - Name, trust score, level, XP, streak
      - Recent 5 videos, review count
   d. Sends to NVIDIA API (Llama 3.1 8B)
   e. Streams response via SSE (text/event-stream)
5. Frontend reads SSE stream, builds assistant message incrementally
6. Conversation + messages persisted in DB
7. User can view history, delete conversations
```

### Flow 11: Mission System
```
1. ADMIN creates mission:
   - POST /api/v1/missions { title, difficulty, xpReward, creditReward, timeEstimateMinutes }
   
2. ADMIN creates mission chain (optional):
   - POST /api/v1/missions/chain { niche, steps: [{title, difficulty, xpReward, creditReward}] }
   - Creates 2-5 linked missions (chain_id + chain_step)
   
3. USER self-assigns mission:
   - POST /api/v1/missions/:id/assign
   - Idempotent (returns existing if already assigned)
   - Due date = assigned_at + 7 days
   
4. USER completes mission:
   - POST /api/v1/missions/assignments/:id/complete
   - Awards XP + credits to user accounts
   - Sends notification
   
5. USER skips mission:
   - POST /api/v1/missions/assignments/:id/skip
   - No penalty, just moves on

6. CRON (nightly):
   - Assignments older than 7 days → status='expired'
```

### Flow 12: Notification System
```
EVENT TRIGGERS:
- Video submitted → notify community members
- Review assigned → notify reviewer
- Review completed → notify video owner
- Watch claimed → notify video owner
- Report filed → notify admins
- Appeal filed → notify admins
- Mission completed → notify user
- Badge earned → notify user

DELIVERY CHANNELS:
1. IN-APP: Always delivered to notifications table
2. PUSH: Via VAPID web push (if pushEnabled + not in quiet hours)
3. EMAIL: Via Resend (weekly digest on Sundays, if emailEnabled + verified email)

PREFERENCES:
- emailEnabled, pushEnabled, inAppEnabled (toggles)
- missionReminders, reviewRequests, communityUpdates (category toggles)
- quietHoursStart, quietHoursEnd (UTC hours, 0-23)

PUSH SUBSCRIPTION:
- Frontend subscribes via PushManager.subscribe()
- Sends { endpoint, keys: { p256dh, auth } } to backend
- Backend stores in push_subscriptions (upsert by user+endpoint)
- Dead endpoints (404/410) auto-removed
```

### Flow 13: Shop & Purchases
```
1. USER goes to /gamification → Credit Shop section
2. Sees items: Video Boost (50cr), Streak Freeze (30cr)
3. Clicks "Buy" on item
4. Frontend sends POST /api/v1/shop/purchase { itemType, videoId? }
5. Backend:
   a. Checks credit balance >= cost
   b. Atomic deduction from credit_accounts
   c. Records in credit_purchases + credit_transactions
   d. If boost: sets video.boosted_until = now + 24h
   e. If streak freeze: increments streak_freezes on streaks row
6. Boost effect: video sorted first in queue feed for 24h, labeled "Boosted"
7. Freeze effect: next streak break consumes freeze instead of resetting
```

### Flow 14: Search
```
1. User types in search bar or goes to /search
2. Query synced with URL ?q= parameter
3. Frontend sends GET /api/v1/search?q=<query>
4. Backend searches:
   a. Public communities (LIKE match on name + description)
   b. Active videos (LIKE match on title)
5. Returns { communities: [], videos: [] } (max 20 each)
6. User clicks result → navigates to community/video detail
```

### Flow 15: PWA & Android Share Target
```
1. User visits site on Android Chrome
2. Install banner appears (captures beforeinstallprompt event)
3. User installs → app added to home screen
4. Manifest defines share_target: POST to /submit
5. User shares YouTube link from YouTube app → LoopSquad appears in share sheet
6. Share opens LoopSquad submit page with link prefilled
7. User completes submission
```

---

## 4. Every Action A User Can Take

### Authentication Actions
| Action | Endpoint | Auth Required |
|--------|----------|---------------|
| Sign in with Google | Firebase popup → POST /auth/register | No (then Yes) |
| Get current user | GET /auth/me | Yes |
| Update display name | PUT /auth/profile | Yes |
| Get permissions | GET /auth/permissions | Optional |

### Video Actions
| Action | Endpoint | Rewards |
|--------|----------|---------|
| Submit video | POST /videos | — |
| List own videos | GET /videos | — |
| Get video detail | GET /videos/:id | — |

### Watch Actions
| Action | Endpoint | Rewards |
|--------|----------|---------|
| Start watch session | POST /watch/start | — |
| Send heartbeat | POST /watch/heartbeat | — |
| Get attention challenge | POST /watch/challenge | — |
| Answer challenge | POST /watch/challenge/:id/answer | +1 trust (pass) / -5 trust (fail) |
| Claim watch | POST /watch | up to +20 XP (watch 10 · feedback 10) · +7 credits (4/3) · +1 reputation · subscribe = trust-only |

### Review Actions
| Action | Endpoint | Rewards |
|--------|----------|---------|
| List assigned reviews | GET /reviews | — |
| Get review detail | GET /reviews/:id | — |
| Start review | POST /reviews/:id/start | — |
| Complete review | POST /reviews/:id/complete | XP + credits |
| Rate review helpful | POST /reviews/:id/helpful | +1 trust to reviewer |

### Community Actions
| Action | Endpoint |
|--------|----------|
| List my communities | GET /communities |
| Get community detail | GET /communities/:id |
| Create community | POST /communities |
| Join community | POST /communities/join |
| List members | GET /communities/:id/members |
| Update settings | PUT /communities/:id/settings |

### Gamification Actions
| Action | Endpoint | Effect |
|--------|----------|--------|
| Get credits | GET /credits | — |
| Get XP | GET /xp | — |
| Get streaks | GET /streaks | — |
| Get badges | GET /badges | — |
| Get leaderboard | GET /leaderboards | — |
| Claim daily bonus | POST /gamification/daily-bonus | 5cr × streak multiplier |
| Get daily quests | GET /daily-quests | — |

### Mission Actions
| Action | Endpoint | Rewards |
|--------|----------|---------|
| List missions | GET /missions | — |
| Assign mission | POST /missions/:id/assign | — |
| List assignments | GET /missions/assignments | — |
| Complete assignment | POST /missions/assignments/:id/complete | XP + credits |
| Skip assignment | POST /missions/assignments/:id/skip | — |
| Create mission (admin) | POST /missions | — |
| Create chain (admin) | POST /missions/chain | — |

### Notification Actions
| Action | Endpoint |
|--------|----------|
| List notifications | GET /notifications |
| Mark one read | POST /notifications/:id/read |
| Mark all read | POST /notifications/read-all |
| Delete notification | DELETE /notifications/:id |
| Get preferences | GET /notifications/preferences |
| Update preferences | PUT /notifications/preferences |
| Subscribe push | POST /notifications/push/subscribe |
| Unsubscribe push | POST /notifications/push/unsubscribe |

### YouTube Actions
| Action | Endpoint |
|--------|----------|
| Start OAuth | GET /youtube/oauth/authorize |
| OAuth callback | GET /youtube/oauth/callback |
| Check status | GET /youtube/status |
| Disconnect | POST /youtube/disconnect |

### Report Actions
| Action | Endpoint |
|--------|----------|
| Submit report | POST /reports |
| Appeal report | POST /reports/:id/appeal |

### Shop Actions
| Action | Endpoint |
|--------|----------|
| List items | GET /shop |
| Purchase item | POST /shop/purchase |

### User Actions
| Action | Endpoint |
|--------|----------|
| Get my profile | GET /users/me/profile |
| Update profile | PUT /users/me/profile |
| Get my member view | GET /users/me/member |
| Connect YouTube | POST /users/me/youtube-channel |
| List channels | GET /users/me/youtube-channels |

### Feed Actions
| Action | Endpoint |
|--------|----------|
| Get watch queue | GET /queue |
| Get my submissions | GET /submissions |
| Get activity feed | GET /activity |

### Search Actions
| Action | Endpoint |
|--------|----------|
| Search | GET /search?q= |

### AI Actions
| Action | Endpoint |
|--------|----------|
| Chat (sync) | POST /ai/chat |
| Chat (streaming) | POST /ai/chat/stream |
| List conversations | GET /ai/conversations |
| Get messages | GET /ai/conversations/:id/messages |
| Delete conversation | DELETE /ai/conversations/:id |

### Admin Actions
| Action | Endpoint |
|--------|----------|
| Get metrics | GET /admin/metrics |
| List users | GET /admin/users |
| List communities | GET /admin/communities |
| List reports | GET /admin/reports |
| Resolve report | POST /admin/reports/:id/resolve |
| Get analytics | GET /admin/analytics |
| Get retention | GET /admin/retention |
| Review appeal | POST /admin/appeals/:id |

---

## 5. All API Endpoints

### Complete Endpoint Map (81 routes: 80 API + /health)

```
HEALTH
  GET  /health                                        → { status: "ok" }

AUTH (4 routes)
  POST /api/v1/auth/register                          → Create/retrieve user
  GET  /api/v1/auth/me                                → Current user profile
  PUT  /api/v1/auth/profile                           → Update display name
  GET  /api/v1/auth/permissions                       → Role + permissions

USERS (6 routes)
  GET  /api/v1/users/:id                              → Public user profile
  GET  /api/v1/users/me/profile                       → Full profile + channels
  PUT  /api/v1/users/me/profile                       → Update creator profile
  POST /api/v1/users/me/youtube-channel               → Connect YouTube channel
  GET  /api/v1/users/me/member                        → Member dashboard view
  GET  /api/v1/users/me/youtube-channels               → List connected channels

COMMUNITIES (6 routes)
  GET  /api/v1/communities                            → List user's communities
  GET  /api/v1/communities/:id                        → Community detail + members
  POST /api/v1/communities                            → Create community
  POST /api/v1/communities/join                       → Join by invite code
  GET  /api/v1/communities/:id/members                → List active members
  PUT  /api/v1/communities/:id/settings               → Update community settings

VIDEOS (3 routes)
  GET  /api/v1/videos                                 → List videos (own or community)
  POST /api/v1/videos                                 → Submit video
  GET  /api/v1/videos/:id                             → Video detail + reviews

REVIEWS (6 routes)
  GET  /api/v1/reviews                                → List assigned reviews
  GET  /api/v1/reviews/:id                            → Review detail + answers
  POST /api/v1/reviews/:id/start                      → Mark in_progress
  POST /api/v1/reviews/:id/complete                   → Complete review
  POST /api/v1/reviews/:id/answers                    → Submit/update answers
  POST /api/v1/reviews/:id/helpful                    → Rate helpfulness

WATCH (5 routes)
  POST /api/v1/watch                                  → Claim watch
  POST /api/v1/watch/start                            → Start session (HMAC token)
  POST /api/v1/watch/heartbeat                        → Record time sample
  POST /api/v1/watch/challenge                        → Get attention check
  POST /api/v1/watch/challenge/:id/answer             → Answer challenge

MISSIONS (7 routes)
  GET  /api/v1/missions                               → List active missions
  POST /api/v1/missions                               → Create mission (admin)
  POST /api/v1/missions/:id/assign                    → Self-assign
  GET  /api/v1/missions/assignments                   → List assignments
  POST /api/v1/missions/assignments/:id/complete      → Complete + award
  POST /api/v1/missions/assignments/:id/skip           → Skip
  POST /api/v1/missions/chain                         → Create chain (admin)

GAMIFICATION (8 routes)
  GET  /api/v1/daily-quests                           → Today's quests
  GET  /api/v1/credits                               → Credit balance + history
  GET  /api/v1/xp                                     → XP balance + history
  GET  /api/v1/reputation                             → Trust score + events
  GET  /api/v1/streaks                                → Streak info
  GET  /api/v1/badges                                → Earned badges
  GET  /api/v1/leaderboards                           → Rankings (weighted score)
  POST /api/v1/gamification/daily-bonus               → Claim daily bonus

NOTIFICATIONS (9 routes)
  GET  /api/v1/notifications                          → List notifications
  POST /api/v1/notifications                          → Create notification
  POST /api/v1/notifications/read-all                 → Mark all read
  POST /api/v1/notifications/:id/read                 → Mark one read
  DELETE /api/v1/notifications/:id                    → Delete
  PUT  /api/v1/notifications/preferences              → Update prefs
  GET  /api/v1/notifications/preferences              → Get prefs
  POST /api/v1/notifications/push/subscribe           → Subscribe push
  POST /api/v1/notifications/push/unsubscribe         → Unsubscribe push

FEED (3 routes)
  GET  /api/v1/queue                                  → Watch queue
  GET  /api/v1/submissions                            → My submissions
  GET  /api/v1/activity                               → Activity feed

AI (5 routes)
  POST /api/v1/ai/chat                                → Chat (sync)
  POST /api/v1/ai/chat/stream                         → Chat (SSE streaming)
  GET  /api/v1/ai/conversations                       → List conversations
  GET  /api/v1/ai/conversations/:id/messages          → Get messages
  DELETE /api/v1/ai/conversations/:id                 → Delete conversation

YOUTUBE (5 routes)
  GET  /api/v1/youtube/oauth/authorize                → Start OAuth flow
  GET  /api/v1/youtube/oauth/callback                 → OAuth callback (redirect)
  POST /api/v1/youtube/oauth/callback                 → OAuth callback (JSON)
  GET  /api/v1/youtube/status                         → Connection status
  POST /api/v1/youtube/disconnect                     → Disconnect

SEARCH (1 route)
  GET  /api/v1/search?q=                              → Full-text search

REPORTS (2 routes)
  POST /api/v1/reports                                → Submit report
  POST /api/v1/reports/:id/appeal                     → Appeal report

SHOP (2 routes)
  GET  /api/v1/shop                                   → List items
  POST /api/v1/shop/purchase                          → Purchase item

ADMIN (8 routes)
  GET  /api/v1/admin/metrics                          → Platform metrics
  GET  /api/v1/admin/users                            → List users
  GET  /api/v1/admin/communities                      → List communities
  GET  /api/v1/admin/reports                          → List reports
  POST /api/v1/admin/reports/:id/resolve              → Resolve report
  GET  /api/v1/admin/analytics                        → Funnel analytics
  GET  /api/v1/admin/retention                        → Cohort retention
  POST /api/v1/admin/appeals/:id                      → Review appeal
```

---

## 6. Database Schema — All 40 Tables

### Core User Tables

**`users`** — Core user record
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| firebase_uid | TEXT UNIQUE NOT NULL | Firebase Auth UID |
| email | TEXT | |
| email_verified | BOOLEAN DEFAULT FALSE | |
| display_name | TEXT | |
| photo_url | TEXT | |
| created_at | DATETIME | |
| updated_at | DATETIME | |
| deleted_at | DATETIME | Soft delete |
| last_active | DATETIME | Updated on each API call |

**`creator_profiles`** — Extended creator info
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT UNIQUE FK→users | |
| bio | TEXT | |
| country | TEXT | |
| language | TEXT | |
| experience_level | TEXT | CHECK: beginner/intermediate/advanced |
| niche | TEXT | |
| content_categories | TEXT | |
| goals | TEXT | |
| looking_for | TEXT | CHECK: collaboration/feedback/support/mentorship |
| avatar_url | TEXT | |
| banner_url | TEXT | |
| public_profile | BOOLEAN DEFAULT TRUE | |

**`youtube_channels`** — Connected YouTube channels (manual)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users | |
| channel_id | TEXT NOT NULL | YouTube channel ID (UC...) |
| channel_name | TEXT | |
| subscriber_count | INTEGER | |
| view_count | INTEGER | |
| video_count | INTEGER | |
| country | TEXT | |
| UNIQUE | (user_id, channel_id) | |

**`youtube_oauth_tokens`** — OAuth tokens for YouTube API
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT UNIQUE FK→users CASCADE | |
| access_token | TEXT NOT NULL | |
| refresh_token | TEXT | |
| expires_at | DATETIME NOT NULL | |
| scope | TEXT | |
| channel_id | TEXT | Resolved after token exchange |

**`youtube_oauth_states`** — OAuth state tokens (CSRF protection)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users CASCADE | |
| state | TEXT UNIQUE NOT NULL | UUID |
| expires_at | INTEGER | Epoch seconds, 10min TTL |

### Community Tables

**`communities`** — WhatsApp creator groups
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| name | TEXT NOT NULL | 3-100 chars |
| description | TEXT | 0-500 chars |
| slug | TEXT UNIQUE NOT NULL | Auto-generated |
| invite_code | TEXT UNIQUE NOT NULL | 8-char alphanumeric |
| logo_url | TEXT | |
| banner_url | TEXT | |
| is_public | BOOLEAN DEFAULT FALSE | |
| owner_id | TEXT FK→users | |
| max_members | INTEGER DEFAULT 10000 | 10-10000 |

**`community_members`** — Membership records
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| community_id | TEXT FK→communities | |
| user_id | TEXT FK→users | |
| role | TEXT DEFAULT 'member' | CHECK: owner/admin/moderator/mentor/member |
| joined_at | DATETIME | |
| status | TEXT DEFAULT 'active' | CHECK: active/suspended/banned/left |
| UNIQUE | (community_id, user_id) | |

**`community_settings`** — Per-community config
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| community_id | TEXT FK→communities | |
| allow_peer_review | BOOLEAN DEFAULT TRUE | |
| allow_collaboration | BOOLEAN DEFAULT TRUE | |
| require_approval | BOOLEAN DEFAULT TRUE | |
| default_language | TEXT | |

### Video Tables

**`videos`** — Submitted videos
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users | Submitter |
| community_id | TEXT FK→communities | Optional |
| youtube_video_id | TEXT | Extracted from URL |
| channel_id | TEXT | YouTube channel ID (migration 021) |
| youtube_url | TEXT | Original URL |
| title | TEXT | Auto-fetched or user-provided |
| description | TEXT | |
| thumbnail_url | TEXT | Auto-fetched |
| duration_seconds | INTEGER | Auto-fetched |
| views_count | INTEGER | |
| likes_count | INTEGER | |
| published_at | DATETIME | |
| status | TEXT DEFAULT 'pending' | CHECK: pending/active/completed/archived/removed |
| watch_target | INTEGER DEFAULT 20 | |
| min_watch_seconds | INTEGER DEFAULT 180 | |
| give_take_ratio | REAL DEFAULT 1.0 | |
| magic_word | TEXT | Comment verification keyword |
| boosted_until | TEXT | Boost expiry timestamp |
| niche | TEXT | Tech/Food/Fitness/Beauty/Gaming/Music/Podcast/DIY |

### Watch Tables

**`watch_sessions`** — Watch claim records
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| video_id | TEXT FK→videos | |
| watcher_id | TEXT FK→users | |
| watch_seconds | INTEGER DEFAULT 0 | |
| status | TEXT DEFAULT 'started' | started/claimed |
| subscribed | INTEGER DEFAULT 0 | |
| commented | INTEGER DEFAULT 0 | |
| xp_awarded | INTEGER DEFAULT 0 | |
| credits_awarded | INTEGER DEFAULT 0 | |
| verified_at | DATETIME | |
| UNIQUE | (video_id, watcher_id) | One claim per user per video |

**`watch_session_tokens`** — HMAC session tokens
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT NOT NULL | |
| video_id | TEXT NOT NULL | |
| token | TEXT UNIQUE NOT NULL | HMAC-SHA256 |
| start_ts | INTEGER NOT NULL | Epoch ms |
| expires_at | INTEGER NOT NULL | 1 hour TTL |

**`watch_heartbeats`** — Time samples during watch
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| session_token_id | TEXT NOT NULL FK→watch_session_tokens | |
| player_time | REAL NOT NULL | YT player getCurrentTime() |
| received_at | INTEGER NOT NULL | Epoch ms |

**`attention_challenges`** — Mid-watch verification
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT NOT NULL | |
| video_id | TEXT NOT NULL | |
| question | TEXT NOT NULL | "What is 7 + 3?" |
| answer_hash | TEXT NOT NULL | SHA-256 of answer |
| attempts | INTEGER DEFAULT 0 | |
| max_attempts | INTEGER DEFAULT 2 | |
| status | TEXT DEFAULT 'active' | CHECK: active/passed/failed |

### Review Tables

**`reviews`** — Peer review records
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| video_id | TEXT FK→videos | |
| reviewer_id | TEXT FK→users | |
| submitter_id | TEXT FK→users | |
| status | TEXT DEFAULT 'assigned' | CHECK: assigned/in_progress/completed/overdue/skipped |
| assigned_at | DATETIME | |
| started_at | DATETIME | |
| completed_at | DATETIME | |
| score | INTEGER | 1-5 average |
| feedback_text | TEXT | Free text |
| watch_verified | BOOLEAN DEFAULT FALSE | |
| subscribed | BOOLEAN DEFAULT FALSE | |
| commented | BOOLEAN DEFAULT FALSE | |
| helpful | INTEGER | Helpful rating count |

**`review_questions`** — Seeded question templates
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| community_id | TEXT FK→communities | |
| question_text | TEXT NOT NULL | |
| question_type | TEXT DEFAULT 'rating' | CHECK: rating/text/yes_no |
| is_required | BOOLEAN DEFAULT TRUE | |
| order_index | INTEGER | |

**`review_answers`** — Individual answers
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| review_id | TEXT FK→reviews | |
| question_id | TEXT FK→review_questions | |
| rating_value | INTEGER | 0-5 |
| text_answer | TEXT | 0-500 chars |

### Gamification Tables

**`credit_accounts`** — Credit balances
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users | |
| balance | INTEGER DEFAULT 0 | Current balance |
| created_at | DATETIME | |
| updated_at | DATETIME | |

**`credit_transactions`** — Credit ledger
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users | |
| amount | INTEGER NOT NULL | Positive or negative |
| type | TEXT | CHECK: earned/spent/bonus/penalty/admin |
| description | TEXT | |
| reference_id | TEXT | Link to source |
| created_at | DATETIME | |

**`xp_accounts`** — XP balances
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users | |
| total_xp | INTEGER DEFAULT 0 | |
| level | INTEGER DEFAULT 1 | |
| xp_to_next_level | INTEGER DEFAULT 100 | |

**`xp_transactions`** — XP ledger
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users | |
| amount | INTEGER NOT NULL | |
| type | TEXT | CHECK: mission/challenge/review/feedback/login/bonus/penalty |
| description | TEXT | |
| reference_id | TEXT | |

**`reputation_accounts`** — Trust scores
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users | |
| score | INTEGER DEFAULT 100 | Base trust score |
| last_calculated | DATETIME | |
| subscriptions_given | INTEGER DEFAULT 0 | |
| subscriptions_received | INTEGER DEFAULT 0 | |
| watch_minutes | INTEGER DEFAULT 0 | |

**`reputation_events`** — Trust change audit log
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users | |
| event_type | TEXT NOT NULL | |
| points_change | INTEGER NOT NULL | Positive or negative |
| description | TEXT | |

**`streaks`** — Activity streaks
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users | |
| current_streak | INTEGER DEFAULT 0 | |
| longest_streak | INTEGER DEFAULT 0 | |
| last_activity_date | TEXT | |
| streak_type | TEXT | CHECK: daily_login/daily_mission/daily_review |
| streak_freezes | INTEGER DEFAULT 0 | Consumed on break |

**`badges`** — Badge definitions (pre-seeded)
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| name | TEXT NOT NULL | review-streak-10, review-streak-50, supporter-1 |
| description | TEXT | |
| criteria_type | TEXT NOT NULL | review_streak, review_count, credit_purchase |
| criteria_value | TEXT | Threshold value |
| xp_reward | INTEGER DEFAULT 0 | |
| credit_reward | INTEGER DEFAULT 0 | |

**`user_badges`** — Earned badges
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users | |
| badge_id | TEXT FK→badges | |
| earned_at | DATETIME | |

**`daily_quests`** — Daily quest progress
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT NOT NULL | |
| quest_date | TEXT NOT NULL | YYYY-MM-DD |
| quest_type | TEXT NOT NULL | watch_videos/give_reviews/submit_video |
| target_count | INTEGER DEFAULT 1 | |
| progress | INTEGER DEFAULT 0 | |
| reward_xp | INTEGER DEFAULT 10 | |
| reward_credits | INTEGER DEFAULT 15 | |
| status | TEXT DEFAULT 'active' | CHECK: active/completed/claimed |
| UNIQUE | (user_id, quest_date, quest_type) | |

**`credit_purchases`** — Shop purchase records
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT NOT NULL | |
| item_type | TEXT NOT NULL | CHECK: boost/streak_freeze |
| item_ref | TEXT | Video ID for boost |
| cost_credits | INTEGER NOT NULL | 50 for boost, 30 for freeze |

### Mission Tables

**`missions`** — Mission definitions
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| title | TEXT NOT NULL | 5-200 chars |
| description | TEXT | 0-1000 chars |
| difficulty | TEXT DEFAULT 'medium' | CHECK: easy/medium/hard |
| xp_reward | INTEGER DEFAULT 25 | |
| credit_reward | INTEGER DEFAULT 10 | |
| time_estimate_minutes | INTEGER DEFAULT 15 | |
| is_active | BOOLEAN DEFAULT TRUE | |
| chain_id | TEXT | Links missions in a chain |
| chain_step | INTEGER | Step number in chain (1-5) |

**`mission_assignments`** — User mission assignments
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| mission_id | TEXT FK→missions | |
| user_id | TEXT FK→users | |
| assigned_at | DATETIME | |
| started_at | DATETIME | |
| completed_at | DATETIME | |
| status | TEXT DEFAULT 'assigned' | CHECK: assigned/in_progress/completed/expired/skipped |

### Notification Tables

**`notifications`** — In-app notifications
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users | |
| type | TEXT NOT NULL | REVIEW_ASSIGNED/WATCH_SESSION_CLAIMED/REPORT_FILED/etc |
| title | TEXT | 1-200 chars |
| message | TEXT | 1-1000 chars |
| data | TEXT | JSON metadata |
| is_read | BOOLEAN DEFAULT FALSE | |
| read_at | DATETIME | |

**`notification_preferences`** — User notification settings
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users | |
| email_enabled | BOOLEAN DEFAULT TRUE | |
| push_enabled | BOOLEAN DEFAULT TRUE | |
| whatsapp_enabled | BOOLEAN DEFAULT FALSE | |
| in_app_enabled | BOOLEAN DEFAULT TRUE | |
| mission_reminders | BOOLEAN DEFAULT TRUE | |
| review_requests | BOOLEAN DEFAULT TRUE | |
| community_updates | BOOLEAN DEFAULT TRUE | |
| quiet_hours_start | INTEGER | UTC hour 0-23 |
| quiet_hours_end | INTEGER | UTC hour 0-23 |

**`push_subscriptions`** — VAPID push endpoints
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users CASCADE | |
| endpoint | TEXT NOT NULL | Push service URL |
| p256dh | TEXT NOT NULL | Encryption key |
| auth | TEXT NOT NULL | Auth secret |
| UNIQUE | (user_id, endpoint) | |

### Moderation Tables

**`reports`** — User-submitted reports
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| reporter_id | TEXT FK→users | |
| reported_user_id | TEXT FK→users | |
| resource_type | TEXT | CHECK: video/review/comment/user/community |
| resource_id | TEXT | |
| reason | TEXT | CHECK: spam/inappropriate/harassment/cheating/misleading/other |
| description | TEXT | 0-1000 chars |
| status | TEXT DEFAULT 'pending' | CHECK: pending/investigating/resolved/dismissed |
| resolved_by | TEXT FK→users | |
| resolution_notes | TEXT | |

**`appeals`** — Report appeals
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| report_id | TEXT NOT NULL FK→reports | |
| user_id | TEXT NOT NULL | |
| reason | TEXT NOT NULL | 10-2000 chars |
| status | TEXT DEFAULT 'pending' | CHECK: pending/accepted/rejected |
| reviewed_by | TEXT | |
| note | TEXT | |

### Admin Tables

**`admin_users`** — Admin role assignments
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users | |
| role | TEXT | CHECK: super_admin/admin/moderator |

### System Tables

**`analytics_events`** — Event tracking
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT | |
| event_type | TEXT NOT NULL | video_submitted/watch_started/watch_claimed/review_completed/report_filed/signup |
| resource_type | TEXT | |
| resource_id | TEXT | |
| metadata | TEXT | JSON |

**`job_runs`** — Cron job audit log
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| job_name | TEXT NOT NULL | |
| started_at | INTEGER NOT NULL | Epoch |
| finished_at | INTEGER | |
| status | TEXT DEFAULT 'running' | CHECK: running/completed/failed |
| processed_rows | INTEGER DEFAULT 0 | |
| error_message | TEXT | |

**`cohort_retention`** — User retention tracking
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT FK→users | |
| signup_date | TEXT NOT NULL | |
| week1_active | INTEGER DEFAULT 0 | Active in first week? |
| week4_active | INTEGER DEFAULT 0 | Active in fourth week? |

### AI Tables
**`ai_conversations`** — AI assistant conversation headers
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| user_id | TEXT NOT NULL FK→users | |
| title | TEXT | First 60 chars of the opening message |
| created_at | DATETIME | |
| updated_at | DATETIME | |

**`ai_messages`** — AI assistant message history
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | |
| conversation_id | TEXT NOT NULL FK→ai_conversations CASCADE | |
| user_id | TEXT NOT NULL FK→users | |
| role | TEXT NOT NULL | CHECK: system/user/assistant |
| content | TEXT NOT NULL | |
| created_at | DATETIME | |

---

## 7. Authentication & Session Flow

### Firebase Auth (Frontend)
1. User clicks "Sign In with Google"
2. Firebase popup opens → Google OAuth consent
3. On success: `signInWithPopup(auth, googleProvider)`
4. Firebase returns `UserCredential` with `user.getIdToken()`
5. Token stored in `localStorage.setItem("authToken", token)`
6. Token auto-refreshed every 30 seconds via `setInterval`

### Auth Ready Promise
- Firebase `onAuthStateChanged` fires `null` first, then actual user
- `waitForAuthReady()` waits for non-null user OR 3s timeout
- Prevents API calls firing before user is loaded

### API Authentication (Backend)
1. Axios interceptor attaches `Authorization: Bearer <token>` to every request
2. Backend `authMiddleware` extracts Bearer token
3. `verifyFirebaseToken()` verifies JWT against Google's x509 certs
4. Dev mode: accepts base64url-encoded dev tokens (no real Firebase needed)
5. Production: RSASSA-PKCS1-v1_5 + SHA-256 verification
6. Validates: `aud` (project ID), `iss` (securetoken.google.com), `exp`, `sub`
7. Resolves Firebase UID to internal user ID via `users` table
8. Auto-creates user if not found
9. Updates `last_active` timestamp

### Watch Session Authentication
1. User starts watching → `POST /watch/start`
2. Backend generates HMAC-SHA256 token: `userId:videoId:startTs`
3. Token stored in `watch_session_tokens` (1 hour TTL)
4. Heartbeats every 30s include token + playerTime
5. Backend validates token, checks expiry, records heartbeat
6. Claim requires valid heartbeat chain

---

## 8. Anti-Cheat & Trust System

### Multi-Layer Watch Verification
| Layer | What It Checks | How |
|-------|---------------|-----|
| Tab visibility | User is on the page | `document.hidden` / `visibilitychange` |
| Playback rate | Not fast-forwarding | `player.getPlaybackRate() <= 1.25` |
| Muted detection | Not muted | `player.isMuted()` — halves credit if muted |
| Seek detection | Not skipping ahead | `playerTime < lastSample` → ignore |
| Session token | HMAC-signed session | Server-issued, 1h TTL |
| Heartbeat chain | Consistent progression | Slope ≈ 1× real time |
| Attention check | Random arithmetic | 40-70% of watch time, 2 attempts |
| YouTube subscription | API-verified | OAuth token → subscriptions.list |
| YouTube watch time | Analytics API | `estimatedMinutesWatched` (creator-only) |
| Magic word comment | API-verified | commentThreads.list + author-channel match |
| Self-watch block | Can't watch own video | `video.user_id === watcherId` |
| Double-claim guard | One claim per video | `watch_sessions` UNIQUE constraint |

### Trust Score Mechanics
- **Base:** 100
- **Gains:** +1 per verified claim, +1 per helpful review, +1 per attention check pass
- **Losses:** -5 per attention check fail, -10 per report filed against, -2 per anomaly flag
- **Future (not yet enforced):** Trust < 60 → payouts pending 24h; Trust < 40 → claims require YouTube connect

### Anomaly Detection (Nightly Cron)
1. Calculate per-user claim counts over 7 days
2. If ≥ 5 users, compute mean + stddev
3. Flag users with claims > mean + 3*sigma
4. Apply -2 trust penalty per flag
5. Results visible in admin low-trust watchlist

### Duplicate & Conflict Detection
- **Duplicate video:** Same `youtube_video_id` + `status='active'` → 409
- **24h limit:** One submission per user per 24 hours
- **Ratio gate:** `(given + watch_hours) / received >= 0.80` (new users exempt)
- **Channel conflict:** Same `channel_id` on different accounts → rejection
- **Self-watch:** `video.user_id === watcherId` → blocked

---

## 9. Gamification Economy

### XP (Experience Points)
- **Earn:** up to +20 per watch claim (watch +10 · feedback +10; subscribe is trust-only), +missions, +daily quests, +badge rewards
- **Level formula:** `floor(50 * level^2 * 0.8)` XP per level
- **Track:** `xp_accounts` (total_xp, level) + `xp_transactions` (ledger)

### Credits
- **Earn:** up to +7 per watch claim (watch +4 · feedback +3; subscribe is trust-only), +daily bonus, +missions, +badge rewards
- **Spend:** Video boost (50cr), Streak freeze (30cr)
- **Track:** `credit_accounts` (balance) + `credit_transactions` (ledger)

### Reputation (Trust Score)
- **Start:** 100
- **Gain:** +1 per verified claim, +1 per helpful review, +1 per attention check pass
- **Loss:** -5 per attention check fail, -10 per report filed against, -2 per anomaly flag
- **Track:** `reputation_accounts` (score) + `reputation_events` (audit log)

### Leaderboard Score
- **Formula:** `round(xp * 0.4 + credits * 0.3 + reputation * 0.3)`
- **Filters:** Weekly/monthly/all-time, rookie/rising/veteran cohorts

### Daily Bonus
- **Base:** 5 credits
- **Multiplier:** `min(1 + streak * 0.1, 3.0)` — max 3× at 20-day streak
- **Idempotent:** Once per day

### Daily Quests (Auto-generated)
| Quest | Target | Reward |
|-------|--------|--------|
| Watch videos | 2 | 15 XP, 20 credits |
| Give reviews | 1 | 10 XP, 15 credits |
| Submit video | 1 | 20 XP, 25 credits |

### Shop Items
| Item | Cost | Effect |
|------|------|--------|
| Video Boost | 50 credits | Video sorted first in queue for 24h |
| Streak Freeze | 30 credits | +1 freeze (consumed on streak break) |

### Badges (Pre-seeded)
| Badge | Criteria | Reward |
|-------|----------|--------|
| Consistent Reviewer | 10 review streak | 50 XP, 20 credits |
| Review Veteran | 50 completed reviews | 200 XP, 100 credits |
| Supporter | Any credit purchase | 25 XP, 10 credits |

---

## 10. Community System

### Community Lifecycle
1. **Create:** Owner creates with name, description, max members
2. **Invite:** 8-char alphanumeric code generated, shared via WhatsApp
3. **Join:** Members join with invite code
4. **Engage:** Community-scoped queue, weekly leaderboard
5. **Manage:** Owner sets peer review, collaboration, approval settings

### Community Roles
| Role | Permissions |
|------|------------|
| owner | Full control, manage settings, manage members |
| admin | Moderate content, manage members |
| moderator | Moderate content |
| mentor | Guide newer members |
| member | Submit, watch, review |

### Community-Scoped Features
- **Queue filter:** `GET /queue?communityId=X` → shows only community members' videos
- **Weekly leaderboard:** Rankings within community
- **Member list:** Roles, trust scores, points
- **Notifications:** Member join/leave events

---

## 11. Notification System

### Event-Driven Notifications
| Event | Recipients | Type (stored value) |
|-------|-----------|------|
| Video submitted | Community members | NEW_VIDEO_SUBMITTED |
| Review assigned | Reviewer | REVIEW_ASSIGNED |
| Review started | Video submitter | REVIEW_STARTED |
| Review completed | Video owner | REVIEW_COMPLETED |
| Watch claimed | Video owner | WATCH_SESSION_CLAIMED |
| Report filed | All admins | REPORT_FILED |
| Appeal filed | All admins | APPEAL_FILED |
| Mission assigned | User | MISSION_ASSIGNED |
| Mission completed | User | MISSION_COMPLETED |
| Badge earned | User | BADGE_EARNED |

### Delivery Channels
1. **In-app:** Always delivered to `notifications` table
2. **Push:** Via VAPID web push (if `pushEnabled` + not in quiet hours)
3. **Email:** Via Resend (weekly digest on Sundays, if `emailEnabled` + verified email)

### Quiet Hours
- Configurable UTC hour range (0-23)
- Push notifications suppressed during quiet hours
- In-app notifications always delivered

### Push Subscription
- Frontend: `PushManager.subscribe()` with VAPID key
- Backend: stores `endpoint`, `p256dh`, `auth` in `push_subscriptions`
- Dead endpoints (404/410) auto-removed on send failure

---

## 12. AI Assistant

### Capabilities
- Platform-aware coaching (knows user's stats, videos, reviews)
- Growth strategy advice
- Engagement tips
- Platform help

### Technical Details
- **Model:** Llama 3.1 8B via NVIDIA API
- **Streaming:** SSE (text/event-stream) for real-time responses
- **Context:** Last 20 messages per conversation
- **Prompt enrichment:** User's name, trust score, level, XP, streak, recent 5 videos, review count
- **Quotas:** 20 messages/user/day, 500 messages/global/day
- **Storage:** Conversations + messages in `ai_conversations` + `ai_messages` tables

---

## 13. Admin & Moderation

### Admin Dashboard Sections
1. **Metrics:** Users, communities, active videos, completed reviews, pending reports
2. **Analytics Funnel:** Submit → Watch → Claim conversion rates
3. **Cohort Retention:** W1/W4 activity rates for users signed up 28+ days ago
4. **Cheat Flags:** Reports with Resolve/Dismiss actions
5. **Low Trust Watchlist:** Users with trust < 90%
6. **User Management:** List users with trust scores
7. **Community Management:** List communities

### Moderation Pipeline
1. User submits report (spam/inappropriate/harassment/cheating/misleading/other)
2. -10 trust penalty applied to reported user
3. Admins notified (push + in-app)
4. 3+ "misleading" reports on same video → auto-pull
5. Admin resolves/dismisses
6. User can appeal (one-shot)
7. Admin accepts/rejects appeal

### Role-Based Access
| Role | Permissions |
|------|------------|
| super_admin | All 10 permissions |
| admin | All except manage_users |
| moderator | read, write, moderate, manage_videos, manage_reviews |
| member | read, write |

---

## 14. Cron Jobs & Background Sweeps

### Daily at Midnight (UTC)
| Job | What It Does |
|-----|-------------|
| `overdue-missions` | Mark assignments older than 7 days → `expired` |
| `overdue-reviews` | Mark reviews older than 48h → `overdue` |
| `streak-reset` | Reset streaks if no claim in 48h (consume freeze if available) |
| `anomaly-scoring` | Flag users >3σ off cohort claim cadence, -2 trust |
| `badge-awards` | Check thresholds, award badges with XP/credits |
| `weekly-digest` | (Sundays only) Send email recap via Resend |

### Job Audit
- All jobs logged to `job_runs` table
- Records: job_name, started_at, finished_at, status, processed_rows, error_message

---

## 15. External Integrations

| Service | Purpose | Config |
|---------|---------|--------|
| **Firebase Auth** | Google sign-in, JWT verification | `VITE_FIREBASE_*`, `FIREBASE_PROJECT_ID` |
| **YouTube Data API v3** | Video metadata, comment verification | `YOUTUBE_API_KEY` |
| **YouTube OAuth** | Subscription verification, watch time | `YOUTUBE_OAUTH_CLIENT_ID/SECRET` |
| **YouTube Analytics API** | Watch time verification | Via OAuth token |
| **NVIDIA API** | Llama 3.1 8B chat completions | `AI_API_KEY` |
| **VAPID Web Push** | Browser push notifications | `VAPID_PUBLIC_KEY/PRIVATE_KEY` |
| **Resend** | Email digests | `RESEND_API_KEY` |
| **Cloudflare D1** | Primary database | `DB` binding |
| **Cloudflare KV** | Rate limiting, cache | `KV_CACHE` binding |
| **Cloudflare R2** | Asset storage | `ASSETS_BUCKET` binding |
| **Vercel** | Frontend hosting | Auto-deploy from main |
| **Google AdSense** | Monetization | `ca-pub-9117572925263537` |

---

## 16. Frontend Architecture

### Route Structure (19 routes)
```
/                       → Landing page (public)
/auth/signin            → Google sign-in (public)
/dashboard              → Main dashboard (protected)
/queue                  → Watch queue (protected)
/submit                 → Submit video (protected)
/leaderboard            → Rankings (protected)
/ai                     → AI assistant (protected)
/settings               → YouTube connection + notification prefs (protected)
/admin                  → Admin console (role-gated)
/profile                → User profile (protected)
/gamification           → XP, credits, streaks, badges, shop (protected)
/missions               → Missions + daily quests (protected)
/notifications          → Notification feed (protected)
/communities            → Community list + create/join (protected)
/communities/:id        → Community detail (protected)
/reviews                → Peer review list (protected)
/reviews/:id            → Single review detail (protected)
/rules                  → Fairness rules (public)
/search                 → Search communities + videos (protected)
```

### Component Architecture
```
src/
├── routes/              → 19 route components (page-level)
├── components/
│   ├── site-chrome.tsx  → Header + Footer + Mobile nav
│   ├── page-parts.tsx   → PageHeader, Shell, StatCard, Thumb
│   ├── install-banner.tsx → PWA install prompt
│   ├── ad-slot.tsx      → Google AdSense slot
│   ├── RequirePermission.tsx → Role-based gate
│   ├── common/          → 7 base components (button, card, input, badge, label, progress, avatar)
│   └── ui/              → 46 shadcn/ui components
├── lib/
│   ├── firebase.ts      → Auth init, persistence, token management
│   ├── api.ts           → Axios client with auth interceptor
│   ├── api-client.ts    → 30+ typed API methods
│   ├── utils.ts         → cn(), formatDate, formatTimeAgo, truncate
│   ├── auth-diagnostics.ts → Auth error mapping, backend registration
│   ├── dev-auth.ts      → Dev mode mock auth
│   ├── env-validation.ts → Firebase env var validation
│   ├── error-capture.ts → Global error capture
│   ├── error-page.ts    → Error page renderer
│   └── lovable-error-reporting.ts → Lovable telemetry
├── hooks/
│   ├── use-api.ts       → 30+ React Query hooks
│   ├── useAuth.tsx       → AuthProvider context
│   ├── use-push.ts      → Push subscription hook
│   └── use-mobile.tsx   → Mobile detection
└── tests/               → Vitest + Testing Library
```

### Data Flow
```
User Action → React Component → use-api hook → api-client method → Axios (auth interceptor) → Cloudflare Worker → D1 Database
```

---

## 17. Backend Architecture

### Worker Structure
```
workers/api/src/
├── index.ts             → Main router, CORS, rate limiting, security headers
├── middleware/
│   ├── auth.ts          → Firebase token verification, requireAuth, requireAdmin
│   ├── errorHandler.ts  → Error mapping, response builders
│   ├── rateLimit.ts     → KV-based rate limiting (tiered)
│   ├── permissions.ts   → Role-based permission system
│   └── validation.ts    → Schema validation helpers
├── routes/              → 16 route modules (80 endpoints)
│   ├── auth.ts          → Register, me, profile, permissions
│   ├── users.ts         → Profile, channels, member view
│   ├── communities.ts   → CRUD, join, members, settings
│   ├── videos.ts        → Submit, list, detail + review routes
│   ├── watch.ts         → Start, heartbeat, challenge, claim
│   ├── missions.ts      → CRUD, assign, complete, skip, chains
│   ├── gamification.ts  → Quests, credits, XP, reputation, streaks, badges, leaderboard, daily bonus
│   ├── notifications.ts → CRUD, preferences, push subscribe/unsubscribe
│   ├── admin.ts         → Metrics, users, communities, reports, analytics, retention
│   ├── feed.ts          → Queue, submissions, activity
│   ├── ai.ts            → Chat, streaming, conversations
│   ├── youtube.ts       → OAuth flow, status, disconnect
│   ├── search.ts        → Full-text search
│   ├── reports.ts       → Submit report, appeal
│   └── shop.ts          → List items, purchase
├── services/
│   ├── ai.ts            → NVIDIA API integration (sync + streaming)
│   ├── youtube.ts       → OAuth, token refresh, subscription/comment verification
│   ├── user.ts          → User CRUD operations
│   └── firebase.ts      → JWT verification (dev + production)
├── jobs/
│   ├── index.ts         → Job registry, daily runner
│   ├── sweeps.ts        → Overdue missions/reviews, streak reset
│   ├── anomaly.ts       → 3σ claim cadence scoring
│   ├── badges.ts        → Auto-badge awards
│   └── digest.ts        → Weekly email recap
├── lib/
│   ├── database.ts      → D1 wrapper with transactions
│   ├── db.ts             → D1 query helpers (re-export of database.ts)
│   ├── push.ts          → VAPID web push
│   ├── email.ts         → Resend API
│   ├── analytics.ts     → Event tracking
│   ├── quests.ts        → Daily quest generation + progress
│   ├── logger.ts        → Structured JSON logging
│   ├── sanitize.ts      → HTML sanitization
│   └── utils.ts         → Invite codes, slugs, level calculation
└── types/
    └── index.ts         → All TypeScript interfaces
```

### Request Pipeline
```
Request → CORS headers → OPTIONS check → Rate limiting → Auth middleware → Route matching → Handler → Response
```

### Rate Limiting Tiers
| Tier | Endpoints | Limit | Window |
|------|-----------|-------|--------|
| Auth | /auth/* | 30 req | 60s |
| Expensive | /ai/*, POST /videos, POST /watch | 20 req | 60s |
| Write | POST/PUT/PATCH/DELETE | 100 req | 60s |
| Read | GET | 200 req | 60s |
| Admin | /admin/* | Fail-closed | — |

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'self'`

---

## 18. Deployment & Infrastructure

### Frontend (Vercel)
- **URL:** loop.freegameplay.site
- **Framework:** TanStack Start (Vite + Nitro)
- **Build:** `npm run build`
- **Deploy:** Auto-deploys from `main` branch
- **Region:** iad1 (US East)

### Backend (Cloudflare Workers)
- **URL:** creatorloop-api.autumn-surf-21ec.workers.dev
- **Runtime:** Cloudflare Workers (V8 isolates)
- **Database:** Cloudflare D1 (SQLite)
- **Cache:** Cloudflare KV (rate limiting)
- **Storage:** Cloudflare R2 (assets)
- **Deploy:** `npx wrangler deploy` (requires interactive auth)
- **Cron:** `0 0 * * *` (daily at midnight)

### Environment Variables
**Frontend (VITE_*):**
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_API_URL` (default: http://localhost:8787)
- `VITE_VAPID_PUBLIC_KEY`
- `VITE_ADSENSE_SLOT_ID`

**Backend (Secrets):**
- `AI_API_KEY` (NVIDIA), `YOUTUBE_API_KEY`, `YOUTUBE_OAUTH_CLIENT_SECRET`
- `VAPID_PRIVATE_KEY`, `RESEND_API_KEY`, `WATCH_SESSION_SECRET`

**Backend (Vars):**
- `FIREBASE_PROJECT_ID`, `AI_PROVIDER`, `AI_MODEL`, `CORS_ORIGINS`
- `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_REDIRECT_URI`, `VAPID_PUBLIC_KEY`
- `ENVIRONMENT`, `REQUIRED_WATCH_SEC` (180), `REWARD_XP` (30), `REWARD_CREDITS` (10)
- `REVIEW_XP` (20), `REVIEW_CREDITS` (5) — awarded on review completion
- Optional: `AI_DAILY_USER_LIMIT` (20), `AI_DAILY_GLOBAL_LIMIT` (500), `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW`, `AUTH_RATE_LIMIT_MAX_REQUESTS`, `AUTH_RATE_LIMIT_WINDOW`, `WATCH_SESSIONS_ENABLED`

---

## 19. All Rules & Enforcement

### Video Submission Rules
| Rule | Enforcement | Status |
|------|-------------|--------|
| One video per member per 24h | Backend check `videos.created_at > now - 24h` | ✅ Enforced |
| Give/take ratio ≥ 0.80 to submit | Backend check (new users exempt) | ✅ Enforced |
| No duplicate active submissions | Unique `youtube_video_id` + `status='active'` | ✅ Enforced |
| Video must be valid YouTube URL | Backend validation + metadata fetch | ✅ Enforced |
| Videos under 2 min can't set 3-min target | `Math.min(REQUIRED_WATCH_SEC, videoDuration)` | ✅ Enforced |

### Watch/Claim Rules
| Rule | Enforcement | Status |
|------|-------------|--------|
| Must watch ≥ required seconds (180s or video length) | `watch_seconds >= required` | ✅ |
| Must subscribe to creator channel | YouTube API verification | ✅ |
| Must leave comment (with optional magic word) | YouTube API verification | ✅ |
| Must stay in focus, not muted, ≤ 1.25× speed | Frontend timer + checks | ✅ |
| Random attention checks (40-70% of watch) | Backend challenge + frontend overlay | ✅ |
| Failed attention check → voids claim | Blocks claim for 24h, trust -5 | ✅ |
| Can't watch own video | Backend guard `video.user_id === watcherId` | ✅ |
| No double rewards | `alreadyClaimed` guard | ✅ |

### Report/Moderation Rules
| Rule | Enforcement | Status |
|------|-------------|--------|
| 3+ "misleading" reports → auto-pull video | Auto-sets `status='removed'` on 3rd report | ✅ |
| Report reasons: spam/inappropriate/harassment/cheating/misleading/other | Zod enum validation | ✅ |
| Trust penalty on report filed | -10 trust score | ✅ |
| Appeal flow (one-shot) | User appeal → admin review → dismiss/reinstate | ✅ |

### Trust & Economy Rules
| Rule | Enforcement | Status |
|------|-------------|--------|
| Trust score base 100 | `reputation_accounts.score` default 100 | ✅ |
| Trust < 60 → payouts pending 24h | Not yet implemented | ⏳ |
| Trust < 40 → claims require YouTube connect | Not yet implemented | ⏳ |
| Streak freeze consumes on break | Cron `streak-reset` | ✅ |
| Daily login bonus: 5cr × (1 + streak×0.1), max 3× | `/gamification/daily-bonus` | ✅ |

---

## 20. Known Gaps & Future Work

### Not Yet Implemented
| Gap | Priority | Notes |
|-----|----------|-------|
| Trust < 60/40 enforcement | P1 | Soft enforcement on payouts/claims |
| Re-verification ledger (7d/30d sub check) | P2 | Cron re-checks subscription status |
| Comment-originality hashing | P3 | Blocks copy-paste comment rings |
| Auto-assignment engine (missions) | P1 | Currently self-assign only |
| Mission creation UI (admin) | L | API-only, no frontend |
| Public profile toggle | L | Currently all profiles public |
| Dynamic rules page | L | Currently static copy |
| Email verification resend | L | No resend flow |
| Guest preview of queue | L | All earning routes behind auth |

### All P0/P1/P2/P3 Items Complete
All items from `GAP_ANALYSIS.md` and `INNOVATION_ROADMAP.md` have been implemented:
- P0: ads.txt, duplicate video block, OAuth state epoch fix, ratio gate
- P1: Self-watch block, channel source-of-truth unification, magic-word verification, 3 misleading reports → auto-pull
- P2: Platform-aware AI, cohort leaderboards, review-of-review, streaming AI, quiet hours, daily bonus with streak multiplier, anomaly scoring, multi-account channel conflict detection
- P3: Mission chains, auto badge awards, cohort retention view, email digests, Logpush observability, Android share-target

---

*This document is the complete reference for the LoopSquad application. It covers every user case, story, flow, action, connection, database table, API endpoint, integration, rule, and architectural decision.*
