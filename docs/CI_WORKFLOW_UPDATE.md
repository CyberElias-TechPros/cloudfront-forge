# CI/CD workflow status

The workflow hardening described in earlier revisions is now implemented in
`.github/workflows/ci.yml` and `.github/workflows/deploy.yml`.

## CI guarantees

- Node 22 for the frontend and Worker.
- Reproducible `npm ci` installs from both lockfiles.
- Frontend lint, typecheck, tests, and production build.
- Worker lint/typecheck and the behavioural suite over a real SQLite database
  with every migration applied.
- Per-ref concurrency so an obsolete CI run is cancelled.

## Production deployment order

The production workflow is serialized and deploys in this order:

1. install, typecheck, and test the Worker;
2. apply production D1 migrations with Wrangler;
3. deploy the Worker;
4. gate on `GET /ready` (bindings + current schema);
5. test/build the SPA;
6. deploy Vercel with `--prod`.

That order is a correctness requirement. Deploying Worker code before D1 is the
failure mode that causes a new column referenced at the API entry point to turn
every authenticated endpoint into a 500.

## Required GitHub secrets

Configure these as repository secrets or in the `Production` environment:

- `CLOUDFLARE_API_TOKEN` — scoped to this account, with Workers Scripts and D1
  edit permissions;
- `CLOUDFLARE_ACCOUNT_ID`;
- `VERCEL_TOKEN`;
- `VERCEL_ORG_ID`;
- `VERCEL_PROJECT_ID`.

Do not use a Cloudflare Global API key in CI. Rotate any key that has been
shared in plaintext.

## Avoid competing deploy systems

Use one production owner. If GitHub Actions owns deployment, disable direct Git
auto-deploy in Cloudflare Workers Builds. If Workers Builds owns deployment,
configure its production command to run `npm run release` in `workers/api`
(which migrates D1 before deploy), keep pull-request previews on the code-only
`npm run deploy`, and disable the duplicate GitHub backend deploy.
See `docs/DEPLOYMENT.md` for the full runbook.
