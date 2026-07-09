# V3-RC2 Touch Target Fix

## Durum

RC1 release gate, mobil/tablet banka import ve mutabakat aksiyonlarında 44px altı dokunmatik hedefler tespit etti. Özellikle `Yoksay`, `Gider oluştur`, `Kasa hareketi`, `Var olanla eşleştir` aksiyonları ile aynı akışta görünen sayfalama ve export kontrolleri bazı viewportlarda 36-42px aralığında ölçülüyordu.

## Kök Neden

- Banka ve mutabakat aksiyonlarında farklı componentlerde dağınık `min-h-10`, `h-10`, `h-9` ve kompakt padding kullanımları vardı.
- Ortak `primary-action` / `secondary-action` sınıfları 44px'e yakın görünse de bazı yerel utility sınıfları bu standardı düşürüyordu.
- Release gate daha önce 40px altını yakalıyordu; test 44px minimuma sertleştirildi.

## Yapılan Minimal Değişiklikler

- `TouchActionButton` eklendi ve banka hareketi aksiyonlarında ortak 44px dokunmatik hedef standardı kullanıldı.
- Banka satır aksiyonları, mutabakat aksiyonları, belge aksiyonları ve sermaye export aksiyonları 44px güvenli hale getirildi.
- Icon-only aksiyonlar için `min-h-11` / `min-w-11` ve `aria-label` standardı korundu.
- Mobilde taşmayı önlemek için aksiyon satırlarında `flex-wrap`, `min-w-0`, tam genişlik ve kontrollü grid/wrap davranışı kullanıldı.
- Release gate touch target kontrolü `rect.width < 44 || rect.height < 44` olarak güncellendi.

## Etkilenen Dosyalar

- `src/components/touch-action-button.tsx`
- `src/components/bank-row-action-panel.tsx`
- `src/components/reconciliation-actions.tsx`
- `src/components/action-buttons.tsx`
- `src/components/reconciliation-screen.tsx`
- `src/components/bank-analysis-screen.tsx`
- `src/components/missing-document-actions.tsx`
- `src/components/capital-center-screen.tsx`
- `src/components/capital-history-screen.tsx`
- `src/app/(app)/bank-statements/page.tsx`
- `src/app/(app)/bank-statements/[id]/page.tsx`
- `src/app/(app)/documents/page.tsx`
- `src/app/(app)/documents/missing/page.tsx`
- `src/app/(app)/documents/unlinked/page.tsx`
- `tests/e2e/v3-release-gates.spec.ts`

## Kabul Kriterleri

- Mobil/tablet banka import ve mutabakat aksiyonlarında görünen tüm buton/link hedefleri en az 44px yüksekliğinde olmalı.
- Aksiyonlar mobilde yatay taşma üretmemeli.
- Desktop görünüm premium ve okunabilir kalmalı.
- Tehlikeli aksiyonlar kırmızı tonunu korumalı.
- Keyboard focus ve `aria-label` davranışı korunmalı.

## Test Sonuçları

PASS:

```bash
npm run typecheck
npm run lint
npm run build
```

PASS:

```bash
npx playwright test tests/e2e/v3-release-gates.spec.ts --grep "documents-and-bank-import|reconciliation-and-capital" --project=chromium-laptop --project=webkit-desktop --project=tablet --project=iphone --project=android
```

Sonuç: `10 passed`

PASS:

```bash
npx playwright test tests/e2e/v3-bank-statement-import.spec.ts --project=chromium-desktop --project=webkit-desktop --project=tablet --project=iphone --project=android
```

Sonuç: `8 passed`, `32 skipped`. Bu spec yalnızca Chromium desktop üzerinde gerçek veri değiştiren import senaryolarını çalıştıracak şekilde tasarlanmış; diğer projeler bilinçli olarak skip edilmektedir.

## Not

Playwright production web server doğrulamasında Next.js build çıktısında oluşabilen `api 2` / `(app) 2` duplicate klasörleri için mevcut `scripts/fix-next-app-chunks.mjs` normalizasyonu manuel olarak doğrulandı. Testler normalleştirilmiş build çıktısı üzerinden çalıştırıldı.
