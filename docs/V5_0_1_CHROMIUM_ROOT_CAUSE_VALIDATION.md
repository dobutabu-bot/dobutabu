# V5.0.1 Chromium Root Cause Validation

Tarih: 18 Temmuz 2026

## Kapsam

V5.0.1 PDF stabilizasyon hattının hedefli Chromium kalite kapıları ve kritik route regresyonu doğrulandı. Production veya staging deploy yapılmadı.

## Kök Neden

Remote hotfix dalında ortak `PdfDownloadButton` katmanının eski sürümü bulunuyordu ve yeni güvenli indirme yardımcıları ile tam PDF download matrisi branch'e taşınmamıştı. Bu nedenle localde doğrulanan browser-download davranışı remote branch tarafından yeniden üretilemiyordu.

Düzeltme şu sözleşmeyi zorunlu kılar:

- request mevcut session cookie ile `same-origin` gönderilir,
- HTTP status ve `application/pdf` MIME tipi doğrulanır,
- body `%PDF-` imzası ve minimum boyutla kontrol edilir,
- `Content-Disposition` içindeki `filename` / `filename*` güvenli ayrıştırılır,
- HTML veya JSON hata cevabı `.pdf` olarak indirilmez,
- object URL WebKit için erken revoke edilmez,
- kullanıcı arayüzünde pending, çift tıklama koruması ve güvenli hata mesajı gösterilir.

## Sonuçlar

| Kontrol | Sonuç |
| --- | --- |
| PDF unit/integration | PASS — 55/55 |
| Chromium PDF download E2E | PASS — 5/5 |
| Auth/response matrisi | PASS — 14 route |
| Gerçek browser download ve parse | PASS — 14 PDF |
| Liste aksiyon menüleri | PASS — müvekkil, dosya, tahsilat, gider |
| Chromium kritik route regresyonu | PASS — 2/2 |
| Console error | 0 |
| Prisma generate | PASS |
| Typecheck | PASS |
| Lint | PASS |
| Build | PASS — 82 route |
| Tam Node test paketi | PASS — 105 pass, 0 fail, 2 ortam skip |

## Çalıştırılan Komutlar

```bash
npm run test:pdf
npx playwright test tests/e2e/pdf-downloads.spec.ts --project=chromium-desktop --workers=1 --trace=retain-on-failure
npx playwright test tests/e2e/full-production-regression.spec.ts --project=chromium-desktop --workers=1 --trace=retain-on-failure
npx prisma generate
npm run typecheck
npm run lint
npm run test
npm run build
```

## Not

Testler gevşetilmedi ve keyfi timeout eklenmedi. PDF fixture kayıtları yalnız `PDF-SMOKE-TEST-*` marker'ı ile oluşturuldu ve test sonrasında temizlendi. Production baseline `4cc1b06` ve production ortamı değiştirilmedi.
