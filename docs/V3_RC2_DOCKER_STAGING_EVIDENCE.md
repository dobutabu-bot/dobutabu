# V3-RC2 Docker Staging Smoke Kanıt Raporu

Tarih: 8 Temmuz 2026  
Sürüm: V3-RC2  
Amaç: Docker CLI mevcutsa staging compose topolojisinin kanıtlanması, yoksa net şekilde **BLOCKED** olarak raporlanması.

## 1. Eklenen Altyapı

- `scripts/staging-preflight.sh`
- `scripts/staging-smoke.sh`
- `package.json` scriptleri:
  - `staging:preflight`
  - `staging:smoke`
- `.github/workflows/staging-smoke.yml`
- `docs/V3_STAGING_SMOKE_GUIDE.md`

## 2. `staging:preflight` Kontrol Listesi

Script şu kontrolleri yapmaktadır:

1. `docker` var mı?
2. `docker compose` var mı?
3. Docker daemon çalışıyor mu?
4. `.env.staging` dosyası var mı / okunabilir mi?
5. `docker-compose.staging.yml` geçerli mi?
6. Gerekli portlar (`3000`, `5432`) serbest mi?
7. Storage path ve backup path yazılabilirlik testi.

Eksik/erişilemeyen her durumda:
- Kural dışı durumlar için `exit 1`,
- `docker` yoksa veya compose/daemon çalışmıyorsa **`exit 2` + BLOCKED metni** ile sonuçlanmaktadır.

## 3. `staging:smoke` Akışı

`staging:smoke` doğrudan `staging:preflight` çağırır ve geçmezse aynı şekilde durur.

Geçerli durumda sırası:

1. `docker compose --env-file ... --config` doğrulama
2. Servisleri down edip yeniden up (build ile)
3. `ps`
4. App log toplama
5. `npx prisma migrate status`
6. Prisma migrate log tespiti
7. `/api/health` retry ile doğrulama
8. Container içi belge storage yazma testi
9. `DRY_RUN=1 npm run backup:v3`
10. Restore dry-run güvenlik kontrolü
11. Başarılıysa başarılı mesajı

İsteğe bağlı sonlandırma:
- `npm run staging:smoke -- --down`

## 4. Çalıştırma Komutları

```bash
npm run typecheck
npm run lint
npm run build
npm run staging:preflight

# Docker varsa:
npm run staging:smoke -- --down
```

## 5. Mevcut Ortam Sonucu

Bu çalışma ortamında `docker` komutu bulunamadığından, preflight beklenen şekilde `BLOCKED` döndürmüştür:

> Docker CLI bulunamadı. Staging smoke test için Docker Desktop, Colima veya Docker kurulu VPS gereklidir.

Çıktı:
- `STATUS: BLOCKED`
- Exit code: `2`

`staging:smoke` bu nedenle çalıştırılmamış ve smoke kanıtı bu ortam için `BLOCKED` olarak raporlanmıştır.

## 6. Not

- Bu rapor, RC2 blocker’ın “docker yoksa BLOCKED (FAIL değil)” gereksinimini karşılamaktadır.
- Gerçek staging kanıtı, docker kurulu bir makinede `npm run staging:preflight` ve `npm run staging:smoke -- --down` sırası ile tekrar üretilebilir.
