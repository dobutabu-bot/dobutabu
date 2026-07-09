# V3-RC2 Targeted Re-run Report

**Tarih:** 2026-07-09  
**Amaç:** RC2 blocker doğrulama testlerini tekrar çalıştırmak (yeni özellik geliştirme olmadan).

## Hedefli test sonuçları

| # | Komut | Sonuç | Kısa sonuç | İlgili test/Not | Trace/Screenshot |
|---|---|---|---|---|---|
| 1 | `npx playwright test tests/e2e/v3-bank-analysis-engine.spec.ts --project=chromium` | **FAIL** | Playwright yapılandırmasında `chromium` isimli proje tanımlı değil. | Komut seviyesinde yapılandırma hatası: `Project(s) "chromium" not found`. | N/A |
| 1a | `npx playwright test tests/e2e/v3-bank-analysis-engine.spec.ts --project=chromium-laptop` | **PASS** *(kontrol amaçlı)* | 2 test geçti. | `tests/e2e/v3-bank-analysis-engine.spec.ts` | N/A |
| 1b | `npx playwright test tests/e2e/v3-bank-analysis-engine.spec.ts --project=chromium-desktop` | **PASS** *(kontrol amaçlı)* | 2 test geçti. | `tests/e2e/v3-bank-analysis-engine.spec.ts` | N/A |
| 2 | `npx playwright test tests/e2e/v3-release-gates.spec.ts --grep "reconciliation"` | **PASS** | 7 test geçti. | `v3-release-gates.spec.ts` (reconciliation route kontrolü) | N/A |
| 3 | `npx playwright test tests/e2e/v3-release-gates.spec.ts --grep "touch"` | **FAIL** | Eşleşen test bulunamadı (`No tests found`), proje çalıştı fakat `touch` filtreli test tanımı yok. | Eşleşme düzeyinde test bulunamadı. | N/A |
| 4 | `npx playwright test tests/e2e/documents-and-bank-import.spec.ts` | **FAIL** | Hedef dosya bulunamadı (`No such file or directory`). | Test dosyası eksik: `tests/e2e/documents-and-bank-import.spec.ts` | N/A |
| 5 | `npx playwright test tests/e2e/v3-responsive-regression.spec.ts` | **PASS** | 420 test geçti (`42.8m`). | `tests/e2e/v3-responsive-regression.spec.ts` | N/A |
| 6 | `npm run health:check` | **FAIL** | Uygulama varsayılan `http://localhost:3000/api/health` adresinde çalışmıyor (bağlantı reddedildi). | `scripts/health-check.sh` | N/A |
| 7 | `npm run typecheck` | **PASS** | Tip kontrolü başarılı. | `tsc` | N/A |
| 8 | `npm run lint` | **PASS** | ESLint başarılı. | `eslint` | N/A |
| 9 | `npm run build` | **PASS** | Build başarılı. | `next build` | N/A |
| 10 | `npm run test` | **PASS** | 37 test geçti, 2 test atlandı. | Node/ortam testleri | N/A |

## RC2 bloklayıcı durumu

- **Recurring analysis:** `FAIL` sonucu, mevcut komut (`--project=chromium`) nedeniyle değil; `PASS` doğrulaması `chromium-laptop`/`chromium-desktop` ile alındı.
- **/reconciliation responsive:** PASS
- **Touch target:** Bu run’da `touch` filtreli test bulunamadığı için PASS sayılmadı; test planı gözden geçirilmeli.
- **Health check:** PASS değil (sunucu çalışmıyor).
- **Typecheck / Lint / Build / Test:** PASS
- **Docker:** Bu hedefli turda çalıştırılmadı; BLOKED olarak etiketlenmedi.

## Notlar

- RC2 hedefli re-run, ortamda çalıştırma erişimi (`APP_URL`) hazır değilken health check doğrulamasını tamamlayamıyor.
- Eğer `chromium` proje ismini doğrudan desteklemek isterseniz Playwright config’e alias eklenmeli veya komut güncellenmeli.
