# Per-PR preview environments (Coolify)

Every pull request gets its own throwaway, full-stack deployment — the web
client, the Express/Socket.io server, **and** an isolated Postgres seeded from a
production snapshot — reachable at a stable URL. It costs nothing beyond the VPS
that already runs Coolify (no per-PR managed database to pay for), and production
is never touched.

## How it works

The API server already serves the built web client (`apps/api/server.ts` →
`express.static(../web/dist)`), so a preview is **one container**: front + API +
websocket on the same origin, with **Postgres running embedded inside it**
(Coolify renames containers per preview, which breaks cross-container DNS — so a
sidecar DB service isn't reliable; the app talks to `127.0.0.1`).

| File                                        | Role                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `Dockerfile`                                | Builds `@ouigame/shared` + web + bundles Postgres, runs the boot script |
| `docker-compose.preview.yml`                | A single `app` container (Postgres is embedded, not a sidecar)          |
| `scripts/preview-db-init.sh`                | Entrypoint: start embedded PG → restore snapshot → push → start         |
| `scripts/preview-snapshot.sh`               | Dumps the `OuiTank-*` prod tables to S3 (run from CI/cron)              |
| `.github/workflows/preview-db-snapshot.yml` | Scheduled job that publishes a fresh prod snapshot                      |
| `.github/workflows/preview-url.yml`         | Posts the preview URL as a sticky PR comment                            |

The web client is built with `VITE_API_URL=/api` and `VITE_SOCKET_URL=/`
(**same-origin**), because it otherwise hard-codes the production backend. Same
origin means **zero CORS/CSP changes** and one image that works for any preview
URL.

On boot the container (`scripts/preview-db-init.sh`):

1. pulls the latest production snapshot from S3-compatible storage and restores
   it into the fresh preview Postgres (skipped if `PREVIEW_DUMP_S3_ENDPOINT` is
   unset — then it starts with an empty DB);
2. runs `drizzle-kit push --force` to reconcile the schema to **this PR's**
   version (so schema-changing PRs work on top of the prod snapshot — `push`,
   not `migrate`, because migration `0000` assumes a pre-existing DB, the same
   reason the Jest setup uses push);
3. starts the server.

## ⚠️ The snapshot is a FULL copy of OuiTank's production data

The snapshot is scoped to the `OuiTank-*` tables (other apps sharing the prod
database are excluded), but it is still an **unredacted** copy of OuiTank's own
data — emails, password hashes, Google IDs, **session tokens** and IP addresses.
That is a deliberate choice for maximum realism, and it makes two things
**mandatory**:

- **Gate every preview behind Coolify Basic Auth** (see setup below). Previews
  run unreviewed PR code against real credentials; they must never be publicly
  reachable.
- **Keep the snapshot bucket private.** Never point the snapshot at a public
  bucket.

## One-time Coolify setup

1. **Connect the repo** to your Coolify project via the **GitHub App** (not a
   deploy key — preview deployments require the App so Coolify sees PR events).
2. **Create a resource** of type **Docker Compose**, pointing at
   `docker-compose.preview.yml`.
3. **Enable Preview Deployments** on that resource.
4. **Set the preview domain template** to `pr-{{pr_id}}.<your-base-domain>`
   (e.g. `pr-{{pr_id}}.preview.pautet.net`). Point a wildcard DNS record
   `*.preview.pautet.net` at the VPS so every PR resolves.
5. **Enable Basic Auth** on the resource and set a username/password. This is
   the access gate for the full-prod-data previews — do not skip it.
6. **Fill the snapshot env vars** on the resource (matching the GitHub config
   below): `PREVIEW_DUMP_S3_ENDPOINT`, `PREVIEW_DUMP_S3_BUCKET`,
   `PREVIEW_DUMP_S3_ACCESS_KEY`, `PREVIEW_DUMP_S3_SECRET_KEY`.

Open a PR and Coolify builds `pr-<n>.preview.pautet.net`, tearing it down when
the PR closes.

## Production snapshot pipeline

`.github/workflows/preview-db-snapshot.yml` dumps prod daily (and on demand via
_Run workflow_) and uploads it to S3-compatible storage. Any S3 backend works —
self-hosted **MinIO** on your VPS (one-click in Coolify), **Cloudflare R2**, or
**Backblaze B2** (both have free tiers).

Configure under _Settings → Secrets and variables → Actions_:

| Kind     | Name                         | Example                            |
| -------- | ---------------------------- | ---------------------------------- |
| Variable | `PREVIEW_DUMP_S3_ENDPOINT`   | `https://minio.pautet.net`         |
| Variable | `PREVIEW_DUMP_S3_BUCKET`     | `ouitank-preview`                  |
| Secret   | `PROD_DATABASE_URL`          | the Heroku Postgres connection URL |
| Secret   | `PREVIEW_DUMP_S3_ACCESS_KEY` | S3 access key                      |
| Secret   | `PREVIEW_DUMP_S3_SECRET_KEY` | S3 secret key                      |

The same `PREVIEW_DUMP_S3_*` values go on the Coolify resource so previews can
read the snapshot back. (A read-only S3 key is enough on the Coolify side.)

## Showing the URL on the PR

Two independent paths (use either or both):

- **Coolify native** — recent Coolify versions can comment the preview URL on
  the PR automatically once deployment succeeds. Enable it on the resource if
  available.
- **`preview-url.yml`** (included) — posts/updates a sticky comment with the
  deterministic URL. Requires a repository **variable** `PREVIEW_BASE_DOMAIN`
  (e.g. `preview.pautet.net`).

## Dependabot

No preview is built for Dependabot PRs: `preview-url.yml` skips
`dependabot[bot]`, and in Coolify you can additionally exclude branches matching
`dependabot/**` from preview deployments.

## Known limitations

- **Google sign-in is disabled** in previews — OAuth needs fixed authorized
  origins, and preview URLs are dynamic. The server only warns; everything else
  works. (Solo play needs no login at all.)
- The preview database is **reset to the latest snapshot on every redeploy** —
  by design. Don't rely on data persisting across pushes.
