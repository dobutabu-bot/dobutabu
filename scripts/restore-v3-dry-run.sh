#!/usr/bin/env sh
set -eu

BACKUP_PATH="${1:-}"

if [ -z "$BACKUP_PATH" ]; then
  echo "Kullanim: sh scripts/restore-v3-dry-run.sh /path/to/buro-finans-v3-YYYY-MM-DD_HH-MM-SS" >&2
  exit 1
fi

if [ ! -d "$BACKUP_PATH" ]; then
  echo "Yedek klasoru bulunamadi: $BACKUP_PATH" >&2
  exit 1
fi

echo "V3 restore dry-run basladi: $BACKUP_PATH"

if [ -f "$BACKUP_PATH/database.sqlite" ]; then
  echo "OK database.sqlite bulundu."
elif [ -f "$BACKUP_PATH/database.pgcustom" ]; then
  echo "OK database.pgcustom bulundu."
else
  echo "HATA: database.sqlite veya database.pgcustom bulunamadi." >&2
  exit 1
fi

if [ -f "$BACKUP_PATH/document-storage-manifest.tsv" ]; then
  echo "OK document-storage-manifest.tsv bulundu."
else
  echo "UYARI: document-storage-manifest.tsv bulunamadi."
fi

if [ -f "$BACKUP_PATH/document-files.tar.gz" ]; then
  echo "OK document-files.tar.gz bulundu."
  tar -tzf "$BACKUP_PATH/document-files.tar.gz" >/dev/null
  echo "OK document-files.tar.gz okunabilir."
else
  echo "UYARI: document-files.tar.gz bulunamadi. Fiziksel belgeler geri yuklenemez."
fi

for checksum in "$BACKUP_PATH"/*.sha256; do
  [ -e "$checksum" ] || continue
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$BACKUP_PATH" && sha256sum -c "$(basename "$checksum")")
  else
    echo "Bilgi: shasum dogrulamasi manuel yapilmali: $checksum"
  fi
done

echo "Dry-run tamamlandi. Bu script veri yazmaz; restore icin docs/OPERATIONS.md talimatlarini izleyin."
