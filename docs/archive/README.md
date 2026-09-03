# Archived documents

Everything in this folder is a **historical snapshot**: audits, gap analyses,
setup walkthroughs and status reports written during earlier iterations of the
project (several predate the move to a static SPA on Vercel + a Cloudflare
Workers API, and a few describe features that were never built).

They are kept for context, **not** as instructions. Where they disagree with

- [`../README.md`](../README.md) — overview, local development, scripts
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — runtime and data architecture
- [`../DEPLOYMENT.md`](../DEPLOYMENT.md) — the deployment runbook
- [`../API.md`](../API.md) — the current endpoint catalogue
- [`../CI_WORKFLOW_UPDATE.md`](../CI_WORKFLOW_UPDATE.md) — CI changes awaiting a
  manual apply

…the documents outside this folder win.

Two things in here were actively harmful and have been scrubbed from the tree:
a real-looking Firebase web API key (replaced with `YOUR_FIREBASE_WEB_API_KEY`)
and a service-account private-key example. `src/tests/repo-hygiene.test.ts`
fails the build if either shape ever comes back.
