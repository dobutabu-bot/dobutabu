# V3-RC1 Belge Merkezi Güvenlik Raporu

Bu rapor, V3-RC1 Belge Merkezi için eklenen otomatik güvenlik testlerinin kapsamını ve son doğrulama sonucunu özetler.

## Test Dosyası

- `tests/document-security.test.ts`
- Komut: `npm run test`

Test iki katmandan oluşur:

1. Porttan bağımsız güvenlik testleri:
   - Private storage path traversal engeli
   - MIME/uzantı/signature uyumsuzluğu
   - Büyük dosya limiti
   - `public/documents` altında belge saklanmaması

2. API entegrasyon testleri:
   - `DOCUMENT_SECURITY_BASE_URL` veya varsayılan `http://localhost:3010` açıksa çalışır.
   - Auth, preview/download, duplicate, soft delete ve unlink davranışı gerçek route’lar üzerinden doğrulanır.

## Kapsam

| Kontrol | Beklenen | Durum |
| --- | --- | --- |
| Auth olmadan download | `401` | PASS |
| Auth olmadan preview | `401` | PASS |
| Silinmiş belge download | `404` | PASS |
| Path traversal | Storage resolver ve URL traversal başarılı olmaz | PASS |
| MIME spoof `.jpg` ama PDF içeriği | Reddedilir | PASS |
| MIME spoof `.pdf` ama executable içerik | Reddedilir | PASS |
| Büyük dosya limiti | Reddedilir | PASS |
| Duplicate hash | `409` ve duplicate uyarısı | PASS |
| Public klasörde belge | `public/documents` yok | PASS |
| Filesystem path sızıntısı | Header/body içinde storage root veya private path yok | PASS |
| Download cache policy | `private, no-store, max-age=0`, `no-cache`, `nosniff` | PASS |
| Backup/static storage public erişimi | `200` dönmez | PASS |
| Belge silme | Soft delete, fiziksel dosya hemen silinmez | PASS |
| Unlink | Bağlantı kalkar, belge silinmez | PASS |

## Son Çalıştırma

2026-07-07 tarihinde V3-RC1 için aşağıdaki kapılar çalıştırıldı:

| Komut | Sonuç |
| --- | --- |
| `npm run test` | PASS - 20 test geçti, 0 fail |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |

`npm run test` içinde belge güvenliği entegrasyon testleri `http://localhost:3010` üzerinde auth/preview/download/upload route'larını gerçek HTTP istekleriyle doğruladı.

## Notlar

- Testler hassas hata üretmemek için kötü niyetli DB içi storage path manipülasyonu yapmaz. Bunun yerine gerçek saldırı yüzeyleri olan URL traversal, storage resolver, upload validation ve private route auth kapıları doğrulanır.
- Dev server açık değilse API entegrasyon bölümü kontrollü biçimde skip edilir; storage ve validator güvenlik testleri yine çalışır.
- Fiziksel belge dosyaları test sonunda private storage alanından temizlenir.
- Typecheck sırasında eski build/dev süreçlerinden kalan `.next/types/* 3.ts` duplicate artefactleri dışarıda bırakıldı; kaynak tipleri ve üretim build'i başarıyla doğrulandı.
