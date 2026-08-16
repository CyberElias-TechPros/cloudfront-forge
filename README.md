# CreatorLoop (CloudFront Forge)

Gamified, cheat-proof follow-for-follow platform for YouTube creator communities. Verified watch time, real subscriptions, and a leaderboard that rewards showing up.

## Stack

- **Frontend**: React/TypeScript (TanStack Start) + Tailwind CSS
- **Backend**: Cloudflare Workers + D1 SQLite + KV + R2
- **Auth**: Firebase Authentication (Google Sign-In)
- **AI**: NVIDIA NIM (Llama 3.1)
- **Hosting**: Vercel (frontend) + Cloudflare Workers (backend)

## Security

This project implements several critical security measures:

- **No hardcoded secrets**: All API keys and credentials are loaded from environment variables or Cloudflare Secrets Store
- **CORS whitelisting**: Only configured origins can access the API
- **Input validation**: All endpoints use Zod schema validation
- **Rate limiting**: Per-IP rate limiting with stricter limits for auth endpoints
- **Firebase JWT verification**: Tokens are verified against Google's public keys
- **RBAC permissions**: Role-based access control for admin operations
- **YouTube OAuth**: Secure OAuth 2.0 flow for subscription verification

## Prerequisites

- Node.js >= 18
- npm >= 9
- Cloudflare account with Workers, D1, KV, and R2 enabled
- Firebase project with Google Sign-In enabled
- YouTube Data API v3 key (for metadata)
- NVIDIA NIM API key (for AI features)

## Setup

### 1. Clone and install

```sh
git clone <repository-url>
cd cloudfront-forge
npm i
cd workers/api && npm i && cd ../..
```

### 2. Configure environment variables

Copy `.env.example` to `.env` in the root and `workers/api/.env.example` to `workers/api/.env`, then fill in the values.

Required frontend variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_API_URL`

Required backend variables (set via `wrangler secret put` or `.env`):

- `FIREBASE_PROJECT_ID`
- `YOUTUBE_API_KEY`
- `AI_API_KEY`
- `AI_MODEL`
- `YOUTUBE_OAUTH_CLIENT_ID`
- `YOUTUBE_OAUTH_CLIENT_SECRET`
- `YOUTUBE_OAUTH_REDIRECT_URI`
- `CORS_ORIGINS`

### 3. Set up Cloudflare resources

```sh
cd workers/api
wrangler d1 create creatorloop-db
wrangler kv:namespace create KV_CACHE
wrangler r2 bucket create creatorloop-assets
```

Update `wrangler.toml` with the returned database ID and KV namespace ID.

### 4. Run database migrations

```sh
wrangler d1 migrations apply creatorloop-db --local
```

### 5. Start development

```sh
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
cd workers/api
npm run dev
```

## Testing

```sh
# Backend tests
cd workers/api
npm test

# Frontend lint
npm run lint
```

## Deployment

### Frontend (Vercel)

1. Connect the repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy

### Backend (Cloudflare Workers)

```sh
cd workers/api
wrangler deploy --env production
```

## Architecture

- `workers/api/` - Cloudflare Worker backend
- `src/` - TanStack Start frontend
- `workers/api/src/routes/` - API route handlers
- `workers/api/src/services/` - Business logic services
- `workers/api/src/middleware/` - Auth, rate limiting, validation
- `workers/api/migrations/` - D1 database migrations

## API Endpoints

| Method | Path                              | Description              |
| ------ | --------------------------------- | ------------------------ |
| POST   | `/api/v1/auth/register`           | Register/get user        |
| GET    | `/api/v1/auth/me`                 | Get current user         |
| PUT    | `/api/v1/auth/profile`            | Update profile           |
| GET    | `/api/v1/auth/permissions`        | Get user permissions     |
| GET    | `/api/v1/users/me/profile`        | Get full profile         |
| PUT    | `/api/v1/users/me/profile`        | Update profile           |
| GET    | `/api/v1/communities`             | List communities         |
| POST   | `/api/v1/communities`             | Create community         |
| POST   | `/api/v1/communities/join`        | Join community           |
| GET    | `/api/v1/videos`                  | List videos              |
| POST   | `/api/v1/videos`                  | Submit video             |
| GET    | `/api/v1/reviews`                 | List reviews             |
| POST   | `/api/v1/watch`                   | Submit watch session     |
| GET    | `/api/v1/missions`                | List missions            |
| POST   | `/api/v1/missions`                | Create mission           |
| POST   | `/api/v1/youtube/oauth/authorize` | Start YouTube OAuth      |
| POST   | `/api/v1/youtube/oauth/callback`  | YouTube OAuth callback   |
| GET    | `/api/v1/youtube/status`          | Check YouTube connection |
| POST   | `/api/v1/youtube/disconnect`      | Disconnect YouTube       |
| GET    | `/api/v1/credits`                 | Get credits              |
| GET    | `/api/v1/xp`                      | Get XP                   |
| GET    | `/api/v1/leaderboards`            | Get leaderboard          |
| GET    | `/api/v1/notifications`           | Get notifications        |
| POST   | `/api/v1/admin/reports`           | Submit report            |
| GET    | `/api/v1/admin/metrics`           | Get admin metrics        |

## License

Private - All rights reserved
