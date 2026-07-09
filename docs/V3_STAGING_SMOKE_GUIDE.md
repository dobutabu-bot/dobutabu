# V3 Staging Smoke Rehberi

Bu rehber, RC2 hedefiyle staging doğrulamasını Docker kurulu ortamlarda çalıştırmak için kullanılır.

## Docker olmayan ortam
- Docker CLI yoksa süreç **BLOCKED** kabul edilir.
- Bu bir kod hatası değil, ortam hazır değil anlamına gelir.
- Görüntülenecek mesaj:
  - `Docker CLI bulunamadı. Staging smoke test için Docker Desktop, Colima veya Docker kurulu VPS gereklidir.`

## Docker Desktop (macOS)

1. Docker Desktop’ı açın.
2. Proje kökünde örnek dosyayı kopyalayın:

```bash
cp .env.staging.example .env.staging
```

3. Gerekirse gizli değerleri düzenleyin.
4. Kontrol komutu:

```bash
npm run staging:preflight
```

5. Başarılıysa smoke komutu:

```bash
npm run staging:smoke -- --down
```

## Colima (macOS)

1. Colima’yı başlatın (`colima start`).
2. Gerekirse socket’i set edin:

```bash
export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock
```

3. Ardından aynı komutları çalıştırın:

```bash
cp .env.staging.example .env.staging
npm run staging:preflight
npm run staging:smoke -- --down
```

## VPS (Linux)

1. Repo’yu VPS’e alın.
2. `.env.staging` dosyasını hazır edin:

```bash
cp .env.staging.example .env.staging
```

3. Güvenli secret’larla güncelleyin.
4. Çalıştırın:

```bash
npm run staging:preflight
npm run staging:smoke -- --down
```

## .env.staging hazırlığı

Zorunlu alanlar:

- `STAGING_DATABASE_URL`
- `STAGING_AUTH_SECRET`
- `STAGING_SESSION_SECRET`
- `STAGING_ADMIN_EMAIL`
- `STAGING_ADMIN_PASSWORD`
- `STAGING_POSTGRES_DB`
- `STAGING_POSTGRES_USER`
- `STAGING_POSTGRES_PASSWORD`

Opsiyonel ama önerilenler:

- `STAGING_APP_URL`
- `STAGING_APP_PORT`
- `STAGING_DOCUMENT_MAX_UPLOAD_SIZE_MB`

## Staging başlatma

1. `npm run staging:preflight`
2. `npm run staging:smoke -- --down`

Smoke akışı içinde:

- Compose config doğrulama
- Servisleri başlatma
- `app` log kontrolü
- Prisma migrate status
- `/api/health` doğrulama
- Belge storage yazma testi
- backup dry-run

## Health check

Smoke sırasında beklenen endpoint:

- `http://localhost:3000/api/health`

## Backup kontrolü

- Dry run ile: `DRY_RUN=1 npm run backup:v3`
- `npm run restore:v3:dry-run` (veya güvenli restore doğrulaması)

## Storage volume kontrolü

- `STAGING_DOCUMENT_STORAGE_DIR` (veya script varsayılanı) klasörünün varlığı/yazılabilirliği doğrulanır.
- Test, write→delete ile yapılır.

## Test sonucu nasıl kaydedilir

```bash
npm run staging:preflight | tee docs/staging-preflight.log
npm run staging:smoke -- --down | tee docs/staging-smoke.log
```

Notlar:
- Çıktıdaki `STATUS: PASS/FAIL/BLOCKED` satırını ve kritik logları muhafaza edin.
- Bu çıktılar staging kanıt dosyasına eklenmelidir.
