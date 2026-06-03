# Per-PR preview environments (Coolify)

Every pull request gets its own throwaway, full-stack deployment — the web
client, the Express/Socket.io server, **and** an isolated Postgres — reachable at
a stable URL. It costs nothing beyond the VPS that already runs Coolify (no
per-PR managed database to pay for), and production is never touched.

## How it works

The API server already serves the built web client (`apps/api/server.ts` →
`express.static(../web/dist)`), so a preview is **one container**: front + API +
websocket on the same origin.

| File                                | Role                                                            |
| ----------------------------------- | --------------------------------------------------------------- |
| `Dockerfile`                        | Builds `@ouigame/shared` + the web client, runs `tsx server.ts` |
| `docker-compose.preview.yml`        | `app` + an ephemeral `postgres:16` (no persistent volume)       |
| `.github/workflows/preview-url.yml` | Posts the preview URL as a sticky PR comment                    |

The web client is built with `VITE_API_URL=/api` and `VITE_SOCKET_URL=/`
(**same-origin**), because it otherwise hard-codes the production backend. Same
origin means **zero CORS/CSP changes** and one image that works for any preview
URL.

On boot the container runs `drizzle-kit push --force` against the fresh DB
(`push`, not `migrate` — migration `0000` assumes a pre-existing database, the
same reason the Jest setup uses push), then starts the server.

## One-time Coolify setup

1. **Connect the repo** to your Coolify project via the **GitHub App** (not a
   deploy key — preview deployments require the App so Coolify sees PR events).
2. **Create a resource** of type **Docker Compose**, pointing at
   `docker-compose.preview.yml`.
3. **Enable Preview Deployments** on that resource.
4. **Set the preview domain template** to `pr-{{pr_id}}.<your-base-domain>`
   (e.g. `pr-{{pr_id}}.preview.pautet.net`). Point a wildcard DNS record
   `*.preview.pautet.net` at the VPS so every PR resolves.

That's it — open a PR and Coolify builds `pr-<n>.preview.pautet.net`, tearing it
down when the PR closes.

## Showing the URL on the PR

Two independent paths (use either or both):

- **Coolify native** — recent Coolify versions can comment the preview URL on
  the PR automatically once deployment succeeds. Enable it on the resource if
  available.
- **`preview-url.yml`** (included) — posts/updates a sticky comment with the
  deterministic URL. Requires a repository **variable** (not secret):
  `PREVIEW_BASE_DOMAIN` = your base domain (e.g. `preview.pautet.net`), under
  _Settings → Secrets and variables → Actions → Variables_.

## Dependabot

No preview is built for Dependabot PRs: `preview-url.yml` skips
`dependabot[bot]`, and in Coolify you can additionally exclude branches matching
`dependabot/**` from preview deployments.

## Known limitations

- **Google sign-in is disabled** in previews — OAuth needs fixed authorized
  origins, and preview URLs are dynamic. The server only warns; everything else
  works. (Solo play needs no login at all.)
- The preview database is **wiped on every redeploy** — by design. Don't rely on
  data persisting across pushes.
