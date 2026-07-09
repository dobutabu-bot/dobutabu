# V3-RC2 Healthcheck Fix

## Amaç
Bu çalışma, `/api/health` endpointini production-ready, güvenli ve sade bir durum kontrolü haline getirmek ve `health:check` ile script bazlı doğrulama eklemek için gerçekleştirildi.

## `/api/health` Endpointi

Endpoint artık yalnızca operasyonel durumu raporlar, hassas bir veri döndürmez.

### Response formatı

```json
{
  "ok": true,
  "app": "buro-finans-paneli",
  "version": "V3-RC2",
  "env": "development",
  "database": "ok",
  "storage": "ok",
  "time": "2026-07-08T00:00:00.000Z"
}
```

### Alanlar

- `ok`: `true` ise servis çalışır kabul edilir.
- `app`: Sabit uygulama tanımı.
- `version`: `package.json` sürümü (`3.0.0-rc.2`).
- `env`: Yalnızca `development`, `staging`, `production`, `test`, `unknown` döner.
- `database`: `ok` \/ `error`.
- `storage`: `ok` \/ `warning` \/ `error`.
- `time`: ISO formatı zaman damgası.

### Gizli veriler döndürülmez

Aşağıdaki bilgiler response içinde döndürülmez:

- `DATABASE_URL`, `AUTH_SECRET`, `SESSION_SECRET`
- cookie veya auth token bilgisi
- gerçek dosya yolu
- hata stack trace
- kullanıcıya özel finansal veri
- belge içeriği

## Kontroller

### Database
- `prisma.$queryRaw('SELECT 1')` ile kısa süreli doğrulama yapılır.
- `timeout` aşımında `error` olarak döner.
- Hata detayları response’a yazılmaz.

### Storage
- Belge depolama kök dizini okunabilir mi kontrol edilir.
- Dizin yoksa oluşturulabilirlik test edilir.
- Basit bir geçici dosya yazıp silerek yazma yetkisi doğrulanır.
- Sonuç: `ok`, `warning` veya `error`.

### HTTP status

- database `error` ise `503`.
- storage durumu `warning` olsa dahi, database `ok` ise `200` döner.

## Script

Yeni script eklendi:

- `scripts/health-check.sh`

Davranışı:
- `APP_URL` okuması yapar (varsayılan `http://localhost:3000`).
- `GET {APP_URL}/api/health` çağırır.
- `ok` alanını güvenli biçimde okur (jq varsa, yoksa fallback parse).
- `curl` veya `jq` eksikliğinde anlaşılır hata verir.

### package.json

```json
"health:check": "bash scripts/health-check.sh"
```

## Kullanım

### Local

```bash
npm run health:check
```

### Staging

```bash
APP_URL=http://localhost:3000 npm run health:check
```

### Production

```bash
APP_URL=https://example-domain.com npm run health:check
```

## Bilinen sınırlamalar

- Storage yolu endpoint içinde gösterilmez.
- Storage check’i sınırlı bir yazma testi ile yapılır.
- PostgreSQL ve dosya sistemi erişiminde ağır bir yük testi yerine hızlı sağlık kontrolü yapılır.
- Geliştirme ortamında hata detayları loglanmaz; yalnızca genel `error` dönümü kullanılır.
