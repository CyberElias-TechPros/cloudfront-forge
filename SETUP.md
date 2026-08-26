# Setup Guide

## Environment Variables

### Frontend (`.env` in project root)

```env
# Firebase Client Configuration
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-ABC123

# API Configuration
# Optional in development: the Vite dev server proxies /api/* to the worker at
# http://localhost:8787 (override with API_PROXY_TARGET). Set VITE_API_URL only
# when pointing at a deployed backend.
# VITE_API_URL=https://your-worker.workers.dev

# Dev Auth (local development only)
VITE_USE_DEV_AUTH=true
VITE_DEV_UID=dev-local
VITE_DEV_NAME=Dev User
```

### Backend (`workers/api/.env` or Cloudflare Secrets)

```env
ENVIRONMENT=production
FIREBASE_PROJECT_ID=your-project-id
YOUTUBE_API_KEY=AIza...
AI_PROVIDER=nvidia
AI_MODEL=meta/llama-3.1-8b-instruct
AI_API_KEY=nvapi-...
YOUTUBE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_OAUTH_CLIENT_SECRET=your-client-secret
YOUTUBE_OAUTH_REDIRECT_URI=https://your-domain.com/api/v1/youtube/oauth/callback
CORS_ORIGINS=https://your-frontend.com,https://admin.your-frontend.com
```

## Setting Secrets with Wrangler

```sh
cd workers/api
wrangler secret put AI_API_KEY
wrangler secret put YOUTUBE_API_KEY
wrangler secret put YOUTUBE_OAUTH_CLIENT_SECRET
```

## Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Google Sign-In in Authentication > Sign-in method
3. Add the frontend domain to Authorized domains
4. Copy the Firebase config values to `.env`

## YouTube API Setup

1. Enable YouTube Data API v3 at https://console.cloud.google.com/apis/library
2. Create an API key and add to backend secrets
3. For OAuth, create OAuth 2.0 credentials in Google Cloud Console
4. Add authorized redirect URIs

## Cloudflare Setup

1. Create a Cloudflare account
2. Enable Workers, D1, KV, and R2
3. Create D1 database: `wrangler d1 create creatorloop-db`
4. Create KV namespace: `wrangler kv:namespace create KV_CACHE`
5. Create R2 bucket: `wrangler r2 bucket create creatorloop-assets`
6. Update `wrangler.toml` with the returned IDs

## Database Migrations

```sh
cd workers/api
wrangler d1 migrations apply creatorloop-db --local
wrangler d1 migrations apply creatorloop-db --remote
```

## Development Workflow

1. Start backend: `cd workers/api && npm run dev`
2. Start frontend: `npm run dev`
3. Open http://localhost:5173

## Production Deployment

1. Build frontend: `npm run build`
2. Deploy frontend to Vercel
3. Deploy backend: `cd workers/api && wrangler deploy --env production`
