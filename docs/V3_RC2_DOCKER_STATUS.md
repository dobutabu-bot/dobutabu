# V3-RC2 Docker Durum Raporu

## Amaç

Staging smoke test için ortam uygunluğunu **kod güvenilirliği bozulmadan** raporlamak.

## Çalıştırılan komut

- `npm run staging:preflight`

## Bu makinedeki sonuç

- **Docker durumu:** **BLOCKED**
- **Sebep:** Docker CLI yüklü değil.
- **Mesaj:** "Docker CLI bulunamadı. Staging smoke test için Docker Desktop, Colima veya Docker kurulu VPS gereklidir."

## Durum tablosu

- Docker var/yok: **BLOCKED**
- `docker compose` var/yok: **BLOCKED**
- `.env.staging` var/yok: **not checked** (ortam blokta kalır)
- `docker-compose.staging.yml` var/yok: **not checked** (ortam blokta kalır)
- Dosya klasörü yazılabilirliği: **not checked** (ortam blokta kalır)

## PASS / PARTIAL / FAIL

- **PASS:** Ortam gereksinimleri karşılanırsa
- **PARTIAL:** Komutlar yarıda kalır, örn. compose çalışır ama container ayağa geçmez
- **BLOCKED:** Docker/daemon/compose eksik olduğunda (bu durumda **FAIL değil**)

## Production GO kararı

- Staging kanıtı olmadan production GO kararı verilmemelidir.
- Docker olan bir ortamda en az bir kez:
  - `npm run staging:preflight`
  - `npm run staging:smoke -- --down`
  çalıştırılarak log kayıtları alınmalıdır.
