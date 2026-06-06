#!/usr/bin/env sh
# Dumps the PRODUCTION database and uploads it to S3-compatible storage, so the
# per-PR preview environments can restore it at boot (scripts/preview-db-init.sh).
#
# ⚠️  This is a FULL, UNREDACTED copy of production — including emails, password
#     hashes, Google IDs, session tokens and IP addresses. The snapshot bucket
#     and every preview that restores it MUST be access-gated (Coolify Basic
#     Auth). Do not point this at a public bucket.
#
# Intended to run from CI on a schedule (.github/workflows/preview-db-snapshot.yml)
# or from a cron job. Requires `pg_dump`, `gzip` and `mc` (MinIO client).
set -eu

: "${PROD_DATABASE_URL:?set PROD_DATABASE_URL (production connection string)}"
: "${PREVIEW_DUMP_S3_ENDPOINT:?set PREVIEW_DUMP_S3_ENDPOINT}"
: "${PREVIEW_DUMP_S3_BUCKET:?set PREVIEW_DUMP_S3_BUCKET}"
: "${PREVIEW_DUMP_S3_ACCESS_KEY:?set PREVIEW_DUMP_S3_ACCESS_KEY}"
: "${PREVIEW_DUMP_S3_SECRET_KEY:?set PREVIEW_DUMP_S3_SECRET_KEY}"
OBJECT="${PREVIEW_DUMP_OBJECT:-preview-seed/latest.sql.gz}"

echo "→ Dumping production database…"
# --clean --if-exists makes the dump idempotent so it restores cleanly onto a
# fresh DB; --no-owner/--no-privileges drop prod-specific roles/grants.
# Dump to a file (not piped into gzip): `sh`/dash has no `pipefail`, so a piped
# pg_dump failure would be masked by gzip's success and we'd upload an empty
# snapshot. With `set -e` a direct redirect aborts on a failed pg_dump.
pg_dump --no-owner --no-privileges --clean --if-exists "$PROD_DATABASE_URL" \
  >/tmp/preview-seed.sql
gzip -f /tmp/preview-seed.sql
echo "✓ Dump size: $(du -h /tmp/preview-seed.sql.gz | cut -f1)"

echo "→ Uploading to ${PREVIEW_DUMP_S3_BUCKET}/${OBJECT}…"
mc alias set snap \
  "$PREVIEW_DUMP_S3_ENDPOINT" \
  "$PREVIEW_DUMP_S3_ACCESS_KEY" \
  "$PREVIEW_DUMP_S3_SECRET_KEY" >/dev/null
# Best-effort bucket creation. A bucket-scoped key (recommended) isn't entitled
# to create buckets and the bucket is expected to already exist, so ignore any
# failure here — the upload below only needs write access to the bucket.
mc mb --ignore-existing "snap/${PREVIEW_DUMP_S3_BUCKET}" 2>/dev/null || true
mc cp /tmp/preview-seed.sql.gz "snap/${PREVIEW_DUMP_S3_BUCKET}/${OBJECT}"
rm -f /tmp/preview-seed.sql.gz
echo "✓ Snapshot published."
