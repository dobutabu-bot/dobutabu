# V5.0.1 Production Rollback

## Sabit geri dönüş noktası

- Baseline commit: `4cc1b06`
- Yerel tag: `rollback/v5.0.0-production-4cc1b06`
- Railway backup: `v5.0.1-20260716-191242`
- Backup SHA-256: `aa0513ed0571dd631cd05f66344c02c778d562c1cfc460b2a9370abe63541d22`

## Rollback koşulları

Şunlardan biri production doğrulamasında oluşursa rollback uygulanır:

- health endpoint database veya storage hatası
- herhangi bir kritik PDF route'unda 401 dışı auth ihlali, 5xx, HTML gövde veya bozuk PDF
- veri sayımı veya belge manifestinde beklenmeyen değişiklik
- uygulama açılışı, login ya da temel route smoke hatası

## Uygulama rollback'i

Railway uygulama servisi `4cc1b06` commit'ine geri alınır. Volume silinmez, yeniden oluşturulmaz ve migration reset çalıştırılmaz.

## Veri rollback'i

Hotfix veri modelini veya migration'ı değiştirmediği için normal durumda veri restore edilmez. Yalnız doğrulanmış veri bozulması varsa servis durdurulur, mevcut volume ayrıca yedeklenir ve `v5.0.1-20260716-191242` arşivi checksum doğrulamasından sonra geri yüklenir.

## Rollback sonrası kapı

- `/api/health` PASS
- login PASS
- production veri sayımları baseline ile eşleşir
- document manifesti 1002/1002
- baseline davranışı raporlanır

Rollback işlemi sırasında production database reset, seed veya volume silme yapılmaz.
