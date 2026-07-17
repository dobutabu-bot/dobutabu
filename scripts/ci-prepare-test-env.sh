#!/usr/bin/env bash
set -euo pipefail

if [ -z "${GITHUB_WORKSPACE:-}" ] || [ -z "${GITHUB_ENV:-}" ]; then
  echo "Bu script yalnizca izole GitHub Actions test ortaminda calistirilir." >&2
  exit 2
fi

mkdir -p "$GITHUB_WORKSPACE/.ci/documents" "$GITHUB_WORKSPACE/.ci/backups"

auth_secret="$(openssl rand -hex 32)"
admin_password="CiOnly-$(openssl rand -hex 18)"

{
  echo "APP_ENV=test"
  echo "APP_URL=http://127.0.0.1:3006"
  echo "DATABASE_URL=file:./ci-quality-gates.db"
  echo "DOCUMENT_STORAGE_DIR=$GITHUB_WORKSPACE/.ci/documents"
  echo "BACKUP_DIR=$GITHUB_WORKSPACE/.ci/backups"
  echo "AUTH_SECRET=$auth_secret"
  echo "SESSION_SECRET=$auth_secret"
  echo "ADMIN_EMAIL=ci-admin@example.invalid"
  echo "ADMIN_PASSWORD=$admin_password"
} >> "$GITHUB_ENV"

echo "PASS: Izole CI database, storage ve gecici kimlik bilgileri hazirlandi."
