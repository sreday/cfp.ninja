# Database backups (Neon) - proposal

Production runs on Heroku (`cfpninja`), but the database is **not** a Heroku
Postgres add-on: `DATABASE_URL` points to Neon (`eu-west-2.aws.neon.tech`).
So `heroku pg:backups:capture` does nothing ("cfpninja has no databases"), and
nothing in this repo takes a backup before a deploy or a migration.

Everything below is a suggestion for Miko to pick from. Nothing here runs on
its own.

## What we want

- A restore point **before every deploy that touches models or the database**
  (and ideally before every deploy).
- A copy of the data that does not depend on a single Neon account.
- A short, boring restore procedure written down before we need it.

## Option A - Neon branch before each deploy (fastest)

Neon branches are copy-on-write: creating one is instant and does not copy data.
A branch made right before a deploy is a restore point.

```sh
# one-off: npm i -g neonctl && neonctl auth
neonctl branches create --project-id <project> --name pre-deploy-$(date +%Y%m%d-%H%M)
```

Restore = point the app at that branch, or reset the main branch from it (Neon
console > Branches). Old `pre-deploy-*` branches can be deleted after a week.
Branches count against the plan's branch limit.

## Option B - Neon point-in-time restore (already there)

Neon keeps the write history for the project's **history retention** window
(set per project; check Settings > Storage). Within that window the database
can be restored to any timestamp. Worth checking the window is long enough
(a day at least) and writing down the deploy time with every deploy.

## Option C - our own dump (independent of Neon)

`make db-backup` (added in this PR) runs `pg_dump` against the production URL
taken from Heroku at run time, without printing it, and writes a compressed
custom-format dump to `backups/` (git-ignored):

```sh
make db-backup            # needs pg_dump 16+ and `heroku login`
# restore into a scratch database to check it:
pg_restore --no-owner --dbname "$SCRATCH_URL" backups/cfpninja-YYYYmmdd-HHMMSS.dump
```

This is the only option that also covers "the Neon project is gone". The dump
contains every user, event and proposal, so it must stay off shared drives and
out of git.

## Suggested routine

1. Before a deploy: list what ships (`git log <live sha>..main`), flag model or
   migration changes.
2. If anything touches models, migrations or deletions: Option A (or C) first.
3. Deploy, check the logs, note the time (for Option B).
4. Weekly: a `make db-backup` kept somewhere private, the last few retained.

## Related

- Production never runs the full auto-migrate (`DATABASE_AUTO_MIGRATE` is
  unset). Turning it on would also run `CreatePartialUniqueIndexes`, which drops
  the old API-key columns and indexes. Small, additive column changes are done
  at startup instead (see `server.EnsureStatusChangedByColumn`).
- Pending deploy waiting on this: `ac31c5f` ("Accepted by" + organiser Bcc on
  acceptances), which adds one nullable column `proposals.status_changed_by_id`
  at startup. It is merged to main but not deployed (production is v65).
