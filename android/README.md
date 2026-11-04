# LoopSquad Android

Native Jetpack Compose client for the CreatorLoop/LoopSquad API. This is **not** a WebView wrapper.
The only embedded web surface is an isolated YouTube IFrame player used for verified watch sessions.

## Verified status

- Android CI compiles the app, runs JVM unit tests, and assembles `devDebug`.
- CI artifact: `loopsquad-dev-debug` APK (~24 MB).
- Generated API client is checked for drift against the committed OpenAPI contract.
- Release signing, Play Store configuration, and real-device QA are still required before production release.

## Modules

- `:app` — Compose UI, Hilt DI, Room/DataStore cache, WorkManager outbox, Firebase auth/FCM, Play Billing.
- `:core:network-api` — generated Retrofit/kotlinx.serialization API surface from `workers/api/src/contract/openapi.generated.json`.

Regenerate the client after API contract changes:

```bash
npm run contract:build
npm run contract:android
npm run contract:android:check
```

## Build

Requirements:

- JDK 17+
- Android SDK 36 / build-tools 36
- Gradle wrapper 8.13 / AGP 8.13

```bash
cd android
./gradlew :core:network-api:testDebugUnitTest :app:testDevDebugUnitTest :app:assembleDevDebug
```

Flavors:

- `dev` — local Worker (`10.0.2.2:8787`), cleartext allowed only for emulator loopback hosts.
- `staging` — staging Worker, HTTPS only.
- `prod` — production Worker, HTTPS only.

Public Firebase/OAuth configuration can be supplied through Gradle properties or environment variables:

```bash
./gradlew :app:assembleProdRelease \
  -PFIREBASE_API_KEY=... \
  -PFIREBASE_APP_ID=... \
  -PFIREBASE_PROJECT_ID=creator-loop-ring \
  -PFIREBASE_SENDER_ID=... \
  -PGOOGLE_WEB_CLIENT_ID=...
```

Do not commit `google-services.json`, signing keystores, `signing.properties`, or service-account JSON.
The app accepts public Firebase configuration only; Worker secrets stay server-side.

## Feature coverage

- Google/email authentication, consent and age gate
- Dashboard, daily bonus, quests, streaks, XP/credits
- Fair watch queue, verified player, attention checks, claim flow
- YouTube share-intent submission and submission management
- Communities: create/join/approve, roles, invites, settings, archive/leave
- Missions: accept/complete/skip, daily quests
- Reviews: start, draft answers, score, submit
- Rewards: shop, Play Billing credit packs, restore purchases, transactions, badges
- Profile editing, public profile toggle, account deletion
- Notifications, preferences, quiet hours, deep links
- AI coach with SSE streaming and non-stream fallback
- Discovery/search/collaborators, leaderboards, insights
- Safety: blocks, reports, appeals; support tickets
- Role-gated administration: metrics, reports, users, support, appeals, top-ups
- Settings: theme, data saver, YouTube connection, legal pages, sign out

## Architecture and safety

- Reads use UID-scoped Room snapshots with visible staleness.
- Only notification read/delete mutations are queued offline; rewards, purchases, submissions,
  moderation and membership writes are never blind-replayed.
- Play purchases are verified and granted once by the Worker before consumption.
- Push tokens are encrypted at rest server-side; FCM payloads are data-only.
- The YouTube player bridge is read-only telemetry and receives no auth material.
- Production builds enforce HTTPS; dev cleartext is restricted to emulator loopback hosts.
- Backup/device-transfer of app data is disabled.

## Release checklist

1. Apply Worker migration `039_native_android.sql` and configure FCM/Play/Android secrets.
2. Register Android OAuth clients and SHA-1/SHA-256 signing fingerprints in Firebase.
3. Configure Play Billing products and service account.
4. Add release signing via ignored `signing.properties`.
5. Build `prodRelease`, run device QA, accessibility checks, and Play pre-launch report.
6. Publish via Play Console; do not sideload production releases.
