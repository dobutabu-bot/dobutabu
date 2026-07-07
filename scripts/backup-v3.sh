#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
DOCUMENT_STORAGE_DIR="${DOCUMENT_STORAGE_DIR:-$ROOT_DIR/storage/documents}"
DRY_RUN="${DRY_RUN:-0}"

if [ -f "$ENV_FILE" ]; then
  DATABASE_URL_FROM_ENV="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- | tr -d '"' || true)"
  DOCUMENT_STORAGE_FROM_ENV="$(grep -E '^DOCUMENT_STORAGE_DIR=' "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- | tr -d '"' || true)"
  DATABASE_URL="${DATABASE_URL:-$DATABASE_URL_FROM_ENV}"
  if [ -n "$DOCUMENT_STORAGE_FROM_ENV" ] && [ "${DOCUMENT_STORAGE_DIR}" = "$ROOT_DIR/storage/documents" ]; then
    DOCUMENT_STORAGE_DIR="$DOCUMENT_STORAGE_FROM_ENV"
  fi
fi

resolve_path() {
  case "$1" in
    /*) printf "%s" "$1" ;;
    ./*) printf "%s" "$ROOT_DIR/${1#./}" ;;
    *) printf "%s" "$ROOT_DIR/$1" ;;
  esac
}

BACKUP_DIR="$(resolve_path "$BACKUP_DIR")"
DOCUMENT_STORAGE_DIR="$(resolve_path "$DOCUMENT_STORAGE_DIR")"
DATABASE_URL="${DATABASE_URL:-file:./dev.db}"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
TARGET_DIR="$BACKUP_DIR/buro-finans-v3-$STAMP"

log() {
  echo "$1"
}

run_or_echo() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

resolve_sqlite_path() {
  DB_PATH="${DATABASE_URL#file:}"
  case "$DB_PATH" in
    /*) printf "%s" "$DB_PATH" ;;
    *) printf "%s" "$ROOT_DIR/prisma/$DB_PATH" ;;
  esac
}

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1"
  else
    shasum -a 256 "$1"
  fi
}

if [ "$DRY_RUN" != "1" ]; then
  mkdir -p "$TARGET_DIR"
fi

log "V3 yedek hedefi: $TARGET_DIR"

case "$DATABASE_URL" in
  file:*)
    DB_FILE="$(resolve_sqlite_path)"
    if [ ! -f "$DB_FILE" ]; then
      echo "SQLite veritabani bulunamadi: $DB_FILE" >&2
      exit 1
    fi
    run_or_echo cp "$DB_FILE" "$TARGET_DIR/database.sqlite"
    if [ "$DRY_RUN" != "1" ]; then
      hash_file "$TARGET_DIR/database.sqlite" > "$TARGET_DIR/database.sqlite.sha256"
    fi
    ;;
  postgresql://*|postgres://*)
    if ! command -v pg_dump >/dev/null 2>&1; then
      echo "PostgreSQL yedegi icin pg_dump komutu gerekli." >&2
      exit 1
    fi
    if [ "$DRY_RUN" = "1" ]; then
      echo "[dry-run] pg_dump --format=custom --file $TARGET_DIR/database.pgcustom"
    else
      pg_dump "$DATABASE_URL" --format=custom --file "$TARGET_DIR/database.pgcustom"
      hash_file "$TARGET_DIR/database.pgcustom" > "$TARGET_DIR/database.pgcustom.sha256"
    fi
    ;;
  *)
    echo "Desteklenmeyen DATABASE_URL. SQLite file: veya PostgreSQL URL kullanin." >&2
    exit 1
    ;;
esac

if [ -d "$DOCUMENT_STORAGE_DIR" ]; then
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] document storage manifest ve tar.gz olusturulur: $DOCUMENT_STORAGE_DIR"
  else
    (
      cd "$DOCUMENT_STORAGE_DIR"
      find . -type f | sort | while IFS= read -r file; do
        size="$(wc -c < "$file" | tr -d ' ')"
        hash="$(hash_file "$file" | awk '{print $1}')"
        printf "%s\t%s\t%s\n" "${file#./}" "$size" "$hash"
      done
    ) > "$TARGET_DIR/document-storage-manifest.tsv"
    tar -C "$DOCUMENT_STORAGE_DIR" -czf "$TARGET_DIR/document-files.tar.gz" .
    hash_file "$TARGET_DIR/document-files.tar.gz" > "$TARGET_DIR/document-files.tar.gz.sha256"
  fi
else
  log "Belge storage klasoru bulunamadi, bos manifest yazilacak: $DOCUMENT_STORAGE_DIR"
  if [ "$DRY_RUN" != "1" ]; then
    : > "$TARGET_DIR/document-storage-manifest.tsv"
  fi
fi

if [ "$DRY_RUN" != "1" ]; then
  cat > "$TARGET_DIR/README.txt" <<EOF
Buro Finans V3 yedek paketi
Olusturma zamani: $STAMP

Icerik:
- database.sqlite veya database.pgcustom: Prisma veritabani yedegi. V3 belge metadata, banka ekstresi, mutabakat, sermaye ve audit log tablolarini icerir.
- document-storage-manifest.tsv: Private belge storage dosyalarinin boyut ve SHA-256 listesi.
- document-files.tar.gz: Fiziksel private belge dosyalari.

Uyari:
Bu paket muvekkil bilgisi, finansal veri, banka ekstresi rawData, belge metadata/extractedText ve fiziksel belge dosyalari icerebilir. Sifreli ve guvenli yerde saklayiniz.
EOF
fi

log "V3 yedek tamamlandi:"
log "$TARGET_DIR"
