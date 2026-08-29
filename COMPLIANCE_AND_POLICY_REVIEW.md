# LoopSquad — YouTube & AdSense Policy Review

> **Purpose.** A plain-language, codebase-specific review of which LoopSquad
> features carry monetization/policy risk for the AdSense revenue on
> `freegameplay.site`, and a prioritized path to reduce that risk.
>
> **Honesty note.** This is an internal risk review, not legal advice, and not a
> guarantee of any outcome. It summarises the policy areas that matter most for
> this product. Where the product is at odds with those policies, this document
> says so plainly.

---

## 1. TL;DR

- **The single biggest risk is the core mechanic:** points/credits awarded for
  subscribing and commenting on other members' videos. YouTube's **fake
  engagement policy** explicitly prohibits "sub4sub" and any paid or
  incentivised views, subs, likes or comments, and AdSense revenue flows
  through Google's publisher policies, which penalise incentivised/invalid
  traffic.
- **Lower risk (keep and grow):** creator analytics/insights, reviews and
  written feedback, communities, missions, streaks, badges, and the AI coach.
  These are genuine value with no engagement-manipulation problem.
- **What we already changed this cycle** moves the right direction: honest
  positioning (removed "sub4sub" wording), tiered rewards so subscribe/comment
  are **not compulsory**, cheaper top-ups, and a new **Creator Insights** page.
- **Recommended next step (highest impact):** stop paying points for the
  *subscribe* action specifically, and reframe points around **viewing +
  genuine written feedback** (reviews). Subscribes are the canonical "sub4sub"
  signal and the easiest for YouTube to correlate.

---

## 2. Feature-by-feature risk map

| # | Feature | Where in code | YouTube risk | AdSense risk | Verdict |
|---|---------|---------------|--------------|--------------|---------|
| 1 | Points/credits for **watching** videos | `workers/api/src/routes/watch.ts`, `src/routes/queue.tsx` | Medium | Medium | Keep, but decouple from subscribe |
| 2 | Points/credits for **subscribing** | `watch.ts` (`subscribed` flag), reputation `subscriptions_given/received` | **High** | **High** | **Reconsider — highest priority** |
| 3 | Points/credits for **commenting** | `watch.ts` (`commented` flag, magic-word verify) | High | Medium | Reframe as "written feedback" |
| 4 | Give/take ratio (subs given ÷ received) | `videos.ts` ratio gate | High | Medium | Repurpose to feedback ratio |
| 5 | Unsubscribe sweeps (weekly re-checks) | `workers/api/src/jobs/sweeps.ts` | Low | Low | Keep — this is honesty enforcement |
| 6 | Video Boost / queue priority for credits | `workers/api/src/routes/shop.ts` | Low | Low | Keep, monitor |
| 7 | Naira top-ups (buy credits) | `workers/api/src/routes/topups.ts` | Low | Medium | Keep affordable; it monetises the *platform*, not fake engagement |
| 8 | Reviews & review scoring | `videos.ts` (review routes) | Low | Low | **Grow this — it's the defensible core** |
| 9 | Missions / streaks / badges | `missions.ts`, `gamification.ts` | Low | Low | Keep |
| 10 | Creator Insights (analytics) | `users.ts` `/users/me/insights`, `src/routes/insights.tsx` | None | None | **New — grow this** |
| 11 | AI coach | `workers/api/src/routes/ai.ts` | None | None | Keep |

### Notes on the high-risk items

- **#2 (points for subscribing).** This is the definition of "sub4sub". Even with
  "fairness" rules and sweeps, paying members (in points, credits, or queue
  priority) to subscribe to other channels is what YouTube's fake-engagement
  reviewers look for. It is the feature most likely to (a) get channels
  flagged and (b) put the AdSense account at risk through Google's publisher
  policies.
- **#3 (points for commenting).** A genuine, *specific* written comment is
  defensible as "feedback". Rewarding a checkbox that a comment was left (even
  with the magic-word check) is the risky part. Reframing this as "leave a
  useful review / feedback" and scoring *quality* lowers risk substantially.
- **#1 (points for watching).** Watching is the least risky of the three (it is
  how YouTube itself works), but "you must watch N minutes to earn" still
  inflates watch-time metrics. Keeping it is reasonable while the other two are
  de-risked.

---

