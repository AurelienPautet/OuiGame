#!/usr/bin/env sh
# Preview container entrypoint.
#
# Runs an EMBEDDED, throwaway Postgres inside this same container, because
# Coolify renames containers per preview (e.g. postgres-<uuid>-pr83), which
# breaks cross-container DNS — a sidecar `postgres` service isn't reachable. The
# app therefore talks to 127.0.0.1 (DB_HOST), and there is no inter-container
# networking to go wrong.
#
# Steps:
#   1. start the embedded Postgres and create the app's role + database;
#   2. if a production snapshot is configured (PREVIEW_DUMP_S3_* env vars), pull
#      it from S3-compatible storage and restore it (a FULL prod copy — gate
#      previews behind auth; see PREVIEW.md). Otherwise start with an empty DB.
#   3. reconcile the schema to THIS PR with `drizzle-kit push --force`;
#   4. start the server (which also serves apps/web/dist).
set -eu

PGBIN="$(ls -d /usr/lib/postgresql/*/bin | head -n1)"
PGDATA=/var/lib/postgresql/data

echo "→ Starting embedded Postgres…"
mkdir -p "$PGDATA" /var/run/postgresql
chown -R postgres:postgres "$PGDATA" /var/run/postgresql
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  su postgres -c "$PGBIN/initdb -D $PGDATA --auth-local=trust --auth-host=trust" >/dev/null
fi
su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-c listen_addresses=127.0.0.1 -p ${DB_PORT}' -w -t 60 start"

# Role + database matching the app's DB_* env (idempotent).
su postgres -c "psql -p ${DB_PORT} -tAc \"SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'\"" | grep -q 1 \
  || su postgres -c "psql -p ${DB_PORT} -c \"CREATE ROLE ${DB_USER} LOGIN SUPERUSER PASSWORD '${DB_PASSWORD}'\""
su postgres -c "psql -p ${DB_PORT} -tAc \"SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'\"" | grep -q 1 \
  || su postgres -c "createdb -p ${DB_PORT} -O ${DB_USER} ${DB_NAME}"

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
