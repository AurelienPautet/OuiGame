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
pg_dump --no-owner --no-privileges --clean --if-exists "$PROD_DATABASE_URL" \
  | gzip >/tmp/preview-seed.sql.gz
echo "✓ Dump size: $(du -h /tmp/preview-seed.sql.gz | cut -f1)"

echo "→ Uploading to ${PREVIEW_DUMP_S3_BUCKET}/${OBJECT}…"
mc alias set snap \
  "$PREVIEW_DUMP_S3_ENDPOINT" \
  "$PREVIEW_DUMP_S3_ACCESS_KEY" \
  "$PREVIEW_DUMP_S3_SECRET_KEY" >/dev/null
mc cp /tmp/preview-seed.sql.gz "snap/${PREVIEW_DUMP_S3_BUCKET}/${OBJECT}"
rm -f /tmp/preview-seed.sql.gz
echo "✓ Snapshot published."
