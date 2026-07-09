# V3-RC2 Chromium Laptop Navigation Timing Fix

## Bloklayıcı

RC1 release gate sırasında V2 cross-browser route smoke testinde Chromium laptop projesinde şu flaky hata görüldü:

```text
Execution context was destroyed, most likely because of a navigation.
```

Etkilenen test:

```text
tests/e2e/v2-cross-browser.spec.ts
```

## Sonuç

Bu hata uygulama runtime bug olarak doğrulanmadı. Hedefli test mevcut durumda 5 tekrar çalıştırıldığında uygulama runtime/console guard hatası üretmeden geçti. Ancak test içinde navigasyon sonrası eski execution context üzerinde `waitForFunction`, `page.evaluate`, `locator.evaluateAll` ve `page.evaluate(fetch)` kullanan kırılgan noktalar vardı. Client-side redirect, RSC fallback veya route hydration sırasında bu kalıplar eski context üzerinde çalışırsa hata flaky biçimde ortaya çıkabiliyordu.

## Kök Neden

- `gotoRoute` URL hedefini açıkça beklemeden body üzerinde `waitForFunction` çalıştırıyordu.
- Sayfa sağlığı, yatay taşma ve chart ölçümleri route hydration tamamen stabil olmadan `page.evaluate` kullanabiliyordu.
- `expectVisibleText` locator evaluate ile görünürlük ölçüyordu.
- API post helper tarayıcı execution context içinde `fetch` çalıştırıyordu.
- Mobil menü fallback’i DOM üzerinde doğrudan `evaluate(click)` kullanıyordu.

## Yapılan Minimal Değişiklikler

- AppShell protected sayfalarına hydration sonrası non-visual `data-testid="page-ready-..."` marker eklendi.
- `/login` ve `/install` public sayfalarına statik readiness marker eklendi.
- `gotoRoute` şu deterministik sıraya alındı:
  - `page.goto(route)`
  - `page.waitForURL(...)`
  - `waitForRouteReady(...)`
  - kısa `networkidle` denemesi
- Body text bekleme `waitForFunction` yerine locator tabanlı `toContainText` oldu.
- Görünür metin kontrolü `locator.evaluateAll` yerine `expect(locator).toBeVisible()` oldu.
- Yatay taşma, chart ve touch target ölçümleri route-ready bekleyip retry-safe evaluate yapacak hale getirildi.
- API post helper tarayıcı context yerine `page.request.post` kullanıyor.
- Mobil menü navigasyonu `Promise.all([page.waitForURL(...), click])` kalıbına alındı.
- Touch target eşiği V3-RC2 standardıyla uyumlu olarak 44px’e çıkarıldı.

## Etkilenen Dosyalar

- `src/components/app-shell.tsx`
- `src/app/login/page.tsx`
- `src/app/install/page.tsx`
- `tests/e2e/v2-cross-browser.spec.ts`

## Test Sonuçları

PASS:

```bash
npm run typecheck
npm run lint
npm run build
```

PASS:

```bash
npx playwright test tests/e2e/v2-cross-browser.spec.ts --project=chromium-laptop --repeat-each=5
```

Sonuç:

```text
5 passed
5 skipped
```

Not: `V2 digital cash E2E flow` testi bu projede bilinçli olarak skip edilir; veri değiştiren akış yalnızca Chromium desktop projesinde çalıştırılmaktadır.

## Kabul Kriteri

- Chromium laptop route smoke 5 tekrar üst üste geçti.
- Console/runtime guard kritik hata üretmedi.
- Navigation timing hatası tekrarlanmadı.
- Test gevşetilmedi; route readiness ve URL beklentileri daha açık hale getirildi.

## Ek Not

Test koşusu öncesinde stale `.next` production çıktısı eksik chunk hatası üretebildi. Bu uygulama runtime bug değildir; kaynak değişikliği sonrası taze `npm run build` ve mevcut `scripts/fix-next-app-chunks.mjs` normalizasyonu ile test ortamı sağlıklı hale getirildi.
