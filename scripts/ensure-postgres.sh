#!/usr/bin/env sh
# Ensure the local Postgres dev container is up before `pnpm dev`.
#
# Behaviour:
#   - already running  -> no-op
#   - exists, stopped  -> `docker start`
#   - does not exist   -> `docker run` (creates it, with a persistent volume)
# Then it waits until Postgres accepts connections so the API doesn't race the DB.
#
# Connection settings are read from the repo-root .env (the same file the app
# uses) so the container always matches DB_PORT/DB_USER/DB_PASSWORD/DB_NAME.
# Defaults below mirror .env.example for the case where .env is absent.
set -e

CONTAINER_NAME=ouigame-postgres
IMAGE=postgres:16
VOLUME_NAME=ouigame-pgdata

# Resolve the repo root from this script's location so it works regardless of cwd.
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ENV_FILE="$SCRIPT_DIR/../.env"

# Read a single KEY=value from .env without sourcing it (avoids executing
# arbitrary file contents). Falls back to the provided default.
read_env() {
  _key=$1
  _default=$2
  if [ -f "$ENV_FILE" ]; then
    _val=$(grep -E "^${_key}=" "$ENV_FILE" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '\r')
  fi
  if [ -n "$_val" ]; then
    printf '%s' "$_val"
  else
    printf '%s' "$_default"
  fi
  unset _key _default _val
}

DB_PORT=$(read_env DB_PORT 5433)
DB_USER=$(read_env DB_USER ouigame)
DB_PASSWORD=$(read_env DB_PASSWORD ouigame)
DB_NAME=$(read_env DB_NAME ouigame)

# Docker must be installed and the daemon reachable.
if ! command -v docker >/dev/null 2>&1; then
  echo "✗ docker not found — install Docker Desktop to run the local Postgres DB." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "✗ Docker daemon not reachable — start Docker Desktop and retry." >&2
  exit 1
fi

# Already running? nothing to do.
if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null)" = "true" ]; then
  echo "✓ Postgres container '$CONTAINER_NAME' already running on localhost:$DB_PORT."
  exit 0
fi

# Exists but stopped? start it. Otherwise create it.
if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "▶ Starting existing Postgres container '$CONTAINER_NAME'…"
  docker start "$CONTAINER_NAME" >/dev/null
else
  echo "▶ Creating Postgres container '$CONTAINER_NAME' ($IMAGE) on port $DB_PORT…"
  docker run -d \
    --name "$CONTAINER_NAME" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB="$DB_NAME" \
    -p "$DB_PORT:5432" \
    -v "$VOLUME_NAME:/var/lib/postgresql/data" \
    "$IMAGE" >/dev/null
  echo "  (fresh database — run \`pnpm db:migrate\` if the schema isn't applied yet)"
fi

# Wait until Postgres is accepting connections (max ~30s).
printf '⏳ Waiting for Postgres to accept connections'
i=0
until docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo
    echo "✗ Postgres did not become ready within 30s." >&2
    exit 1
  fi
  printf '.'
  sleep 1
done
echo
echo "✓ Postgres is ready on localhost:$DB_PORT."
