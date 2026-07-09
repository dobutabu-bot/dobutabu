#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.staging.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.staging}"
APP_PORT="${STAGING_APP_PORT:-3000}"
POSTGRES_PORT="${STAGING_POSTGRES_PORT:-5432}"
STORAGE_DIR="${STAGING_DOCUMENT_STORAGE_DIR:-$ROOT_DIR/storage/staging-documents}"
BACKUP_DIR="${STAGING_BACKUP_DIR:-$ROOT_DIR/backups/staging}"

pass() { echo "[PASS] $1"; }
warn() { echo "[WARN] $1"; }
fail() { echo "[FAIL] $1"; exit 1; }
blocked() { echo "[BLOCKED] $1"; exit 2; }

check_dir() {
  local label="$1"
  local dir="$2"

  if mkdir -p "$dir" >/dev/null 2>&1; then
    if ! (cd "$dir" && test -w .); then
      fail "$label klasörü yazılamıyor: $dir"
    fi
    pass "$label klasörü oluşturulabilir ve yazılabilir: $dir"
  else
    fail "$label klasörü oluşturulamaz: $dir"
  fi
}

check_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      fail "Port ${port} kullanımda. Port serbest değil."
    fi
    pass "Port ${port} kontrolü geçti."
  else
    warn "lsof bulunamadı, port ${port} kontrolü atlandı."
  fi
}

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI bulunamadı. Staging smoke test için Docker Desktop, Colima veya Docker kurulu VPS gereklidir."
  echo "STATUS: BLOCKED"
  exit 2
fi

if ! docker compose version >/dev/null 2>&1; then
  blocked "docker compose bulunamadı veya çalıştırılamadı."
fi

if ! docker info >/dev/null 2>&1; then
  blocked "Docker daemon erişilebilir değil."
fi

if [ ! -f "$ENV_FILE" ]; then
  fail ".env.staging bulunamadı. Lütfen: cp .env.staging.example .env.staging"
fi

if [ ! -r "$ENV_FILE" ]; then
  fail ".env.staging okunabilir değil: $ENV_FILE"
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  fail "Compose dosyası bulunamadı: $COMPOSE_FILE"
fi

if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/tmp/staging-compose-config.$$ 2>/tmp/staging-compose-config.err; then
  fail "Compose config doğrulaması başarısız: $(cat /tmp/staging-compose-config.err)"
fi
pass "Compose config doğrulaması başarılı: $COMPOSE_FILE"

check_port "$APP_PORT"
check_port "$POSTGRES_PORT"

check_dir "Dokümantasyon storage" "$STORAGE_DIR"
check_dir "Backup" "$BACKUP_DIR"

# Uygulama içinde yazılabilir test dosyaları (yalnızca varlık doğrulaması)
storage_test_file="$STORAGE_DIR/.staging_preflight_write_test"
if ! bash -c "printf '' > '$storage_test_file' && rm -f '$storage_test_file'"; then
  fail "storage klasörüne yazma kontrolü başarısız: $STORAGE_DIR"
fi

backup_test_file="$BACKUP_DIR/.staging_preflight_write_test"
if ! bash -c "printf '' > '$backup_test_file' && rm -f '$backup_test_file'"; then
  fail "backup klasörüne yazma kontrolü başarısız: $BACKUP_DIR"
fi

pass "Staging preflight tamamlandı."
echo "STATUS: PASS"
