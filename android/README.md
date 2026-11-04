# LoopSquad Android (work in progress)

Native Jetpack Compose client for the CreatorLoop/LoopSquad API. This is **not** a WebView wrapper.
The only embedded web surface is an isolated YouTube IFrame player used for verified watch sessions.

## Status

This branch contains the Android project scaffold, generated Retrofit/kotlinx.serialization client,
core data/auth/cache/push/billing/player layers, and feature ViewModels. The Compose navigation graph
and remaining screens are still being completed. **No APK/AAB has been built or device-tested yet.**

## Modules

- `:app` — Compose UI, Hilt DI, Room/DataStore cache, WorkManager outbox, Firebase auth/FCM, Play Billing.
- `:core:network-api` — generated API surface from `workers/api/src/contract/openapi.generated.json`.

Regenerate the client after API contract changes:

```bash
npm run contract:build
node scripts/android-client.mjs
node scripts/android-client.mjs --check
```

## Build requirements

- JDK 17+
- Android SDK 36, Gradle 8.13 / AGP 8.13
- Public Firebase app configuration and Google OAuth web client ID
- For release: signing properties and Play Billing product configuration

Flavors:

- `dev` — local Worker (`10.0.2.2:8787`), cleartext allowed only for emulator loopback hosts.
- `staging` — staging Worker, HTTPS only.
- `prod` — production Worker, HTTPS only.

Example local build once the UI is complete:

```bash
cd android
./gradlew :app:assembleDevDebug \
  -PFIREBASE_API_KEY=... \
  -PFIREBASE_APP_ID=... \
  -PFIREBASE_PROJECT_ID=creator-loop-ring \
  -PFIREBASE_SENDER_ID=... \
  -PGOOGLE_WEB_CLIENT_ID=...
```

Do not commit `google-services.json`, signing keystores, `signing.properties`, or service-account JSON.
The app accepts public Firebase configuration only; Worker secrets stay server-side.

## Safety/architecture notes

- Rewards, purchases, moderation and membership writes are never blind-replayed offline.
- Only notification read/delete mutations are queued in the UID-scoped outbox.
- Play purchases are verified and granted once by the Worker before consumption.
- Push tokens are encrypted at rest server-side; FCM payloads are data-only.
- The YouTube player bridge is read-only telemetry and receives no auth material.
