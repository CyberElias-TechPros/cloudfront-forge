# CI workflow update (needs a manual apply)

The sandbox/agent GitHub App is **not allowed to create or update files under
`.github/workflows/`** (GitHub rejects the push with
`refusing to allow a GitHub App to create or update workflow ... without
'workflows' permission`). The two workflow files in this repository are
therefore kept as-is in Git, and the required changes are recorded here so they
can be applied by someone with `workflows` permission (or by granting the App
that permission and re-running the change).

## Why the change is needed

1. **Node 20 is no longer enough.** `workers/api` tests drive a real SQLite
   database through `node:sqlite`, which only exists from Node 22.5 onward. On
   Node 20 the worker test job fails at import time.
2. **Frontend tests never ran in CI.** `npm test` (root Vitest: api-client,
   hooks, repo hygiene) was only executed locally, so regressions in the SPA
   could ship green.

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

* add the `NODE_VERSION: "22"` env block next to the `on:` block,
* replace every `node-version: 20` with `node-version: ${{ env.NODE_VERSION }}`,
* replace `npm i` / `cd workers/api && npm i` with `npm ci` (plus
  `working-directory: workers/api` for the worker steps),
* keep the `wrangler-action` and `vercel-action` steps unchanged.

## What still works without this change

Nothing in the runtime depends on CI: Vercel and Cloudflare builds are driven
by their own pipelines, and every check above can be run locally with:

```bash
npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build
cd workers/api && npm ci && npm run lint && npx tsc --noEmit && npm test
```
