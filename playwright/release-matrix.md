# V3 Playwright Release Matrix

Bu matris V1/V2 çekirdeği ve V3 modülleri için release öncesi bloklayıcı E2E kapısıdır.

## Tarayıcı ve Cihaz Projeleri

`playwright.config.ts` şu hedefleri koşar:

- `chromium-desktop`
- `chromium-laptop`
- `firefox-desktop`
- `webkit-desktop`
- `tablet`
- `iphone`
- `android`

## Bloklayıcı Alanlar

- Auth ve protected route erişimi
- V1/V2 CRUD, soft delete, audit log ve dijital kasa ledger senkronizasyonu
- Dashboard, raporlar, kasa, belge, banka ekstresi, mutabakat, sermaye, arama ve ayarlar route smoke
- Belge upload, private preview/download, duplicate hash ve yetkisiz erişim kontrolleri
- PDF text extraction ve OCR fallback davranışı
- Banka import, analiz, mutabakat ve bankadan tahsilat/gider oluşturma
- Sermaye merkezi, değerleme, import önerisi ve net worth hesapları
- Privacy mode masking
- Server-side PDF çıktıları
- Mobil menü, dokunmatik hedefler ve yatay taşma kontrolleri
- Hydration, runtime console ve page error guard

## Release Kuralı

`npm run typecheck`, `npm run lint`, `npm run build` ve `npx playwright test` geçmeden V3 release tamamlanmış sayılmaz. Docker bulunan CI/host ortamında `docker compose config` ve `docker build -t buro-finans-v3-ci .` smoke kontrolleri de release kapısına dahildir.
