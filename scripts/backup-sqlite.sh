#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
DOCUMENT_STORAGE_DIR="${DOCUMENT_STORAGE_DIR:-$ROOT_DIR/storage/documents}"

if [ ! -f "$ENV_FILE" ]; then
  echo ".env dosyasi bulunamadi: $ENV_FILE" >&2
  exit 1
fi

DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- | tr -d '"')"

case "$DATABASE_URL" in
  file:*)
    DB_PATH="${DATABASE_URL#file:}"
    ;;
  *)
    echo "Bu script yalnizca SQLite file: DATABASE_URL icin kullanilir." >&2
    exit 1
    ;;
esac

case "$DB_PATH" in
  /*)
    DB_FILE="$DB_PATH"
    ;;
  *)
    DB_FILE="$ROOT_DIR/prisma/$DB_PATH"
    ;;
esac

if [ ! -f "$DB_FILE" ]; then
  echo "SQLite veritabani bulunamadi: $DB_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
TARGET="$BACKUP_DIR/buro-finans-sqlite-$STAMP.db"

cp "$DB_FILE" "$TARGET"
shasum -a 256 "$TARGET" > "$TARGET.sha256"

echo "SQLite yedegi olusturuldu:"
echo "$TARGET"
echo "$TARGET.sha256"
echo ""
echo "Not: V3 belge merkezi fiziksel dosyalari SQLite dosyasinin icinde degildir."
echo "Belge dosyalarini ayri yedeklemek icin: sh scripts/backup-v3.sh"
echo "Beklenen belge storage klasoru: $DOCUMENT_STORAGE_DIR"
