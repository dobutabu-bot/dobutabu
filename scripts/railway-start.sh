#!/bin/sh
set -eu

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export DOCUMENT_STORAGE_DIR="${DOCUMENT_STORAGE_DIR:-/data/documents}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

case "$DATABASE_URL" in
  file:*)
    DB_PATH="${DATABASE_URL#file:}"
    DB_DIR="$(dirname "$DB_PATH")"
    mkdir -p "$DB_DIR"
    ;;
esac

mkdir -p "$DOCUMENT_STORAGE_DIR"

if ! touch /data/.write-check >/dev/null 2>&1; then
  echo "Railway persistent volume is not writable." >&2
  exit 1
fi
rm -f /data/.write-check

if ! touch "$DOCUMENT_STORAGE_DIR/.write-check" >/dev/null 2>&1; then
  echo "Document storage is not writable." >&2
  exit 1
fi
rm -f "$DOCUMENT_STORAGE_DIR/.write-check"

npx prisma migrate deploy

exec npm run start
