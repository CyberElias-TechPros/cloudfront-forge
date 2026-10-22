# API changelog

## 2026-10-22 — `origin/main` → working tree

### API spec diff vs `origin/main`

**13 breaking · 4 deprecation · 29 additive**

<details open><summary>⚠️ Breaking changes (13)</summary>

A client built against the previous spec can fail.

- Removed response field `data.videos` from `GET /api/v1/videos`
- Removed response field `data.videos[].id` from `GET /api/v1/videos`
- Removed response field `data.videos[].youtubeVideoId` from `GET /api/v1/videos`
- Removed response field `data.videos[].youtubeUrl` from `GET /api/v1/videos`
- Removed response field `data.videos[].title` from `GET /api/v1/videos`
- Removed response field `data.videos[].thumbnailUrl` from `GET /api/v1/videos`
- Removed response field `data.videos[].durationSeconds` from `GET /api/v1/videos`
- Removed response field `data.videos[].status` from `GET /api/v1/videos`
- Removed response field `data.videos[].createdAt` from `GET /api/v1/videos`
- Removed response field `data.pagination` from `GET /api/v1/videos`
- Removed response field `data.pagination.limit` from `GET /api/v1/videos`
- Removed response field `data.pagination.offset` from `GET /api/v1/videos`
- Removed response field `data.pagination.total` from `GET /api/v1/videos`

</details>

<details><summary>⏳ Deprecations (4)</summary>

Still supported; announce and migrate.

- Deprecated parameter `query:offset` on `GET /api/v1/communities`
- Deprecated parameter `query:offset` on `GET /api/v1/queue`
- Deprecated parameter `query:offset` on `GET /api/v1/submissions`
- Deprecated parameter `query:offset` on `GET /api/v1/activity`

</details>

<details><summary>➕ Additive changes (29)</summary>

Old clients keep working.

- Added response field `data.items` to `GET /api/v1/videos`
- Added response field `data.items[].id` to `GET /api/v1/videos`
- Added response field `data.items[].youtubeVideoId` to `GET /api/v1/videos`
- Added response field `data.items[].youtubeUrl` to `GET /api/v1/videos`
- Added response field `data.items[].title` to `GET /api/v1/videos`
- Added response field `data.items[].thumbnailUrl` to `GET /api/v1/videos`
- Added response field `data.items[].durationSeconds` to `GET /api/v1/videos`
- Added response field `data.items[].status` to `GET /api/v1/videos`
- Added response field `data.items[].createdAt` to `GET /api/v1/videos`
- Added response field `data.total` to `GET /api/v1/videos`
- Added response field `data.limit` to `GET /api/v1/videos`
- Added response field `data.offset` to `GET /api/v1/videos`
- Added response field `data.nextCursor` to `GET /api/v1/videos`
- Added response field `data.hasMore` to `GET /api/v1/videos`
- Added response field `data.nextCursor` to `GET /api/v1/notifications`
- Added response field `data.hasMore` to `GET /api/v1/notifications`
- Added response field `data.nextCursor` to `GET /api/v1/communities`
- Added response field `data.hasMore` to `GET /api/v1/communities`
- Added response field `data.nextCursor` to `GET /api/v1/queue`
- Added response field `data.hasMore` to `GET /api/v1/queue`
- Added response field `data.nextCursor` to `GET /api/v1/submissions`
- Added response field `data.hasMore` to `GET /api/v1/submissions`
- Added response field `data.nextCursor` to `GET /api/v1/activity`
- Added response field `data.hasMore` to `GET /api/v1/activity`
- Added response field `data.nextCursor` to `GET /api/v1/admin/users`
- Added response field `data.hasMore` to `GET /api/v1/admin/users`
- Added response field `data.nextCursor` to `GET /api/v1/admin/communities`
- Added response field `data.hasMore` to `GET /api/v1/admin/communities`
- Added error code `IDEMPOTENCY_CONFLICT`

</details>

## 2026-10-22 — `origin/main` → working tree

### API spec diff vs `origin/main`

