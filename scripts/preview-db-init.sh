#!/usr/bin/env sh
# Preview container entrypoint.
#
# 1. If a production snapshot is configured (PREVIEW_DUMP_S3_* env vars), pull it
#    from S3-compatible storage and restore it into the fresh, isolated preview
#    Postgres. The snapshot is a FULL copy of production (see
#    scripts/preview-snapshot.sh) — this is why preview environments MUST be
#    access-gated (Coolify Basic Auth). With no snapshot configured, the preview
#    just starts with an empty database.
# 2. Reconcile the schema to THIS PR's version with `drizzle-kit push --force`
#    (so a PR that changes the schema still works on top of the prod snapshot).
# 3. Start the server (which also serves apps/web/dist).
set -eu

DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

if [ -n "${PREVIEW_DUMP_S3_ENDPOINT:-}" ]; then
  OBJECT="${PREVIEW_DUMP_OBJECT:-preview-seed/latest.sql.gz}"
  echo "→ Fetching production snapshot from ${PREVIEW_DUMP_S3_BUCKET}/${OBJECT}…"
  mc alias set seed \
    "$PREVIEW_DUMP_S3_ENDPOINT" \
    "$PREVIEW_DUMP_S3_ACCESS_KEY" \
    "$PREVIEW_DUMP_S3_SECRET_KEY" >/dev/null
  mc cp "seed/${PREVIEW_DUMP_S3_BUCKET}/${OBJECT}" /tmp/seed.sql.gz
  echo "→ Restoring snapshot…"
  gunzip -c /tmp/seed.sql.gz | psql "$DB_URL" >/dev/null
  rm -f /tmp/seed.sql.gz
  echo "✓ Snapshot restored."
else
  echo "→ PREVIEW_DUMP_S3_ENDPOINT not set — starting with an empty database."
fi

echo "→ Reconciling schema to this PR (drizzle-kit push)…"
pnpm exec drizzle-kit push --force

echo "→ Starting server…"
exec pnpm exec tsx apps/api/server.ts