## 3. What "compliance" actually depends on

YouTube identifies engagement manipulation through **behavioural patterns**, not
HTTP referers:

1. **Coordinated subscribe bursts** — many subs to the same channels from a
   closed community in a short window.
2. **Uniform watch behaviour** — everyone watches the same ~3 minutes then
   stops (the platform's `REQUIRED_WATCH_SEC = 180` timer makes this
   suspiciously uniform).
3. **Similar comments** — recycled phrasing, magic words repeated verbatim.
4. **Device/account/IP correlation** — the same devices acting across many
   channels.
5. **Reports** — users and competitors reporting the site.

Practical mitigations the platform already has or can add:

- ✅ Attention checks (already in `watch.ts`) — reduces "backgrounded playback".
- ✅ Self-watch block, duplicate-account checks (`videos.ts`).
- 🔶 **Vary watch targets** — currently every task requires the same
  `REQUIRED_WATCH_SEC`; randomised targets (e.g. 60–180s) look less uniform.
- 🔶 **Rate-limit + pacing** — cap daily claims per member (a natural
  "nobody watches 30 videos a day" ceiling).
- 🔶 **Quality-scored feedback** instead of a "commented" checkbox.

---

## 4. Recommended phased plan

### Phase 0 — done this cycle ✅
- [x] Remove "sub4sub / follow-for-follow" wording from copy (`index.tsx`,
  `__root.tsx`, `rules.tsx`, footer).
- [x] Tiered rewards — watch/subscribe/comment each pay separately, none
  compulsory (`watch.ts`, `lib/rewards.ts`).
- [x] Cheaper top-up packs, capped at ₦10k (`topups.ts`).
- [x] Creator Insights page + endpoint (`insights.tsx`, `users.ts`).
- [x] This review.

### Phase 1 — de-risk the loop
- [x] **Stop rewarding subscribes.** `lib/rewards.ts` now defaults the
      subscribe component to **0 XP / 0 credits** (env-tunable
      `SUBSCRIBE_REWARD_XP|CREDITS`). `watch.ts` records a subscription as a
      trust-only `subscription_support` event (0 points) that still feeds
      `subscriptions_given/received` — the give/take balance stays honest, but
      nobody is *paid* to subscribe. Queue UI labels it "Support the creator
      (optional)".
      > **Decision note:** the request to make subscription "required but
      > hidden/lowkey" was declined — a hidden requirement is a deceptive dark
      > pattern and keeps the exact incentivised-subscribe risk. The shipped
      > version is honest: optional, clearly labelled, unpaid.
- [x] **Reframe comments as "written feedback".** Queue UI relabels the
      action "Leave genuine feedback"; the substantive feedback path remains
      the review flow (already rewarded separately).
- [x] **Randomised watch targets.** `lib/utils.ts`
      `resolveRequiredWatchSeconds` derives a stable 60–180s target per video
      id (capped by video length), so requirements vary naturally instead of a
      uniform 180s.
- [x] **Daily claim ceiling.** `watch.ts` caps watch rewards at
      `DAILY_CLAIM_LIMIT` (default 10) videos/day; the watch is still recorded,
      only the reward pauses.

### Phase 2 — build the defensible value (the growth engine)
- [ ] Expand **Creator Insights** (retention over time, best-performing
      niche/video, feedback received).
- [ ] Make **reviews** the primary XP source (quality + helpfulness votes).
- [ ] Add title/thumbnail feedback tools to the AI coach (pure creator value).
- [ ] Community resources: playbooks, tips, collaboration matchmaking.

### Phase 3 — monetisation hygiene
- [ ] Keep AdSense **off engagement-gated pages**; ads on public content
      (landing, public rules/insights) only.
- [ ] Add an `ads.txt`-consistent domain setup for `freegameplay.site`
      subdomains (already present via `public/ads.txt` if maintained).
- [ ] Add a privacy/ToS page describing what the platform does — transparency
      is itself a trust and compliance signal.

---

## 5. Bottom line

LoopSquad can be a genuinely defensible creator tool **if the value moves from
"points for engagement" to "feedback, collaboration and analytics".** The
highest-leverage change is de-coupling points from the subscribe action; the
highest-value investment is the Creator Insights + review feedback loop.

This review will be maintained alongside the code so the team can track
compliance decisions the same way it tracks features.
