# 30 — Android workstream (AND)

**Purpose:** ship a **fully native Android app** — Kotlin + Jetpack Compose, native navigation,
native notifications, native billing, native performance — that is the primary daily surface for
the audience the product is built for.

**Read this first:** [ADR-001 — native, not a WebView wrapper](#adr-001--fully-native-kotlin--compose-not-a-webview-wrapper)
and [§3 The single justified WebView](#3-the-single-justified-webview-the-youtube-player).

**Master plan:** [../ROADMAP.md](../ROADMAP.md) · **Findings:** [00-audit-and-baseline.md](00-audit-and-baseline.md)
**Hard dependencies:** [10-platform-api.md](10-platform-api.md) — contract (PLAT-003/007), device push (PLAT-020…024),
blocking (PLAT-013), idempotency (PLAT-010), app config (PLAT-014), consent (SEC-028).

---

## 1. Non-negotiables

| #   | Rule                                                                                                                                                              | Consequence if violated                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| N1  | 100 % of UI is Compose. No remote web UI, no Cordova/Capacitor/WebView shell, no "load the site".                                                                 | Becomes a wrapper app: rejected in review, and loses native performance, accessibility and offline. |
| N2  | Exactly **one** WebView exists in the entire app, inside `feature:player`, hosting only the YouTube IFrame player (see §3). Any second WebView fails code review. | Scope creep back to a website-in-a-box.                                                             |
| N3  | Every screen works offline for reads with a visible staleness stamp; queued writes are explicit.                                                                  | Unusable on the metered/intermittent networks the audience actually has.                            |
| N4  | All rewards, tiers, prices and permissions come from the server. The app never computes a payout.                                                                 | Cheatable client, app-store review risk, financial inconsistency.                                   |
| N5  | No background YouTube playback and no audio-only mode.                                                                                                            | YouTube Terms of Service violation (and a fast policy strike).                                      |
| N6  | Digital goods are sold through Google Play Billing only. Manual NGN top-ups are web-only.                                                                         | Payments-policy rejection (F-30).                                                                   |
| N7  | Report **and** block on every UGC surface.                                                                                                                        | UGC policy rejection (F-06).                                                                        |
| N8  | TalkBack-complete, 48 dp targets, 200 % font scaling, no colour-only state.                                                                                       | Accessibility failure and a store-quality complaint pattern.                                        |
| N9  | minSdk 26, targetSdk 36 (Android 16 baseline required for new apps in 2026), 64-bit only, no NDK unless justified.                                                | Store submission rejection / device reach loss.                                                     |
| N10 | Crash-free sessions ≥99.5 %, cold start ≤1.5 s p50 on a mid-tier device, download ≤25 MB.                                                                         | Retention collapse on low-end hardware.                                                             |

---

## 2. Architecture decisions

### ADR-001 — Fully native Kotlin + Compose, not a WebView wrapper

**Decision:** native Android app in Kotlin, Jetpack Compose, single-activity, Navigation Compose,
Hilt DI, Room + DataStore, OkHttp + generated API client, FCM push, Play Billing.

**Why:** the product's value is _verified watching_ and _timely nudges_, both of which need
platform capabilities a wrapper cannot reach: foreground/audio-focus awareness, battery-safe
background sync, FCM delivery, Play Integrity attestation, Play Billing, App Links, widgets and
real offline storage. The web bundle is 940 kB of JS for a marketing SPA — importing that as the
app shell would be the worst of both worlds.

**Rejected alternatives**

| Option                                                          | Why rejected                                                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capacitor / Cordova / WebView shell                             | Review risk ("minimum functionality"), no real offline, no attestation, poor accessibility, unverifiable watch time.                                                      |
| React Native / Expo                                             | Viable team-wise, but Compose gives better list/player performance and a smaller binary; also duplicates the web's styling problems instead of using Material 3 natively. |
| Flutter                                                         | Excellent performance, but adds a third language/toolchain to a TS + Kotlin team and loses first-class Firebase/Play Billing ergonomics.                                  |
| Kotlin Multiplatform with Compose Multiplatform (web + Android) | Tempting long-term (one UI codebase), but the web app already exists and is good; a rewrite would burn a quarter and a half. Revisit for iOS (AND-120).                   |
| PWA only                                                        | Push on iOS is limited, no Play Store presence, no billing, no attestation, and Android users expect an installable app.                                                  |

### ADR-002 — Module layout

```
android/
├── app/                       # single Activity, NavHost, DI graph root, flavors
├── build-logic/               # convention plugins (android-app, android-library, compose, hilt, feature)
├── core/
│   ├── model/                 # pure Kotlin domain models (no Android, no JSON)
│   ├── network-api/           # GENERATED from OpenAPI (PLAT-007) — never hand-edited
│   ├── network/               # OkHttp, auth interceptor, retry, error mapping, SSE
│   ├── data/                  # repositories, mappers, Room DAOs, outbox, sync engine
│   ├── datastore/             # prefs, auth metadata, locale, flags cache
│   ├── designsystem/          # tokens, typography, components, icons, previews
│   ├── ui/                    # shared composables (ErrorState, EmptyState, StatCard, Thumb)
│   ├── auth/                  # Firebase Auth + Credential Manager, session manager
│   ├── analytics/             # typed event façade (Analytics, Crashlytics, Performance)
│   ├── integrity/             # Play Integrity client
│   └── testing/               # fakes, fixtures, dispatcher rules, MockWebServer harness
└── feature/
    ├── launch/ auth/ dashboard/ queue/ player/ submit/ communities/ missions/
    ├── reviews/ leaderboard/ gamification/ notifications/ profile/ settings/
    ├── ai/ shop/ insights/ search/ support/
    └── moderation/            # phone-adaptive moderation subset (see AND-057)
```

Rules: features depend on `core:*` only; features never depend on each other (navigate via
contracts in `core:ui`); `core:network-api` is generated and excluded from lint rules;
`core:model` stays Android-free so it can move to KMP later.

### ADR-003 — Offline-first data flow

```
UI (Compose) ──StateFlow── ViewModel ──Flow── Repository ──┬── Room (cache, single source of truth)
                                                          ├── Network (generated client)
                                                          └── Outbox (queued writes, WorkManager)
```

- Reads: emit cache immediately (`Loading → Cached(staleAt) → Fresh`), refresh in background.
- Writes: optimistic where safe (notification read, quest claim is _not_ optimistic — it is
  money), otherwise `Pending` state with retry, keyed by an `Idempotency-Key` generated on the
  device and persisted with the outbox row.
- Conflicts: server wins; the UI explains what changed (e.g. "this mission was already claimed").

### ADR-004 — The player and watch verification

The Android YouTube Player API was deprecated and cannot embed arbitrary videos; the supported
embedding method is the **YouTube IFrame Player API**. Therefore the player is a Compose
`AndroidView` wrapping a `WebView` that loads a self-hosted HTML page (bundled in
`feature:player/src/main/assets/player.html`) using the IFrame API, communicating with Kotlin over
`addJavascriptInterface`.

Verification chain (feeds SEC-010…SEC-014):

```
native start → POST /watch/start → { sessionToken }
opening the player → JS bridge reports state/time → native sends POST /watch/heartbeat every 30 s
claim → POST /watch { sessionToken } → server recomputes verified seconds from heartbeats
       → server (not the app) decides the payout
```

The app's job is to produce **honest evidence**, never to assert the reward.

### ADR-005 — Push, billing, integrity

| Capability | Choice                                                                                                                                        | Server side                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Push       | Firebase Cloud Messaging, one channel per notification category; token registered on login, removed on logout                                 | `POST /notifications/devices`, FCM HTTP v1 from the Worker (PLAT-020…024) |
| Billing    | Google Play Billing (`billing-ktx`), credit packs + "Squad Pro" subscription; purchase token verified server-side with the Play Developer API | New `routes/billing.ts`, `play_purchases` table, idempotent credit grant  |
| Integrity  | Play Integrity standard request with a server nonce, cached verdict, risk tier attached to watch claims                                       | `lib/attestation.ts` (SEC-014)                                            |
| Config     | `/app/config` for flags, min version, maintenance                                                                                             | PLAT-014/026                                                              |

### ADR-006 — Toolchain baseline

Pin at kickoff and record in `android/gradle/libs.versions.toml`; Renovate proposes updates weekly.

| Item          | Baseline                                                                                   | Note                           |
| ------------- | ------------------------------------------------------------------------------------------ | ------------------------------ |
| JDK           | 17 toolchain                                                                               | AGP requirement                |
| Kotlin        | current stable (2.2+) with K2                                                              | verify at kickoff              |
| AGP / Gradle  | current stable, Gradle configuration cache on                                              | verify at kickoff              |
| Compose       | Compose BOM (latest) + Material 3                                                          | no Material 2                  |
| DI            | Hilt + KSP                                                                                 | no kapt                        |
| Serialization | kotlinx.serialization                                                                      | matches generated client       |
| HTTP          | OkHttp + generated client                                                                  | SSE via OkHttp streaming       |
| Persistence   | Room (KSP) + DataStore Proto/Preferences                                                   | no SQLDelight (JVM-only needs) |
| Images        | Coil 3                                                                                     | `contentScale`, placeholders   |
| Paging        | Paging 3 with cursor keys                                                                  | stable pagination (PLAT-016)   |
| WorkManager   | Hilt worker factory, unique work names                                                     | periodic ≥15 min               |
| Charts        | Vico (native Compose)                                                                      | never a WebView chart          |
| Testing       | JUnit5 or JUnit4 + Turbine + MockK + Roborazzi + Compose UI test + Macrobenchmark          | screenshot tests gate PRs      |
| Quality       | detekt + ktlint (spotless), `lint` with `warningsAsErrors` on release, dependency analysis | convention plugin              |

---

## 3. The single justified WebView (the YouTube player)

A WebView is acceptable **only** here, and only under these constraints:

1. It loads `file:///android_asset/player.html` via `loadDataWithBaseURL("https://loop.freegameplay.site", html, …)`.
   Loading from `file://` or `data:` causes YouTube embed **error 153** (missing referrer/origin).
2. The page includes `origin=https://loop.freegameplay.site` on the embed URL and `enablejsapi=1`.
3. JavaScript is enabled; file access, universal access from file URLs and mixed content are
   **disabled**; navigation outside the embed is blocked via `shouldOverrideUrlLoading`.
4. The bridge exposes a **whitelisted**, non-privileged surface only:

| JS → Kotlin                                  | Payload                     | Kotlin → JS                        |
| -------------------------------------------- | --------------------------- | ---------------------------------- |
| `onReady(videoId)`                           | videoId                     | `play()`, `pause()`, `seekTo(sec)` |
| `onState(state)`                             | `-1,0,1,2,3,5`              | `getCurrentTime()` (pull)          |
| `onTick(currentTime, duration, rate, muted)` | numbers, 1 Hz while playing | `setVolume(0..100)`                |
| `onError(code)`                              | YouTube error code          | `destroy()`                        |
| `onEnded()`                                  | —                           | —                                  |

5. **No** playback while the app is not in the foreground: on `ON_PAUSE` the app calls `pause()`.
   Keep-screen-on is applied only while playing. No PiP, no background audio, no downloads.
6. The WebView is destroyed with the screen; no cookies are persisted across sessions
   (`CookieManager` cleared on sign-out), no third-party storage.
7. A visible fallback: if JS never reports `onReady` within 12 s, show "Open in YouTube"
   (intent to the app, web fallback) plus a native explanation — never a blank black rectangle.

**Why this is not "a web view app":** every pixel outside this player is native Compose; the
WebView has no navigation, no app data, no session, and exists because YouTube mandates an HTML
embed. It is a media surface, not a UI framework.

---

## 4. Design language on Android

- **Parity with brand, native in idiom:** same palette/typography family as `src/styles.css`, but
  Material 3 components, Android ripples, edge-to-edge and predictive back — not a pixel-clone of
  the website.
- **Bottom navigation (4 + more):** Home · Queue · Submit (centre FAB-like) · Rewards · Profile.
  Missions, communities, reviews, leaderboard, AI, shop live in Home shortcuts and the Rewards hub.
- **Motion:** Compose motion with `prefers-reduced-motion` equivalent (`Settings.Global.ANIMATOR_DURATION_SCALE`),
  shared-element transition from queue card → player, ≤300 ms.
- **Feedback is tactile:** claim success haptic + reward reveal sheet; failures never silent.
- **Data-aware:** thumbnails in three quality tiers; a visible "data saver" toggle in settings.

---

## 5. Screen map (web → Android)

| Web route                          | Android destination              | Phase | Notes                                                    |
| ---------------------------------- | -------------------------------- | ----- | -------------------------------------------------------- |
| `/` (landing)                      | Sign-in / onboarding             | AND-B | No marketing in-app; a 2-screen value intro with sign-in |
| `/dashboard`                       | `Home`                           | AND-B | Native cards, streak ring, next-action CTA               |
| `/queue` + `?videoId=`             | `Queue` → `Player`               | AND-B | Deep link straight into the player                       |
| `/submit`                          | `Submit`                         | AND-B | Also the `ACTION_SEND` target for shared YouTube links   |
| `/communities`, `/communities/:id` | `Communities`, `CommunityDetail` | AND-B | Invite share sheet                                       |
| `/missions`                        | `Missions`                       | AND-B | Chains, progress, claim                                  |
| `/reviews`, `/reviews/:id`         | `Reviews`, `ReviewDetail`        | AND-C | Structured answers                                       |
| `/leaderboard`                     | `Leaderboard`                    | AND-C | Paging + my-rank sticky header                           |
| `/gamification`                    | `Rewards` hub                    | AND-C | Badges, trust, levels, shop entry                        |
| `/insights`                        | `Insights`                       | AND-C | Vico charts                                              |
| `/ai`                              | `Coach`                          | AND-C | Streaming, quota handling                                |
| `/shop`                            | `Shop`                           | AND-C | Credits + Play Billing packs                             |
| `/notifications`                   | `Inbox`                          | AND-B | FCM + inbox                                              |
| `/profile`, `/@handle`             | `Profile` (+ member profile)     | AND-B | Edit, public toggle                                      |
| `/settings`                        | `Settings`                       | AND-B | Includes security/devices, privacy, delete account       |
| `/support`, reports/appeals        | `Support`                        | AND-C | Report + block everywhere                                |
| `/admin`                           | `Moderation` (subset)            | AND-C | Reports, appeals, top-ups; analytics stays web           |
| `/search`                          | `Search`                         | AND-C | Global search, debounced                                 |
| `/rules`, `/privacy`, `/terms`     | `Legal` (in-app, cached)         | AND-D | Also required in store listing                           |

---

## 6. Task plan

Status legend: ✅ done · 🟡 partial · ⬜ to do · 🔒 blocked

### Phase AND-A — Foundations (M1 → M2)

**Exit gate:** a signed debug build runs on a physical API 26 device and an API 36 emulator,
authenticates with Google against staging, renders the design-system gallery, reports to
Crashlytics, and publishes to the Play internal track from CI.

| ID      | Task                                                                                                                                                                                                                                                                       | Status | Why                                                                                                   | Done when                                                                                                                                | Touches / integrates                     | Effort (d) | Depends           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------- | ----------------- |
| AND-001 | Create `android/` Gradle project: settings, root build, `build-logic` convention plugins, wrapper, `.editorconfig`.                                                                                                                                                        | ⬜     | Every later task inherits these conventions; retrofitting them costs weeks.                           | `./gradlew help` works from a clean clone; `build-logic` applies `android-app`, `android-library`, `compose`, `hilt`, `feature` plugins. | new `android/` tree                      | 2          | —                 |
| AND-002 | Application identity: `applicationId`, namespace, versionCode scheme (`major*10000 + minor*100 + patch`), minSdk 26 / target+compile 36, 64-bit only.                                                                                                                      | ⬜     | Store identity is permanent once published; SDK targets gate submission (N9).                         | Manifest builds; `bundleRelease` validates targetSdk 36; documented scheme in `android/README.md`.                                       | `app/build.gradle.kts`                   | 1          | AND-001           |
| AND-003 | Version catalog + dependency governance: all deps in `libs.versions.toml`, no dynamic versions, Renovate PRs, dependency-analysis plugin.                                                                                                                                  | ⬜     | Unmanaged dependency growth is the top cause of build rot.                                            | `./gradlew buildHealth` clean; Renovate configured; catalog is the only place versions appear.                                           | `libs.versions.toml`, Renovate           | 1          | AND-001           |
| AND-004 | Module skeleton (only modules that get code): `:app`, `:core:{model,network-api,network,data,datastore,designsystem,ui,auth,analytics,integrity,testing}`, `:feature:{launch,auth,dashboard}` initially.                                                                   | ⬜     | Boundaries prevent the "one giant app module" outcome and enable parallel work.                       | Modules compile with enforced dependency rules (fail on feature→feature).                                                                | `settings.gradle.kts`                    | 2          | AND-002           |
| AND-005 | Environments: flavors `dev`/`staging`/`prod` with base URLs, Firebase app per flavor, `BuildConfig` fields, and a runtime `EnvConfig`.                                                                                                                                     | ⬜     | Testing against production by accident is how test data pollutes real ledgers.                        | Three installable variants side by side; staging build shows a coloured debug banner; no production key in dev.                          | `app/build.gradle.kts`, `core/datastore` | 2          | AND-002           |
| AND-006 | Consume the generated API client (`core:network-api`) from PLAT-007; wrap it in repository interfaces so features never touch generated code.                                                                                                                              | ⬜     | Guarantees contract parity with web and isolates regeneration churn (F-09).                           | Regenerating the spec compiles without touching feature code; `core:data` exposes domain models only.                                    | `core/network-api`, `core/data`          | 2          | PLAT-007          |
| AND-007 | Hilt graph: `@HiltAndroidApp`, dispatchers module (`@IoDispatcher`), clock abstraction (injectable `Clock` for watch verification tests).                                                                                                                                  | ⬜     | Testable time and dispatchers are prerequisites for deterministic verification tests.                 | App starts with Hilt; unit tests inject a fake clock.                                                                                    | `app`, `core/common`                     | 1          | AND-004           |
| AND-008 | Networking stack: OkHttp timeouts (10 s connect / 30 s read), platform headers (`X-Client-Platform: android`, version, locale), retry interceptor (idempotent + `Retry-After`), request-id capture.                                                                        | ⬜     | Mobile networks fail often; retries must be safe and diagnosable (PLAT-011/015).                      | Recorded MockWebServer tests cover timeout, 429 with `Retry-After`, 503, and request-id surfacing.                                       | `core/network`                           | 3          | AND-006           |
| AND-009 | Auth interceptor + token provider: attach Firebase ID token, refresh once on 401, replay exactly once, never loop.                                                                                                                                                         | ⬜     | Token expiry mid-flight must be invisible; a loop burns quota and battery.                            | Instrumented test with a fake provider covers refresh + single replay; no duplicate request storm.                                       | `core/auth`, `core/network`              | 2          | AND-008           |
| AND-010 | Firebase Auth + Credential Manager Google Sign-In: SHA-1/SHA-256 (debug, upload, Play App Signing) registered, sign-in/out, account state `Flow`.                                                                                                                          | ⬜     | Identity is the first screen; a broken sign-in is a 100 % blocker.                                    | Sign-in works on a physical device for dev and staging Firebase projects; sign-out clears tokens and cached data.                        | Firebase console, `core/auth`            | 3          | AND-009           |
| AND-011 | Sign-in + onboarding UI: value proposition, privacy/terms links, consent & age gate (SEC-028), error states for offline/blocked accounts.                                                                                                                                  | ⬜     | This is the first impression and the consent evidence trail.                                          | Completes in ≤3 taps; blocked-account screen shows the server reason; TalkBack labels present.                                           | `feature:auth`, `feature:launch`         | 3          | AND-010, PLAT-028 |
| AND-012 | DataStore: auth metadata, onboarding flag, theme, locale, notification opt-in, last successful sync per section.                                                                                                                                                           | ⬜     | Local state must survive process death; drives offline UX.                                            | Values persist across force-stop; migration test from an empty install.                                                                  | `core/datastore`                         | 1          | AND-007           |
| AND-013 | Room schema v1: `dashboard_snapshot`, `queue_items`, `communities`, `missions`, `notifications`, `videos`, `outbox`, `flags`.                                                                                                                                              | ⬜     | Offline-first needs a real store, not in-memory caches (N3).                                          | Schema exported to `schemas/`; DAO tests cover upsert/evict/TTL; migration test harness in place.                                        | `core/data`                              | 3          | AND-012           |
| AND-014 | Repository + sync pattern: `Flow<Resource<T>>` with `Loading/Cached(staleAt)/Fresh/Error`, cache-first reads, background refresh, manual refresh.                                                                                                                          | ⬜     | Consistency across 15 features requires one pattern, not 15 improvisations.                           | A single `Repository` base class used by all features; a test asserts cached-then-fresh emission order.                                  | `core/data`                              | 3          | AND-013           |
| AND-015 | Design system: colour tokens (dark + light), type scale, spacing, elevation, and 14 components (`PrimaryButton`, `LoopCard`, `StatTile`, `ProgressRing`, `Chip`, `Badge`, `EmptyState`, `ErrorState`, `Skeleton`, `BottomBar`, `TopBar`, `Avatar`, `VideoThumb`, `Sheet`). | ⬜     | UI consistency and velocity; prevents per-screen styling drift from the web brand.                    | `/design`-style debug gallery screen; every component has `@Preview` for light/dark/large-font.                                          | `core/designsystem`                      | 5          | AND-004           |
| AND-016 | Navigation: type-safe destinations, nested graphs, bottom bar (Home/Queue/Submit/Rewards/Profile), deep-link intents declared.                                                                                                                                             | ⬜     | The information architecture is the skeleton of the whole app.                                        | Every destination reachable; predictive back correct; no dead ends; NavHost tests for 8 routes.                                          | `app`, `core/ui`                         | 3          | AND-015           |
| AND-017 | App shell: edge-to-edge with insets, `enableEdgeToEdge()`, snackbar host, global loading overlay, connectivity banner.                                                                                                                                                     | ⬜     | targetSdk 36 forces edge-to-edge; doing it at the shell level prevents per-screen hacks.              | No content under system bars in 3 nav modes (gesture, 3-button, with keyboard open).                                                     | `app`                                    | 2          | AND-016           |
| AND-018 | Error model: `AppError` sealed hierarchy mapped from the shared error registry; global handler; debug panel showing requestId + code.                                                                                                                                      | ⬜     | Members need actionable messages; support needs a code to act on (PLAT-008/015).                      | 12 codes mapped with tests; no raw server strings in UI; debug panel reachable in debug builds only.                                     | `core/model`, `core/network`             | 2          | AND-008           |
| AND-019 | Analytics + crash + performance façade: Firebase Analytics events matching the web catalogue, Crashlytics with user tier (no PII), startup/screen traces.                                                                                                                  | ⬜     | Without measurement the Android roadmap cannot prove anything (F-36).                                 | Events visible in DebugView; a forced crash appears with release SHA and route; 5 traces recorded.                                       | `core/analytics`                         | 2          | AND-007           |
| AND-020 | App bootstrap gate: read `/app/config`, enforce min version/force update, cache flags, show maintenance screen, seed flags into the app graph.                                                                                                                             | ⬜     | The only way to retire a bad release or stop a broken feature (PLAT-014/026).                         | Debug build with a fake minVersion shows the blocking update screen; flags refresh in ≤60 s.                                             | `feature:launch`, `core/datastore`       | 2          | AND-012           |
| AND-021 | Android CI: Gradle cache, `lint`, `detekt`, `ktlintCheck`, unit tests, `assembleDebug` + `bundleRelease`, screenshot tests, dependency-analysis, artifact upload.                                                                                                          | ⬜     | Green CI from day one; retrofitting quality gates later never happens.                                | CI green on a PR in <12 min; a deliberate detekt violation fails the build.                                                              | `.github/workflows/android.yml`          | 2          | AND-003           |
| AND-022 | Play Console setup: create app, Play App Signing, upload keystore in GitHub secrets, internal testing track, CI service account, store listing skeleton.                                                                                                                   | ⬜     | Play identity, signing and tracks are prerequisites for every later rollout (and are slow to set up). | Internal-track build published from CI; app installs from Play on a tester device.                                                       | Play Console, CI secrets                 | 2          | AND-021           |
| AND-023 | Release automation: version bump script, changelog from conventional commits, `bundleRelease` signed, upload to internal/closed track, tag `android-vX.Y.Z`.                                                                                                               | ⬜     | Manual release steps cause versionCode collisions and unsigned bundles.                               | One workflow dispatch publishes, tags, and posts the changelog.                                                                          | CI, Play API                             | 2          | AND-022           |
| AND-024 | Developer documentation: setup, flavors, emulator profiles, test commands, release runbook, module rules.                                                                                                                                                                  | ⬜     | A second engineer (or an agent) must be productive on day one.                                        | `android/README.md` lets a new contributor build and test in ≤30 min.                                                                    | docs                                     | 1          | AND-001           |
| AND-025 | Baseline metrics: cold start, APK/AAB size, frame timings on a mid-tier device, recorded as targets and tracked per release.                                                                                                                                               | ⬜     | You cannot improve what you never measured.                                                           | Dashboard row per release; CI writes macrobenchmark results as an artifact.                                                              | CI, Macrobenchmark                       | 1          | AND-021           |

### Phase AND-B — Core loop MVP (M2)

**Exit gate:** a real member can install from the internal track, sign in, receive a video, watch
it with verified heartbeats, claim a reward, submit their own video, and get a push when someone
reviews it — with no web fallback.

| ID      | Task                                                                                                                                                                     | Status | Why                                                                                                            | Done when                                                                                                                                   | Touches / integrates                  | Effort (d) | Depends           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------- | ----------------- |
| AND-030 | Home: greeting, streak ring, XP/level, credits, daily quests with claim, "next best action", community activity strip.                                                   | ⬜     | The daily-open surface; must answer "what should I do now?" in one glance.                                     | Cold start → actionable Home in ≤1.5 s; cached offline; each card deep-links.                                                               | `feature:dashboard`                   | 4          | AND-014, AND-015  |
| AND-031 | Queue: cursor-paginated list, filters (community, niche, length), "why you're seeing this", remaining claims today, pull-to-refresh, offline banner.                     | ⬜     | This is the core labour loop; churn here kills the product.                                                    | Paging 3 with cursor keys; 100-item scroll jank <1 %; filters persisted; empty state offers submit.                                         | `feature:queue`, PLAT-016             | 4          | AND-014           |
| AND-032 | Player screen shell: full-screen, landscape, keep-screen-on while playing, audio focus handling, lifecycle pause, error/offline surfaces.                                | ⬜     | Playback is the product; lifecycle bugs here waste members' time and trust.                                    | Rotating, backgrounding and losing audio focus all pause playback and heartbeats within 1 s.                                                | `feature:player`                      | 3          | AND-016           |
| AND-033 | YouTube IFrame WebView component + JS bridge per §3, with base-URL/origin fix, blocked navigation, and 12 s fallback.                                                    | ⬜     | Only supported embed path; the origin fix prevents the silent embed-153 failure.                               | Plays on API 26 and 36; bridge events logged; navigation outside embed blocked; fallback shows an "Open in YouTube" action.                 | `feature:player/assets/player.html`   | 5          | AND-032           |
| AND-034 | Watch session manager: `POST /watch/start`, heartbeat loop (30 s, foreground only), `SystemClock.elapsedRealtime` accounting, pause/resume, resume-after-call behaviour. | ⬜     | Produces the evidence the server pays on (SEC-011/012); without it, claims are self-reported and worthless.    | Server logs one heartbeat stream per session; backgrounding stops heartbeats; a 3-minute watch yields ≥180 verified seconds.                | `feature:player`, `core:data`         | 4          | AND-033, SEC-011  |
| AND-035 | Claim flow: `POST /watch` with session token, magic-word entry with deep link to comment, optional subscribe signal, reward reveal sheet, already-claimed/limit states.  | ⬜     | The moment of value; must feel immediate and must never double-pay.                                            | Reward reveal shows server-returned deltas only; replaying claim shows "already claimed"; daily-limit copy is actionable.                   | `feature:player`, SEC-013             | 3          | AND-034           |
| AND-036 | Attention challenge overlay: appears per server schedule, accessible input, countdown, failure explanation with appeal link.                                             | ⬜     | Anti-cheat UX decides whether honest members feel accused or protected.                                        | Pass/fail/void paths tested; overlay is TalkBack readable; no input loss on rotation.                                                       | `feature:player`                      | 2          | AND-034           |
| AND-037 | Submit video: paste URL, `ACTION_SEND` share-target entry, validation, metadata preview, niche/magic word, cooldown and ratio errors explained with the exact rule.      | ⬜     | "Submit" is the supply side of the loop; share-intent entry removes the copy/paste friction that loses people. | Submitting from the YouTube app's share sheet works in ≤3 taps; duplicate/cooldown errors are human-readable; draft survives process death. | `feature:submit`                      | 4          | AND-014, PLAT-010 |
| AND-038 | Communities: list, detail (members, rules, activity, join state), join by code, ask-to-join, leave, invite share sheet.                                                  | ⬜     | Squads are the unit of retention and the WhatsApp growth loop.                                                 | Join/leave/request flows all work; invite sheet shares a deep link; rules render from server.                                               | `feature:communities`                 | 4          | AND-014           |
| AND-039 | Missions + chains: list, detail, assign, progress, claim, completed state, "how to progress" hints.                                                                      | ⬜     | Missions give the second session a purpose after the first claim.                                              | Assignment and payout are server-authoritative; claim replay shows the original result.                                                     | `feature:missions`                    | 3          | AND-014           |
| AND-040 | Notifications: FCM service, 6 channels (rewards, reviews, money, moderation, community, digest), token register/unregister, inbox with unread badge, deep-link on tap.   | ⬜     | Push is the retention engine; wrong-channel pushes get muted forever.                                          | Notifications arrive foreground/background/terminated; tapping opens the right screen; logout unregisters the token.                        | `feature:notifications`, PLAT-021/024 | 3          | AND-020, PLAT-022 |
| AND-041 | Profile: own profile (stats, badges, videos), edit display name/bio/avatar, public-profile toggle, member profiles with privacy respected.                               | ⬜     | Identity and shareable reputation; a private profile must not leak.                                            | Edit round-trips; private profile renders an explanation, not an error; avatar upload ≤2 MB with client-side downscale.                     | `feature:profile`                     | 3          | AND-014           |
| AND-042 | Settings v1: theme, notification channels, privacy, connected YouTube, legal, sign out, delete account (typed confirmation).                                             | ⬜     | Store policy requires in-app deletion; members need control.                                                   | Deletion completes end-to-end in staging; sign-out clears cache and tokens.                                                                 | `feature:settings`, SEC-026           | 3          | AND-041           |
| AND-043 | Deep links + App Links: `/queue?videoId`, `/reviews/:id`, `/c/:slug`, `/@handle`, `/invite/:code`; `assetlinks.json` on the web host; unverified-link fallback screen.   | ⬜     | WhatsApp links are the acquisition path (WEB-042/043).                                                         | Link test matrix (installed/not installed) passes for 5 paths; invalid code shows a friendly recovery.                                      | `app`, web `assetlinks.json`          | 3          | AND-016, WEB-042  |
| AND-044 | Offline MVP: cached Home/Queue/Missions, connectivity banner, read-only degradations, retry affordances.                                                                 | ⬜     | N3 — the audience is on intermittent data.                                                                     | Airplane mode: cached content with freshness stamp; every action explains why it's unavailable.                                             | `core:data`, all features             | 3          | AND-014           |
| AND-045 | Notification permission (Android 13+) with soft ask after first successful claim + rationale + settings deep link when denied.                                           | ⬜     | A cold prompt is denied forever; timing decides delivery.                                                      | Opt-in rate tracked; denied state shows an in-app banner with a settings link.                                                              | `feature:notifications`               | 1          | AND-040           |
| AND-046 | Security screen: active devices, revoke session, sign out everywhere, new-device notice.                                                                                 | ⬜     | A lost phone currently stays signed in (F-35).                                                                 | Revoked device is signed out within 60 s; UI shows last-seen metadata.                                                                      | `feature:settings`, SEC-029           | 2          | AND-042           |
| AND-047 | App shortcuts + share target registration (Queue, Submit, Missions) with adaptive icons and monochrome layer.                                                            | ⬜     | Two-tap access from the launcher; correct icon rendering on themed-icon devices.                               | Long-press shortcuts work; adaptive/monochrome icons render on API 33+.                                                                     | `app`                                 | 1          | AND-016           |
| AND-048 | MVP hardening pass: 360 dp layout QA, dark/light QA, empty/error/loading states on all 10 screens, crash triage rotation, 20-device smoke run.                           | ⬜     | The MVP gate is "no dead ends", not "feature list complete".                                                   | A checklist of 10 screens × 3 states signed off; crash-free ≥99 % over a 3-day internal soak.                                               | all features                          | 3          | AND-030…047       |

### Phase AND-C — Parity, quality & beta (M3)

**Exit gate:** closed beta with 100 real members, crash-free ≥99.5 %, feature parity for
everything a member does daily, accessibility and localisation complete, Play policies satisfied.

| ID      | Task                                                                                                                                                                    | Status | Why                                                                                     | Done when                                                                                                                            | Touches / integrates                          | Effort (d) | Depends           |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ---------- | ----------------- |
| AND-050 | Reviews: assigned list, detail, start, structured answers with validation, submit, wait state, rate-helpful.                                                            | ⬜     | Reviews are the reciprocal obligation that keeps the loop fair.                         | Complete a review end-to-end; 48 h SLA state visible; rejected text explains the rule.                                               | `feature:reviews`                             | 4          | AND-014           |
| AND-051 | Leaderboard + Rewards hub: my rank, squad rank, badges, trust explainer, levels; native charts.                                                                         | ⬜     | Status and progress are why members return after the novelty fades.                     | Paging 100+ rows smooth; "why did I move?" explains the delta (SEC-017).                                                             | `feature:leaderboard`, `feature:gamification` | 4          | AND-030           |
| AND-052 | AI coach: streaming responses (OkHttp SSE), conversation list, quota and offline errors, safety disclosure, report-output action.                                       | ⬜     | The "what should I improve?" feature that differentiates from link-dump groups.         | Streams token-by-token; cancel works; quota error offers a reset time; disclosure shown once per session.                            | `feature:ai`, SEC-021                         | 4          | AND-014           |
| AND-053 | Shop: catalogue, item detail, buy with credits, confirmation, balance refresh, error taxonomy (insufficient/owned/archived).                                            | ⬜     | Credit sink that keeps the economy meaningful.                                          | Purchase updates balance exactly once; insufficient funds shows top-up options.                                                      | `feature:shop`                                | 3          | AND-030           |
| AND-054 | Insights: personal views/watch/feedback trends, per-video performance, period selector, honest empty states.                                                            | ⬜     | Creators stay for evidence of progress.                                                 | Charts render with 0, 1 and 100 data points; period changes refetch correctly.                                                       | `feature:insights`                            | 3          | AND-051           |
| AND-055 | Search + discover: debounced query, grouped results, member/community/video results, block/report actions.                                                              | ⬜     | Discovery is how members find new squads and collaborators.                             | ≤300 ms local filter + server search; blocked entities never appear.                                                                 | `feature:search`, PLAT-013                    | 3          | AND-014           |
| AND-056 | Support, reports and appeals: ticket submit (with device metadata), report video/user, block user, appeal with evidence.                                                | ⬜     | N7 and the store's UGC requirement; also reduces support email volume.                  | Report+block reachable in ≤2 taps from any UGC surface; confirmation includes a ticket id.                                           | `feature:support`, PLAT-013, SEC-018          | 3          | AND-055           |
| AND-057 | Moderation (phone-adaptive, moderator/admin only): reports queue, appeals decisions, top-up review; analytics and bulk tooling stay on web.                             | ⬜     | Moderators are members too; they need triage on mobile.                                 | Role-gated (server-enforced); all actions audit-logged; tablet two-pane layout.                                                      | `feature:moderation`, `routes/admin.ts`       | 4          | AND-050, SEC-018  |
| AND-058 | Adaptive layouts: WindowSizeClass for phones, foldables, tablets; two-pane queue/player; resizable windows.                                                             | ⬜     | Play quality bar for large screens; also drives review sentiment on tablets.            | Layout tests at 360/600/840 dp; no stretched single-column on tablets.                                                               | `core:designsystem`, app                      | 3          | AND-030           |
| AND-059 | Play Billing: credit packs + "Squad Pro" subscription, purchase flow, pending purchases, restore, server verification, cancellation UX.                                 | ⬜     | The only compliant in-app revenue path (N6, F-30).                                      | Sandbox purchase credits the ledger once; pending purchase completes after restart; subscription status reflected server-side.       | `feature:shop`, `routes/billing.ts` (new)     | 6          | AND-053, PLAT-010 |
| AND-060 | Top-up removal + web handoff: manual NGN transfer disabled in-app with an explanatory screen linking to the web console.                                                | ⬜     | Keeping it inside the app is a payments-policy violation.                               | In-app path shows "manage on web" and opens the browser; no bank details rendered in-app.                                            | `feature:shop`, web billing                   | 1          | AND-059           |
| AND-061 | Background sync: WorkManager periodic refresh (unique work, backoff), outbox flush on constraints, token refresh, cache eviction.                                       | ⬜     | Keeps content fresh without opening the app; makes "pending" writes eventually succeed. | Queued submission completes with the app closed; battery-impact measured over 24 h.                                                  | `core:data`                                   | 4          | AND-044           |
| AND-062 | Localisation: externalise strings, `values-fr` (or locale #2 chosen with data), per-app language (Android 13+), RTL readiness, locale-formatted numbers/dates/currency. | ⬜     | Play audience is multilingual (F-23); also improves ASO in each market.                 | Zero hardcoded user-facing strings in release lint; locale switch works without restart; RTL pseudo-locale shows no broken layouts.  | `feature:*`, `core:designsystem`              | 4          | AND-015, WEB-030  |
| AND-063 | Accessibility: TalkBack pass on core loop, 48 dp targets, 200 % font scaling, contrast AA, reduced motion, no colour-only status.                                       | ⬜     | N8; also reduces support contacts from confused users.                                  | Accessibility Scanner: zero critical; TalkBack-only walkthrough recorded; font scale 2.0 has no clipped text.                        | all features                                  | 3          | AND-048           |
| AND-064 | Multi-channel support: add/verify channels, pick channel per submission, per-channel stats.                                                                             | ⬜     | Creators with two channels otherwise cannot use the product properly (F-44).            | Channel list + verify flow; submissions attribute correctly; tests updated.                                                          | `feature:profile`, PLAT-029                   | 3          | PLAT-029          |
| AND-065 | Performance: Baseline Profiles, Macrobenchmark suite, R8 full mode + resource shrinking, Coil sizing, list prefetch, startup deferral.                                  | ⬜     | Low-end Android is the majority; jank reads as "broken".                                | Cold start p50 ≤1.5 s; frame jank <5 %; AAB download ≤25 MB; baseline profile shipped.                                               | `app`, CI                                     | 4          | AND-025           |
| AND-066 | Data-saver mode: image quality tiers, prefetch limits on metered networks, "reduce motion/media" toggle, cache budget, clear-cache action.                              | ⬜     | Data cost is a real adoption barrier in the target markets.                             | Measured 40 % reduction in bytes/session when enabled; toggle persists.                                                              | `core:data`, `feature:settings`               | 2          | AND-065           |
| AND-067 | Play Integrity: nonce request, standard verdict, cached result, risk tier sent with watch claims, debug bypass for emulators.                                           | ⬜     | Closes the emulator/rooted-device farming hole (SEC-014).                               | Verdict arrives on staging from a Play-installed build; risk tier appears on the server's claim record; internal testers unaffected. | `core:integrity`                              | 3          | SEC-014           |
| AND-068 | In-app review prompt after a positive moment (streak milestone, 3rd successful claim), never after a failure; throttled to 1/90 days.                                   | ⬜     | Ratings drive installs; asking at the wrong moment drives 1-star reviews.               | Prompt triggers per rules in internal tests; never shown to users with recent support tickets.                                       | Play In-App Review                            | 1          | AND-040           |
| AND-069 | Release health: Crashlytics velocity alerts, ANR tracking, per-version dashboard, threshold-based rollout halt documented.                                              | ⬜     | A staged rollout is only useful if you know when to stop.                               | Alert fires on a synthetic spike; runbook has exact halt command.                                                                    | CI, Play API, Crashlytics                     | 2          | AND-067           |
| AND-070 | Closed beta: 100-member programme, feedback form, weekly triage, Play internal→closed track promotion, beta communications.                                             | ⬜     | Real usage before GA is the only way to find the 20 % of issues tests miss.             | 100 testers active, ≥30 pieces of structured feedback, top-10 issues triaged.                                                        | Play Console, support                         | 3          | AND-048           |

### Phase AND-D — Store launch (M4)

**Exit gate:** app live in production with a staged rollout at 100 %, all policy declarations
submitted and truthful, and a support path for the first 1 000 installs.

| ID      | Task                                                                                                                                                                        | Status | Why                                                                                                                                         | Done when                                                                                        | Touches / integrates       | Effort (d) | Depends |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------- | ---------- | ------- |
| AND-080 | Store listing: icon, feature graphic, 8 phone + 4 tablet screenshots (real UI, localized), short description (≤80 chars) with ASO keywords, full description, promo video.  | ⬜     | Listing conversion is a growth lever; screenshots are the highest-impact asset.                                                             | Listing passes Play asset checks; A/B experiment configured for icon + screenshots.              | Play Console, marketing    | 3          | AND-063 |
| AND-081 | In-app legal: privacy policy, terms, community rules, AI disclaimer, open-source licences, version/build info.                                                              | ⬜     | Required for review and for user trust.                                                                                                     | Reachable from Settings without network (cached); URLs match store listing.                      | `feature:settings`         | 1          | AND-042 |
| AND-082 | Data safety form: declared collection/sharing, encryption in transit, deletion path, data types per SDK (Firebase, Crashlytics, analytics, billing).                        | ⬜     | Inaccurate Data safety answers are a common rejection and a trust issue.                                                                    | Form matches `docs/DATA-MAP.md`; every SDK declared; submitted.                                  | SEC-025, Play Console      | 1          | SEC-025 |
| AND-083 | Content rating (IARC) + ads declaration + target audience (18+ or 13–17 with safeguards) + news/finance declarations.                                                       | ⬜     | Wrong declarations cause removal; the product has UGC and money features.                                                                   | Rating certificate received; declarations match actual behaviour; families policy not triggered. | Play Console               | 1          | AND-056 |
| AND-084 | Reviewer access: a documented test account or Google sign-in instructions, plus a demo community with seeded content so review is possible without waiting for assignments. | ⬜     | An app that requires another creator to interact is unreviewable in a vacuum — this is the #1 cause of "app can't be evaluated" rejections. | Reviewers can complete the loop in a seeded demo community; instructions in App access field.    | staging seed, Play Console | 2          | AND-070 |
| AND-085 | Pre-launch report triage: Firebase Test Lab across 12 devices/API levels, stability/performance/accessibility reports, fix top issues.                                      | ⬜     | Automated real-device coverage catches device-specific crashes before users do.                                                             | Zero critical issues in pre-launch report; documented exceptions with rationale.                 | Test Lab                   | 2          | AND-065 |
| AND-086 | Staged rollout: 5 % → 20 % → 50 % → 100 % with explicit halt criteria (crash-free <99 %, ANR >0.5 %, 1-star spike).                                                         | ⬜     | Limits blast radius of an unknown defect.                                                                                                   | Each stage monitored ≥48 h; rollback rehearsed once.                                             | Play Console, AND-069      | 2          | AND-085 |
| AND-087 | Release runbook: tagging, rollout, hotfix path (versionCode bump, expedited review request), server-side kill switches, comms templates.                                    | ⬜     | Incidents happen at inconvenient times; the runbook is the difference between 20 minutes and 2 days.                                        | Dry-run of a halt + hotfix completed by a second engineer.                                       | docs, PLAT-014             | 1          | AND-086 |
| AND-088 | Support operations: in-app help centre, FAQ, email SLA, canned responses for top-10 issues, moderation escalation path.                                                     | ⬜     | Post-launch volume always exceeds expectations; canned answers buy time.                                                                    | SLA published; top-10 responses written; support volume tracked weekly.                          | support, ops               | 2          | AND-056 |
| AND-089 | Launch analytics: install → sign-in → first claim → D1/D7/D30 funnels, crash-free KPI, review sentiment dashboard.                                                          | ⬜     | Launch without measurement is a blind flight.                                                                                               | Dashboards live before rollout; weekly review ritual scheduled.                                  | DATA-*, analytics          | 1          | AND-019 |
| AND-090 | ASO iteration: keyword research (creator/feedback/watch-time terms), listing experiments, screenshot iteration, localized listings for locale #2.                           | ⬜     | Store search is the second-largest acquisition channel after referrals.                                                                     | Two experiments completed with a documented winner; localized listing live.                      | Play Console               | 2          | AND-086 |

### Phase AND-E — Post-GA (M5)

| ID      | Task                                                                                                                                        | Status | Why                                                            | Done when                                                                   | Touches / integrates      | Effort (d) | Depends |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------- | ---------- | ------- |
| AND-100 | Glance widget: streak + next action + one-tap to queue, refreshed by WorkManager.                                                           | ⬜     | The cheapest daily re-engagement surface on Android.           | Widget renders in 3 sizes; refresh ≤30 min; no battery complaint in vitals. | `feature:widget`          | 3          | AND-061 |
| AND-101 | Notification quick actions (claim when eligible, open queue) with `RemoteInput`-free direct intents.                                        | ⬜     | Turns a nudge into an action without an app launch detour.     | Actions work from lock screen; failures show a toast with reason.           | `feature:notifications`   | 2          | AND-040 |
| AND-102 | Referral & invite flows native: invite sheet, code entry, attributed install via Play Install Referrer, reward after referee's first claim. | ⬜     | Compounding acquisition loop (WEB-039).                        | Attribution verified on a clean install; fraud guard blocks self-referral.  | AND-043, WEB-039          | 3          | AND-043 |
| AND-103 | Offline submission drafts + retry queue visible as "pending" items in My Videos.                                                            | ⬜     | Members draft on the go and submit when data returns.          | Draft survives reboot; pending item resolves or explains failure.           | `core:data`               | 2          | AND-061 |
| AND-104 | Play Billing experiments: pack pricing, paywall placement, subscription trial.                                                              | ⬜     | Revenue optimisation requires experiments, not opinions.       | One experiment per month with measured lift.                                | AND-059                   | 2          | AND-059 |
| AND-105 | Android 16 features: desktop windowing, themed icons, predictive back polish, per-app language deep links.                                  | ⬜     | Platform freshness is a quality signal in review and in press. | All four verified on API 36 hardware.                                       | app                       | 2          | AND-058 |
| AND-106 | App size and startup reduction round 2 (dependency pruning, resource shrink, deferred init).                                                | ⬜     | Faster installs convert better on low-end devices.             | Download ≤20 MB; cold start p50 ≤1.2 s.                                     | AND-065                   | 2          | AND-065 |
| AND-107 | External accessibility audit with assistive-technology users; publish a conformance note.                                                   | ⬜     | Internal testing systematically overestimates accessibility.   | Report received; criticals fixed; conformance statement published.          | AND-063                   | 3          | AND-063 |
| AND-108 | Security review / pen-test of the app surface (token storage, deep links, WebView bridge, billing verification).                            | ⬜     | The bridge and deep links are the new attack surface.          | Findings triaged; no high-severity open items.                              | AND-033, AND-043, SEC-030 | 3          | AND-059 |
| AND-109 | iOS decision memo: assess Kotlin Multiplatform extraction of `core:model`/`core:data` vs. a separate SwiftUI client.                        | ⬜     | Keeps the door open without committing a quarter.              | Written recommendation with cost/benefit and a go/no-go date.               | —                         | 1          | AND-065 |

---

## 7. Test strategy

| Layer           | Tool                                    | Scope                                                                          | Gate                                                             |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Unit            | JUnit + Turbine + MockK                 | ViewModels, repositories, verification math, mappers                           | ≥70 % line coverage on `core:data` + all ViewModels; PR-blocking |
| Screenshot      | Roborazzi                               | Every design-system component + 8 key screens (light/dark/large font)          | PR-blocking diffs with review                                    |
| Compose UI      | `createAndroidComposeRule`              | 12 critical flows incl. claim replay, offline banner, permission denial        | PR-blocking                                                      |
| Contract        | MockWebServer + generated client        | Fixtures generated from the OpenAPI spec; error envelopes, 429/503, request-id | PR-blocking                                                      |
| Integration     | Hilt test app + fake API                | Sign-in → queue → claim (fake player) → reward                                 | Nightly                                                          |
| Device          | Firebase Test Lab                       | 12 devices, API 26/30/33/36, low-memory profile                                | Pre-release                                                      |
| Performance     | Macrobenchmark + Baseline Profile       | Startup, jank, scroll, player memory                                           | Per release                                                      |
| Accessibility   | Accessibility Scanner + TalkBack script | Core loop, all settings                                                        | Per release                                                      |
| Watch integrity | Instrumented fake-player harness        | Heartbeat gaps, background, rotation, call interruption                        | PR-blocking for `feature:player`                                 |

**Device matrix (minimum):** Pixel 9 (API 36), Pixel 6a (API 33), Samsung A15 (API 34, low-RAM),
Tecno Spark 20 (API 33, 2 GB), Infinix Hot 40i (API 33), Samsung Tab A9 (tablet), Pixel Fold
(foldable), plus an API 26 emulator for the floor.

---

## 8. Release process

1. **Trunk-based:** short-lived branches, PR requires CI green + one review + screenshot diff review.
2. **Versioning:** `versionCode` monotonic from CI; `versionName` semver; tags `android-vX.Y.Z`.
3. **Tracks:** internal (every merge to main) → closed (weekly) → production (staged 5/20/50/100).
4. **Gates per track:** internal = build + smoke; closed = crash-free ≥99.5 %, no P1 bugs; production
   = pre-launch report clean, policies declared, support briefed.
5. **Rollback:** halt rollout (Play Console/API) + server-side flag disable; hotfix within 24 h.
6. **Post-release:** 48 h monitoring window with explicit on-call owner and a written go/no-go note.

---

## 9. Play policy checklist (store blockers)

| Requirement                                             | Status                                | Task                             |
| ------------------------------------------------------- | ------------------------------------- | -------------------------------- |
| Report **and** block for UGC                            | ⬜                                    | PLAT-013, AND-056                |
| In-app account deletion + web URL                       | 🟡 (API exists, no web page)          | SEC-026, WEB-036, AND-042        |
| Payments: digital goods via Play Billing only           | ⬜                                    | AND-059, AND-060                 |
| Target SDK 36, 64-bit, no deprecated APIs               | ⬜                                    | AND-002                          |
| Data safety form accurate                               | ⬜                                    | AND-082                          |
| Content rating + ads declaration                        | ⬜                                    | AND-083                          |
| Privacy policy URL and in-app copy                      | 🟡 (web page exists)                  | AND-081, SEC-028                 |
| Reviewer test access with seeded content                | ⬜                                    | AND-084                          |
| No deceptive "watch-for-watch" claims / no view-selling | ⬜ (positioning must match behaviour) | WEB-024, GRW-016                 |
| No background YouTube playback                          | ⬜                                    | AND-032/033 (enforced by design) |
| Permissions minimal (notifications, network only)       | ⬜                                    | AND-021 lint                     |

---

## 10. Android definition of done

1. A member can complete the entire loop natively, offline-tolerant, on a 2 GB RAM phone.
2. Verified watching is enforced by the server using the evidence the app produces.
3. Push, billing, deep links, blocking, report, export and deletion all work in-app.
4. Crash-free ≥99.5 %, ANR ≤0.3 %, cold start ≤1.5 s p50, download ≤25 MB.
5. TalkBack-complete, 200 % font scale, AA contrast, one extra locale live.
6. Exactly one WebView, hosting only the YouTube player.
7. Store listing, policy declarations and release runbook complete and rehearsed.
