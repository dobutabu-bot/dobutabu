# V3-RC2 Blocker Fix Plan

Tarih: 2026-07-08

Bu plan V3-RC1 NO-GO sonucunda tespit edilen release blocker hatalarini kapatmak icindir. Yeni ozellik eklenmeyecek, testler gevsetilmeyecek ve mevcut V1/V2/V3 calisan akislara refactor uygulanmayacaktir.

## 1. Banka Analiz Motoru Recurring Gider Tespiti

- Sebep: Recurring grouping anahtari aciklama metnini fazla belirleyici kullaniyor. Ayni kategori, yon ve yakin tutardaki duzenli hareketler aciklama varyasyonu veya rule/category sinyali nedeniyle parcalanabiliyor.
- Etkilenen dosyalar:
  - `src/lib/bank-analysis/analyze-statement.ts`
  - `tests/e2e/v3-bank-analysis-engine.spec.ts`
- Minimal degisiklik:
  - Deterministic rule engine korunacak.
  - Recurring anahtari category + direction + normalize edilmis tutar bandi merkezli hale getirilecek.
  - Label icin aciklama sinyali korunacak, ancak grouping aciklama varyasyonuyla kirilmayacak.
- Ilgili test:
  - `npx playwright test tests/e2e/v3-bank-analysis-engine.spec.ts --project=chromium-desktop`
- Kabul kriteri:
  - Kira benzeri 4 hareket tek recurring expense olarak donmeli.
  - Large transaction siralamasi ve kategori tahmini bozulmamali.
  - Kullanici onayi olmadan Income/Expense/CashLedgerEntry olusmamali.

## 2. `/reconciliation` Desktop/Tablet/Mobil Yatay Tasma

- Sebep: Mutabakat ekraninda DataTable ve aksiyon kolonlari bazi grid/panel kombinasyonlarinda sayfa genisligini buyutuyor. Scroll tablo icinde kalmasi gerekirken root scroll width artiyor.
- Etkilenen dosyalar:
  - `src/components/reconciliation-screen.tsx`
  - `src/components/data-table.tsx`
  - Gerekirse `src/app/globals.css`
- Minimal degisiklik:
  - Grid cocuklari ve list panelleri `min-w-0` ile sinirlanacak.
  - Tablo/aksiyon alanlari sayfa yerine kendi container'inda yatay scroll yapacak.
  - UI tasma CSS ile sadece saklanmayacak; responsive layout gercekten container icine oturtulacak.
- Ilgili test:
  - `npx playwright test tests/e2e/v3-release-gates.spec.ts --grep "reconciliation-and-capital"`
- Kabul kriteri:
  - `/reconciliation` desktop, laptop, Firefox, WebKit, tablet, iPhone ve Android viewport'larda horizontal overflow toleransini gecmemeli.

## 3. Mobil/Tablet Banka Import Aksiyon Butonlari Kucuk

- Sebep: `BankRowActionPanel` satir ici aksiyonlari `min-h-9` ile 36px civarina dusuyor; release gate dokunmatik hedef minimumunu karsilamiyor.
- Etkilenen dosyalar:
  - `src/components/bank-row-action-panel.tsx`
- Minimal degisiklik:
  - Satir ici aksiyon butonlari `min-h-10` veya daha yuksek olacak.
  - Mobilde butonlar tam genislik/rahat dokunmatik alan saglayacak.
  - Aksiyon akisi ve API davranisi degismeyecek.
- Ilgili test:
  - `npx playwright test tests/e2e/v3-release-gates.spec.ts --grep "documents-and-bank-import" --project=tablet --project=iphone --project=android`
- Kabul kriteri:
  - `Yoksay`, `Gider oluştur`, `Kasa hareketi`, `Var olanla eşleştir` release gate touch target kontrolunu gecmeli.

## 4. Chromium Laptop Smoke Navigation Timing

- Sebep: RC1'de tek smoke testte `Execution context was destroyed` hatasi goruldu. Muhtemel neden route gecisi sirasinda assert calismasi veya RSC fallback navigation timing.
- Etkilenen dosyalar:
  - Uygulama tarafinda bulgu cikarsa ilgili route/component.
  - Test yanlissa ancak dokumante edilerek test bekleme noktasi duzeltilebilir.
- Minimal degisiklik:
  - Once uygulama route tasma/touch fixleri sonrasi hedefli tekrar kosulacak.
  - Hata tekrar ederse sadece navigation stabilizasyonu icin test helper bekleme davranisi incelenecek; test gevsetilmeyecek.
- Ilgili test:
  - `npx playwright test tests/e2e/v2-cross-browser.spec.ts --project=chromium-laptop`
- Kabul kriteri:
  - Chromium laptop smoke 0 fail ile gecmeli.

## 5. Docker Staging Kaniti Uretilemedi

- Sebep: Calisilan makinede Docker CLI yok: `command not found: docker`.
- Etkilenen dosyalar:
  - Kod degisikligi gerektirmez.
  - `docker-compose.staging.yml` ve staging dokumantasyonu daha once eklendi.
- Minimal degisiklik:
  - Bu sprintte repo icinden Docker binary kurulmayacak.
  - Docker kurulu ortamda tekrar kosulmasi gereken komutlar raporda belirtilecek.
- Ilgili test:
  - `docker compose -f docker-compose.staging.yml config`
  - `docker compose -f docker-compose.staging.yml up -d --build`
  - `curl http://localhost:3000/api/health`
- Kabul kriteri:
  - Docker kurulu staging ortaminda config/build/health pass kaniti uretilmeli.

## 6. Staging Health Check Fail

- Sebep: Docker staging ayaga kalkmadigi icin `localhost:3000` health endpoint'i cevap vermedi.
- Etkilenen dosyalar:
  - Kod degisikligi gerektirmez, Docker ortam bloklayicisi ile ayni kok nedene bagli.
- Minimal degisiklik:
  - Docker kurulu ortamda tekrar dogrulanacak.
- Ilgili test:
  - `curl http://localhost:3000/api/health`
- Kabul kriteri:
  - Staging container calisirken `ok: true`, `database: true`, `storage: true`, `version: 3.0.0-rc.2` veya yeni RC2 version bilgisi donmeli.

## RC2 Uygulama Sonucu

- Banka analiz recurring gider tespiti: PASS. Rule engine onceligi ve recurring grouping deterministic kalacak sekilde duzeltildi.
- `/reconciliation` responsive yatay tasma: PASS. Desktop, tablet, iPhone ve Android release gate kontrolleri gecti.
- Banka import mobil/tablet dokunmatik hedefleri: PASS. Aksiyon butonlari mobil minimum hedefleri karsilayacak sekilde buyutuldu.
- Chromium laptop navigation timing/flaky: PASS. Route helper client route yuklemeleri sakinlesmeden sonraki route'a gecmeyecek sekilde sikilastirildi.
- PDF extraction/upload reset yan etkisi: PASS. Next production server output normalizasyonu server route dosyalarini da kapsayacak sekilde genisletildi; PDF text-layer extraction testi tekrarli olarak gecti.
- Docker staging kaniti: ORTAM BLOKAJI. Bu makinede Docker CLI yok (`command not found: docker`). Kod tarafinda Docker config dogrulamasi bu ortamda calistirilamadi.
- Staging health check: ORTAM BLOKAJI. Docker staging ayaga kaldirilamadigi icin `localhost:3000/api/health` dogrulamasi Docker kurulu bir ortamda tekrar kosulmali.

Son dogrulama:
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run test`: PASS
- `npx playwright test`: PASS, 86 passed, 257 skipped
