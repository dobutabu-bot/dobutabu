# Production Operations

Bu doküman V3 eklentileriyle birlikte production uyumluluğunu anlatır. V3 kapsamında belge merkezi, banka ekstresi, mutabakat ve sermaye tabloları veritabanında; fiziksel belge dosyaları ise private document storage volume içinde tutulur.

## Production Mimari

Önerilen VPS mimarisi:

- Caddy reverse proxy, HTTPS sonlandırma ve request body limiti.
- Next.js uygulaması Caddy arkasında kalır, doğrudan internete açılmaz.
- SQLite için kalıcı `/data` volume.
- Private belgeler için kalıcı `/app/storage/documents` volume.
- Yedekler için ayrı `/app/backups` volume veya host mount.

Cloud/serverless mimari:

- PostgreSQL veya yönetilen kalıcı database.
- Private belge dosyaları için S3/NAS/persistent volume. Mevcut kodda LocalDocumentStorage aktiftir; S3LikeStorage interface seviyesinde bırakılmıştır.
- SQLite ephemeral filesystem olan ortamlarda kullanılmamalıdır.

## Docker Compose

Konfigürasyonu doğrulama:

```bash
docker compose config
```

Container build:

```bash
docker compose build app
```

SQLite VPS profili:

```bash
cp .env.example .env
# .env içinde APP_DOMAIN, DOCKER_APP_URL, AUTH_SECRET ve SESSION_SECRET değerlerini düzenleyin.
docker compose up -d app caddy
```

Varsayılan volume eşlemesi:

- SQLite: `app-sqlite-data` -> `/data`
- Belgeler: `private-documents` -> `/app/storage/documents`
- Yedekler: `app-backups` -> `/app/backups`

Compose container içinde güvenli varsayılan olarak `DOCKER_APP_URL=https://localhost`, `DOCKER_DATABASE_URL=file:/data/production.db`, `DOCKER_DOCUMENT_STORAGE_DIR=/app/storage/documents` ve `DOCKER_BACKUP_DIR=/app/backups` kullanır. Gerçek domain, harici Postgres veya özel volume yolu gerekiyorsa bu `DOCKER_*` değişkenlerini `.env` içinde tanımlayın.

Healthcheck:

```bash
docker compose ps
docker compose exec app node -e "fetch('http://127.0.0.1:3000/api/health',{headers:{'x-forwarded-proto':'https'}}).then(async r => { console.log(r.status, await r.text()) })"
```

## Postgres Migration Akışı

Aktif repo SQLite provider ile gelir. PostgreSQL kullanılacaksa production branch içinde Prisma datasource provider `postgresql` olarak hazırlanmalı ve migrationlar PostgreSQL için gözden geçirilmelidir.

Örnek Postgres compose servisini açma:

```bash
docker compose --profile postgres up -d postgres
```

Production migration deploy:

```bash
docker compose exec app npx prisma migrate deploy
```

Harici Postgres kullanımı:

```text
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
```

Docker Compose içinden harici Postgres kullanırken:

```text
DOCKER_DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
```

Notlar:

- SQLite migration SQL’i doğrudan Postgres’e taşınmadan önce test edilmelidir.
- Seed production’da dikkatle kullanılmalıdır.
- Banka ekstresi `rawData`, belge `extractedText`, sermaye ve audit log tabloları migration kapsamındadır.

## Belge Preview/Download

Belge dosyaları `public/` altında değildir. Tüm erişim şu private route’lardan yapılır:

- `/api/documents/[id]/preview`
- `/api/documents/[id]/download`

Bu route’lar:

- Auth zorunlu tutar.
- Filesystem path göstermez.
- `Cache-Control: private, no-store, max-age=0` döner.
- `X-Content-Type-Options: nosniff` döner.
- Caddy arkasında `X-Accel-Buffering: no` ile hassas dosya response’larının proxy cache/buffer davranışı sınırlandırılır.

Upload hattı:

- Varsayılan maksimum dosya boyutu 20 MB.
- Caddy request body limiti 25 MB.
- Next.js middleware client body limiti 25 MB.
- MIME, uzantı, file signature, SHA-256 duplicate hash ve path traversal kontrolleri uygulanır.

## Backup

V3 backup script’i veritabanını, belge storage manifest’ini ve fiziksel belge dosyalarını ayrı üretir:

```bash
npm run backup:v3
```

Dry-run:

```bash
DRY_RUN=1 npm run backup:v3
```

Çıktı örneği:

```text
backups/buro-finans-v3-YYYY-MM-DD_HH-MM-SS/
  database.sqlite veya database.pgcustom
  database.*.sha256
  document-storage-manifest.tsv
  document-files.tar.gz
  document-files.tar.gz.sha256
  README.txt
```

JSON/CSV export belge metadata, banka ekstresi satırları, işlem kuralları, sermaye tabloları, silinen kayıtlar ve audit log kapsamını içerir. Fiziksel belge dosyaları JSON/CSV içine gömülmez; `document-files.tar.gz` ayrıca saklanmalıdır.

Restore dry-run:

```bash
npm run restore:v3:dry-run -- backups/buro-finans-v3-YYYY-MM-DD_HH-MM-SS
```

## Restore

SQLite restore:

```bash
docker compose stop app
docker run --rm -v app-sqlite-data:/data -v "$PWD/backups:/restore:ro" alpine sh -c 'cp /restore/buro-finans-v3-YYYY-MM-DD_HH-MM-SS/database.sqlite /data/production.db'
docker run --rm -v private-documents:/docs -v "$PWD/backups:/restore:ro" alpine sh -c 'rm -rf /docs/* && tar -C /docs -xzf /restore/buro-finans-v3-YYYY-MM-DD_HH-MM-SS/document-files.tar.gz'
docker compose up -d app
docker compose exec app npx prisma migrate deploy
```

Postgres restore dry-run için önce sağlayıcının snapshot/restore aracını kullanın; `database.pgcustom` için örnek:

```bash
pg_restore --list backups/buro-finans-v3-YYYY-MM-DD_HH-MM-SS/database.pgcustom
```

Gerçek Postgres restore production verisini değiştireceği için bakım penceresinde ve ayrıca doğrulanmış snapshot ile yapılmalıdır.

## Operasyon Kontrol Listesi

- `APP_URL` HTTPS production domain olmalı.
- `APP_DOMAIN` Caddy domain ile aynı olmalı.
- `AUTH_SECRET` en az 32 karakter olmalı.
- `DATABASE_URL` kalıcı database veya kalıcı SQLite volume göstermeli.
- Docker Compose kullanımında `DOCKER_APP_URL` HTTPS production domain olmalı.
- Docker Compose kullanımında `DOCKER_DATABASE_URL` kalıcı database veya `/data` volume göstermeli.
- `DOCUMENT_STORAGE_DIR` private ve kalıcı volume olmalı.
- Docker Compose kullanımında `DOCKER_DOCUMENT_STORAGE_DIR` private document volume göstermeli.
- `BACKUP_DIR` uygulama container yaşam döngüsünden bağımsız saklanmalı.
- `docker compose config` temiz olmalı.
- `docker compose build app` başarılı olmalı.
- `docker compose exec app npx prisma migrate deploy` başarılı olmalı.
- `npm run backup:v3` ve `npm run restore:v3:dry-run -- <backup-dir>` düzenli test edilmeli.
- Belge dosyaları, JSON/CSV export ve SQLite/Postgres dump şifreli saklanmalı.
