# V3-RC1 Docker Staging Smoke Test

Tarih: 7 Temmuz 2026  
Sürüm: V3-RC1 / `3.0.0-rc.1`  
Amaç: Uygulamanın yalnızca lokal dev server’da değil, production’a daha yakın Docker staging topolojisinde de ayağa kalktığını doğrulamak.

## Hazırlanan Dosyalar

| Dosya | Durum | Not |
|---|---|---|
| `docker-compose.staging.yml` | PASS | `app`, `postgres`, `caddy`, document storage volume ve backup volume içerir. |
| `.env.staging.example` | PASS | Staging secret, seed user, database ve PostgreSQL değişkenleri örneklenmiştir. |

## Staging Topolojisi

Staging compose aşağıdaki servisleri tanımlar:

- `app`: Next.js production runner, `npx prisma migrate deploy`, `npx prisma db seed`, `npm run start`
- `postgres`: PostgreSQL 16 healthcheck’li servis
- `caddy`: Reverse proxy, dışarıya `http://localhost:3000` üzerinden açılır
- `staging-private-documents`: Private belge storage volume
- `staging-backups`: Backup volume
- `staging-sqlite-data`: V3-RC1 uygulama database volume

Önemli not:

V3-RC1 Prisma datasource şu anda `sqlite` provider kullanır. Bu nedenle staging app gerçek çalışan yapı olarak kalıcı SQLite volume ile başlatılır. PostgreSQL servisi production topolojisi ve gelecekteki cloud profil provası için stack’e dahil edilmiştir. Uygulamanın aktif olarak PostgreSQL kullanması için ayrı bir Prisma provider/migration geçiş çalışması gerekir.

## Çalıştırılmak İstenen Komutlar

```bash
docker compose -f docker-compose.staging.yml config
docker compose -f docker-compose.staging.yml up -d --build
docker compose -f docker-compose.staging.yml ps
docker compose -f docker-compose.staging.yml logs --tail=200 app
curl http://localhost:3000/api/health
```

## Bu Ortamdaki Çalıştırma Sonucu

Komut:

```bash
docker compose -f docker-compose.staging.yml config
```

Sonuç: BLOCKED

Çıktı:

```text
zsh:1: command not found: docker
```

Değerlendirme:

- Bu Codex çalışma ortamında Docker CLI kurulu değil veya PATH’te değil.
- Bu nedenle `config`, `up -d --build`, `ps`, `logs`, `curl http://localhost:3000/api/health` ve container içi smoke adımları burada çalıştırılamadı.
- Dosyalar hazırlandı; Docker Desktop, Colima veya production staging host üzerinde aynı komutlar tekrar çalıştırılmalıdır.

## Beklenen Smoke Test Adımları

Docker erişimi olan makinede aşağıdaki sıra uygulanmalıdır.

### 1. Env hazırlığı

```bash
cp .env.staging.example .env.staging
set -a
. ./.env.staging
set +a
```

### 2. Compose config

```bash
docker compose -f docker-compose.staging.yml config
```

Beklenen sonuç:

- YAML geçerli olmalı.
- `app`, `postgres`, `caddy` servisleri görünmeli.
- Volume’lar görünmeli: `staging-sqlite-data`, `staging-private-documents`, `staging-backups`, `staging-postgres-data`.

### 3. Build ve start

```bash
docker compose -f docker-compose.staging.yml up -d --build
```

Beklenen sonuç:

- Image build başarılı olmalı.
- `app` container içinde `npx prisma migrate deploy` çalışmalı.
- `npx prisma db seed` staging admin kullanıcısını oluşturmalı.
- `npm run start` port `3000` üzerinde başlamalı.

### 4. Servis durumu

```bash
docker compose -f docker-compose.staging.yml ps
docker compose -f docker-compose.staging.yml logs --tail=200 app
```

Beklenen sonuç:

- `postgres`: healthy
- `app`: healthy
- `caddy`: running veya healthy
- App loglarında migration ve seed hata vermemeli.

### 5. Health check

```bash
curl http://localhost:3000/api/health
```

Beklenen örnek:

```json
{
  "ok": true,
  "database": true,
  "storage": true,
  "version": "3.0.0-rc.1",
  "time": "..."
}
```

### 6. Auth smoke

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -F "email=avukat@example.com" \
  -F "password=DemoAvukat2026!"
