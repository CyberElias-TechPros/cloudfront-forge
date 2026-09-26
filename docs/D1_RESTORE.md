# D1 point-in-time restore runbook

How to recover the production database (`creatorloop-db`) after bad data, a
failed migration, or accidental deletions. Closes the "no D1 restore procedure"
item from `RECONSTRUCTION_REPORT.md` §15.

## What you get

Cloudflare D1 **Time Travel** is enabled by default and keeps an append-only
bookmark log of every state of the database:

| Plan | Retention |
| ---- | --------- |
| Workers Paid | last **30 days** |
| Workers Free | last **7 days** |

Timestamps convert to bookmarks deterministically: the same timestamp always
resolves to the same bookmark. Restoring **does not** delete older bookmarks —
if you restore to the wrong point, you can restore again to the bookmark that
the restore command prints (an "undo").

Scope: Time Travel covers the **D1 database only**. KV (sessions, watch
nonces), R2 (video files), email/push side effects and code deployments are
*not* rolled back. R2 objects are keyed by rows in D1 — restore first, then
check for orphaned rows/objects (see Post-restore checklist).

## Prerequisites

- `wrangler` v4 authenticated against the production account
  (`wrangler whoami`, or `CLOUDFLARE_API_TOKEN` with **D1 Edit**).
- Run every command from `workers/api/`.
- The incident timestamp in **UTC** (`date -u +"%Y-%m-%dT%H:%M:%SZ"` gets it;
  add timezone offsets if you only know local time).

## The runbook

### 0. Freeze the damage

Stop deploys and migrations (`npm run release` is blocked while you recover),
and tell the team writes are about to be interrupted — **in-flight queries are
cancelled** when the restore runs.

### 1. Resolve a target bookmark (read-only, safe to repeat)

Pick the last good moment — usually a minute or two before the incident:

```sh
cd workers/api
npx wrangler d1 time-travel info creatorloop-db \
  --timestamp="2026-09-25T14:31:00Z"
```

The command prints the bookmark for that moment:

```
⚠️ The current bookmark is '00000085-0000024c-…'
⚡️ To restore to this specific bookmark, run:
 `wrangler d1 time-travel restore creatorloop-db --bookmark=00000085-…`
```

To see the *current* bookmark (freshness check), run the command without
`--timestamp`.

### 2. Restore (destructive, in place)

Confirm the bookmark from step 1, then:

```sh
npx wrangler d1 time-travel restore creatorloop-db --bookmark='00000085-…'
```

(`--timestamp="…"` also works directly, but going through `info` first means
you have eyeballed the target before anything is overwritten.)

You will be asked `✔ OK to proceed (y/N)`. On success the command prints:

- `✅ Database … restored back to bookmark '<new>'` — the new head, and
- `↩️ To undo this operation, you can restore to the previous bookmark: '<old>'`
  — **save both bookmarks in the incident notes before you close the tab.**

Typical restore time is seconds to a few minutes; the database is unavailable
until it finishes.

### 3. Reconcile the schema if the rollback crossed a migration

Migrations are recorded **by filename**, and restored files count as applied.
If the incident happened mid-deploy:

```sh
npx wrangler d1 migrations list creatorloop-db --remote   # what D1 thinks
ls migrations/                                            # what the repo has
```

- Migrations **after** the restore point now look unapplied. If the deploy that
  added them is still current, re-run the normal deploy path
  (`npm run release` → applies migrations, then deploys code).
- If the migration itself caused the incident, roll the *code* back first
  (deploy the previous Worker version), and do **not** re-apply the bad file
  until it is fixed. Never rename a migration file — D1 keys on the filename.

### 4. Post-restore checklist

1. `curl https://creatorloop-api.autumn-surf-21ec.workers.dev/health` → 200,
   then `/ready` → 200.
2. Smoke the happy paths: sign in, open the dashboard, submit a video, check
   the notifications page.
3. Reconcile out-of-band state:
   - **R2**: video objects whose rows were rolled back (rows gone, object
     present) are harmless storage-wise; rows present but objects missing
     should be reported for re-upload.
   - **Email/push**: members may receive messages derived from pre-restore
     state — send a correction if a decision changed.
   - **KV**: watch-session nonces and rate-limit counters self-heal; no
     action needed.
4. Attach the before/after bookmarks and the incident timestamp to the
   incident write-up.

### 5. If you went too far (the undo)

Restore again to the bookmark printed as `↩️ To undo this operation…` in
step 2 — restores never invalidate older bookmarks, so the pre-restore state
is still reachable.

## Complementary: logical exports

Time Travel is the recovery mechanism; a logical export is useful for
archival, offline inspection, or copying a sanitized snapshot:

```sh
npx wrangler d1 export creatorloop-db --remote --output "backup-$(date -u +%F).sql"
```

Exports are **not** a substitute for Time Travel (they are point-in-time
copies you must remember to take; Time Travel records every state
automatically). Keep export files out of Git — they contain all member data.

## Drills

Run a restore drill at least quarterly: resolve an old bookmark with
`time-travel info` (read-only) to confirm retention still reaches back as far
as your RTO assumes, and once `creatorloop-db-staging` has a real id, do a
full `time-travel restore` against staging and walk the post-restore checklist
there.
