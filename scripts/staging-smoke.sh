#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.staging.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.staging}"
APP_HEALTH_URL="${APP_HEALTH_URL:-http://localhost:3000/api/health}"
KEEP_RUNNING="${STAGING_SMOKE_KEEP_RUNNING:-0}"
CLEANUP_DOWN=0

if [ "${1:-}" = "--down" ]; then
  CLEANUP_DOWN=1
fi

if [ "$KEEP_RUNNING" = "1" ]; then
  CLEANUP_DOWN=0
fi

fail() {
  echo "[FAIL] $1"
  exit 1
}

info() {
  echo "[INFO] $1"
}

run_with_env() {
  docker --version >/dev/null 2>&1
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

compose_exec() {
  run_with_env exec -T "$1" sh -lc "$2"
}

assert_prisma_migration_log() {
  if ! app_logs="$(run_with_env logs --tail=200 app 2>/dev/null)"; then
    fail "App loglarına erişilemedi."
  fi
  if ! printf "%s" "$app_logs" | grep -Eqi "migrate (deploy|status|applied|skipped|completed|success)"; then
    fail "Prisma migrate logu tespit edilemedi."
  fi
}

cleanup() {
  status=$?
  if [ "$CLEANUP_DOWN" -eq 1 ]; then
    info "Cihaz güvenliği için staging kapatılıyor..."
    run_with_env down
  fi
  return "$status"
}

trap cleanup EXIT INT TERM

if ! sh "$ROOT_DIR/scripts/staging-preflight.sh"; then
  result=$?
  if [ "$result" -eq 2 ]; then
    echo "STATUS: BLOCKED"
    exit 2
  fi
  exit "$result"
fi

info "Compose config doğrulanıyor..."
run_with_env config >/tmp/staging-config.out

info "Servisler kaldırıldıktan sonra sıfırdan ayağa kaldırılıyor..."
run_with_env down --remove-orphans >/dev/null 2>&1 || true
run_with_env up -d --build

info "Servis durumu..."
run_with_env ps

info "Uygulama logları alınıyor..."
app_logs="$(run_with_env logs --tail=250 app)"
echo "$app_logs"

info "Prisma migration durumu kontrol ediliyor..."
if ! compose_exec app "npx prisma migrate status"; then
  fail "Prisma migrate status komutu hata verdi."
fi
assert_prisma_migration_log

if ! compose_exec app "node -e \"const fs = require('fs'); const file = '.next/build-manifest.json'; if (fs.existsSync(file)) { process.exit(0); } process.exit(1);\""; then
  fail "Next build dosyası bulunamıyor."
fi

info "Sağlık kontrolü bekleniyor: $APP_HEALTH_URL"
attempt=0
max_attempts=60
while [ "$attempt" -lt "$max_attempts" ]; do
  if curl -sf "$APP_HEALTH_URL" >/tmp/staging-health.json 2>/dev/null; then
    if command -v jq >/dev/null 2>&1; then
      jq . /tmp/staging-health.json
    else
      cat /tmp/staging-health.json
    fi
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if [ "$attempt" -ge "$max_attempts" ]; then
  fail "Sağlık kontrolü zaman aşımına uğradı."
fi

info "Belge storage yazma testi..."
if ! compose_exec app "test -d \"\$DOCUMENT_STORAGE_DIR\" && printf 'smoke-check' > \"\$DOCUMENT_STORAGE_DIR/.staging_smoke_write_test\" && test -s \"\$DOCUMENT_STORAGE_DIR/.staging_smoke_write_test\" && rm -f \"\$DOCUMENT_STORAGE_DIR/.staging_smoke_write_test\""; then
  fail "Belge storage yazılamıyor."
fi

info "Backup dry-run çalıştırılıyor..."
if ! compose_exec app "cd /app && DRY_RUN=1 npm run backup:v3"; then
  fail "backup:v3 dry-run başarısız."
fi

info "Restore dry-run güvenlik kontrolü çalıştırılıyor..."
if ! compose_exec app "tmpdir=\"/app/backups/.smoke-restore-check\" && mkdir -p \"$tmpdir\" && : > \"$tmpdir/database.sqlite\" && printf 'smoke\n' > \"$tmpdir/document-storage-manifest.tsv\" && printf 'restore-check\n' > \"$tmpdir/document-files.tar.gz.sha256\" && cd /app && npm run restore:v3:dry-run -- \"$tmpdir\""; then
  fail "Restore dry-run başarısız."
fi

info "Staging smoke başarılı."