```

Beklenen sonuç:

- `303 See Other`
- `Set-Cookie` içinde session cookie

### 7. Document upload smoke

Auth cookie ile küçük bir PDF/JPG/CSV dosyası yüklenmelidir.

Beklenen sonuç:

- Upload route `200` veya `201` dönmeli.
- Document metadata oluşmalı.
- Fiziksel dosya `staging-private-documents` volume içine yazılmalı.
- Preview/download auth olmadan açılmamalı.

### 8. PDF export smoke

Auth cookie ile:

```bash
curl -I http://localhost:3000/api/reports/monthly/pdf
```

Beklenen sonuç:

- Auth yoksa `401`
- Auth cookie varsa `200`
- `Content-Type: application/pdf`

### 9. Bank import smoke

CSV/XLSX fixture import edilmeli.

Beklenen sonuç:

- Import staging tabloya yazmalı.
- Kullanıcı onayı olmadan Income/Expense oluşturmamalı.
- Duplicate rowHash tekrar kaydedilmemeli.

### 10. Reconciliation smoke

Mutabakat ekranı veya API akışı ile:

- Öneriler listelenmeli.
- Kullanıcı onayı olmadan kalıcı eşleşme olmamalı.
- Onay verilirse link alanları güncellenmeli.
- Undo ile linkler temizlenmeli.

### 11. Capital dashboard smoke

```bash
curl -I http://localhost:3000/capital
```

Beklenen sonuç:

- Auth yoksa login’e redirect.
- Auth ile sermaye ekranı açılmalı.
- Asset valuation geçmişi sayfa render’ını bozmamalı.

### 12. Backup ve restore dry-run

```bash
docker compose -f docker-compose.staging.yml exec app npm run backup:v3
docker compose -f docker-compose.staging.yml exec app sh scripts/restore-v3-dry-run.sh /app/backups/<backup-dir>
```

Beklenen sonuç:

- Database yedeği oluşmalı.
- `document-storage-manifest.tsv` oluşmalı.
- `document-files.tar.gz` oluşmalı.
- Restore dry-run checksum ve arşiv kontrollerini geçmeli.

## Mevcut Durum Tablosu

| Kontrol | Durum | Not |
|---|---|---|
| `docker-compose.staging.yml` oluşturuldu | PASS | App, Postgres, Caddy ve volume’lar tanımlandı. |
| `.env.staging.example` oluşturuldu | PASS | Staging için güvenli örnek değerler var. |
| `docker compose config` | BLOCKED | Docker CLI yok. |
| `docker compose up -d --build` | BLOCKED | Docker CLI yok. |
| `docker compose ps` | BLOCKED | Docker CLI yok. |
| App logs | BLOCKED | Container başlatılamadı. |
| `curl http://localhost:3000/api/health` | BLOCKED | Staging container yok. |
| Document upload | BLOCKED | Staging container yok. |
| PDF export | BLOCKED | Staging container yok. |
| Bank import | BLOCKED | Staging container yok. |
| Reconciliation | BLOCKED | Staging container yok. |
| Capital dashboard | BLOCKED | Staging container yok. |
| Backup | BLOCKED | Staging container yok. |
| Restore dry run | BLOCKED | Staging container yok. |

## Bilinen Riskler

1. Docker CLI/daemon olmayan ortamda staging smoke tamamlanamaz.
2. V3-RC1 Prisma provider `sqlite` olduğu için PostgreSQL servisinin eklenmesi app’in PostgreSQL kullandığı anlamına gelmez.
3. PostgreSQL’e gerçek geçiş için datasource provider, migration SQL’leri ve veri taşıma planı ayrı release konusu olmalıdır.
4. Staging dosyasında `PLAYWRIGHT_E2E=1` yalnızca localhost HTTP smoke testini kolaylaştırmak için kullanılır; production compose içinde kullanılmamalıdır.
5. Staging secret’ları `.env.staging.example` içinden aynen production’a taşınmamalıdır.

## Production’a Yakın Ortamda Tekrar Koşma Talimatı

Docker Desktop veya Colima çalışır durumda iken:

```bash
cp .env.staging.example .env.staging
set -a && . ./.env.staging && set +a
docker compose -f docker-compose.staging.yml config
docker compose -f docker-compose.staging.yml up -d --build
docker compose -f docker-compose.staging.yml ps
docker compose -f docker-compose.staging.yml logs --tail=200 app
curl http://localhost:3000/api/health
```

Smoke test tamamlandıktan sonra:

```bash
docker compose -f docker-compose.staging.yml down
```

Staging verilerini de silmek istenirse:

```bash
docker compose -f docker-compose.staging.yml down -v
```

Bu son komut staging volume verisini siler; production veya gerçek müvekkil verisi üzerinde kullanılmamalıdır.
