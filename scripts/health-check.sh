#!/usr/bin/env bash
set -eu

APP_URL="${APP_URL:-http://localhost:3000}"
URL="${APP_URL%/}/api/health"

if ! command -v curl >/dev/null 2>&1; then
  echo "[FAIL] curl bulunamadı. 'curl' yüklü değil." >&2
  exit 1
fi

echo "Checking health endpoint: ${URL}"

response_file="$(mktemp)"
cleanup() {
  rm -f "$response_file"
}
trap cleanup EXIT

if ! status=$(curl -sS --max-time 10 -o "$response_file" -w "%{http_code}" "$URL"); then
  echo "[FAIL] Sağlık endpointine erişilemedi." >&2
  exit 1
fi

if [ "$status" -lt 200 ] || [ "$status" -ge 500 ]; then
  echo "[FAIL] HTTP status: ${status}" >&2
  exit 1
fi

if ! [ -s "$response_file" ]; then
  echo "[FAIL] Health response boş." >&2
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  ok_value=$(jq -r '.ok // false' "$response_file" 2>/dev/null)
else
  ok_value=$(node -e "const fs=require('fs');try{const v=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String(Boolean(v&&v.ok)));}catch(_){process.stdout.write('');}" "$response_file")
fi

if [ "$ok_value" != "true" ]; then
  echo "[FAIL] Health response ok=false. Response:" >&2
  cat "$response_file" >&2
  exit 1
fi

echo "[OK] Health check passed"
cat "$response_file"