**13 breaking · 4 deprecation · 29 additive**

<details open><summary>⚠️ Breaking changes (13)</summary>

A client built against the previous spec can fail.

- Removed response field `data.videos` from `GET /api/v1/videos`
- Removed response field `data.videos[].id` from `GET /api/v1/videos`
- Removed response field `data.videos[].youtubeVideoId` from `GET /api/v1/videos`
- Removed response field `data.videos[].youtubeUrl` from `GET /api/v1/videos`
- Removed response field `data.videos[].title` from `GET /api/v1/videos`
- Removed response field `data.videos[].thumbnailUrl` from `GET /api/v1/videos`
- Removed response field `data.videos[].durationSeconds` from `GET /api/v1/videos`
- Removed response field `data.videos[].status` from `GET /api/v1/videos`
- Removed response field `data.videos[].createdAt` from `GET /api/v1/videos`
- Removed response field `data.pagination` from `GET /api/v1/videos`
- Removed response field `data.pagination.limit` from `GET /api/v1/videos`
- Removed response field `data.pagination.offset` from `GET /api/v1/videos`
- Removed response field `data.pagination.total` from `GET /api/v1/videos`

</details>

<details><summary>⏳ Deprecations (4)</summary>

Still supported; announce and migrate.

- Deprecated parameter `query:offset` on `GET /api/v1/communities`
- Deprecated parameter `query:offset` on `GET /api/v1/queue`
- Deprecated parameter `query:offset` on `GET /api/v1/submissions`
- Deprecated parameter `query:offset` on `GET /api/v1/activity`

</details>

<details><summary>➕ Additive changes (29)</summary>

Old clients keep working.

- Added response field `data.items` to `GET /api/v1/videos`
- Added response field `data.items[].id` to `GET /api/v1/videos`
- Added response field `data.items[].youtubeVideoId` to `GET /api/v1/videos`
- Added response field `data.items[].youtubeUrl` to `GET /api/v1/videos`
- Added response field `data.items[].title` to `GET /api/v1/videos`
- Added response field `data.items[].thumbnailUrl` to `GET /api/v1/videos`
- Added response field `data.items[].durationSeconds` to `GET /api/v1/videos`
- Added response field `data.items[].status` to `GET /api/v1/videos`
- Added response field `data.items[].createdAt` to `GET /api/v1/videos`
- Added response field `data.total` to `GET /api/v1/videos`
- Added response field `data.limit` to `GET /api/v1/videos`
- Added response field `data.offset` to `GET /api/v1/videos`
- Added response field `data.nextCursor` to `GET /api/v1/videos`
- Added response field `data.hasMore` to `GET /api/v1/videos`
- Added response field `data.nextCursor` to `GET /api/v1/notifications`
- Added response field `data.hasMore` to `GET /api/v1/notifications`
- Added response field `data.nextCursor` to `GET /api/v1/communities`
- Added response field `data.hasMore` to `GET /api/v1/communities`
- Added response field `data.nextCursor` to `GET /api/v1/queue`
- Added response field `data.hasMore` to `GET /api/v1/queue`
- Added response field `data.nextCursor` to `GET /api/v1/submissions`
- Added response field `data.hasMore` to `GET /api/v1/submissions`
- Added response field `data.nextCursor` to `GET /api/v1/activity`
- Added response field `data.hasMore` to `GET /api/v1/activity`
- Added response field `data.nextCursor` to `GET /api/v1/admin/users`
- Added response field `data.hasMore` to `GET /api/v1/admin/users`
- Added response field `data.nextCursor` to `GET /api/v1/admin/communities`
- Added response field `data.hasMore` to `GET /api/v1/admin/communities`
- Added error code `IDEMPOTENCY_CONFLICT`

</details>

Generated from spec diffs by `node scripts/api-diff.mjs --write-changelog`.
Every entry is derived from the committed OpenAPI document, so it cannot drift
from what the server actually accepts: if a field, parameter or error code
appears here, it changed in `workers/api/src/contract/openapi.generated.json`.

The newest entry sits at the top.
