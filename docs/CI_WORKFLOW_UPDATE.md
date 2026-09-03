# CI workflow update (optional improvement; no longer blocking)

> **Update 2026-09-03:** the worker test suite no longer requires Node 22. It
> uses `node:sqlite` when the runtime provides it (Node >= 22.5) and otherwise
> falls back to `node-sqlite3-wasm`, a WebAssembly build of SQLite, so the
> existing Node 20 workflow passes. The changes below are still recommended —
> they make CI match the version the project is developed against, switch to
> reproducible installs, and run the frontend tests — but nothing is broken
> without them.

The sandbox/agent GitHub App is **not allowed to create or update files under
`.github/workflows/`** (GitHub rejects the push with
`refusing to allow a GitHub App to create or update workflow ... without
'workflows' permission`). The two workflow files in this repository are
therefore kept as-is in Git, and the recommended changes are recorded here so
they can be applied by someone with `workflows` permission (or by granting the
App that permission and re-running the change).

## Why the change is recommended

1. **Node 20 is behind the project.** Development and deployment target Node 22
   (`node:sqlite` in the test harness, current LTS tooling). CI pinning Node 20
   means it verifies a runtime nothing else uses. The suite runs on both today
   thanks to the wasm fallback.
2. **Frontend tests still never run in CI.** `npm test` (root Vitest: api-client,
   hooks, repo hygiene) is only executed locally, so a regression in the SPA can
   ship green.
3. **`npm i` is not reproducible.** `npm ci` installs exactly what
   `package-lock.json` pins, which is what CI should verify.

## `.github/workflows/ci.yml` (replace the file)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

# The worker test suite drives a real SQLite database through `node:sqlite`,
# which only exists from Node 22.5 onwards — CI must run the same major
# version the project is developed against.
env:
  NODE_VERSION: "22"

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm ci
        working-directory: workers/api
      - run: npm run lint
        working-directory: workers/api
      - run: npx tsc --noEmit
        working-directory: workers/api

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      - run: npm ci
      - run: npm test

  test-worker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      - run: npm ci
        working-directory: workers/api
      - run: npm test
        working-directory: workers/api

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      - run: npm ci
      - run: npm run build
```

## `.github/workflows/deploy.yml` (same edits)

- add the `NODE_VERSION: "22"` env block next to the `on:` block,
- replace every `node-version: 20` with `node-version: ${{ env.NODE_VERSION }}`,
- replace `npm i` / `cd workers/api && npm i` with `npm ci` (plus
  `working-directory: workers/api` for the worker steps),
- keep the `wrangler-action` and `vercel-action` steps unchanged.

## What still works without this change

Nothing in the runtime depends on CI: Vercel and Cloudflare builds are driven
by their own pipelines, and every check above can be run locally with:

```bash
npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build
cd workers/api && npm ci && npm run lint && npx tsc --noEmit && npm test
```
