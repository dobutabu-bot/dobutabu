# V3-RC2 Recurring Gider Tespiti Düzeltmesi

Tarih: 2026-07-08

## Problem

RC1 release gate içinde banka analiz motorunda kira benzeri düzenli giderler tek recurring grup olarak yakalanmıyordu. Kök neden recurring gruplamasının kategori ve sabit tutar bandına fazla bağlı kalmasıydı. Bu yaklaşım:

- `KIRA`, `KİRA`, `OFİS KİRASI`, `OFFICE RENT`, `DÜKKAN KİRASI` gibi açıklama varyasyonlarını kırılgan hale getiriyordu.
- Küçük tutar farklarında aynı düzenli gideri ayrı gruplara ayırabiliyordu.
- `IGNORED` eşleştirme durumundaki banka satırlarını recurring hesabından açıkça dışlamıyordu.

## Yapılan Minimal Düzeltme

Değiştirilen dosyalar:

- `src/lib/bank-analysis/analyze-statement.ts`
- `tests/e2e/v3-bank-analysis-engine.spec.ts`

Uygulanan düzeltmeler:

- Recurring analizi için uygun satırlar daraltıldı:
  - `deletedAt: null` ve `status: SUCCESS` veri kaynağı filtresi korunur.
  - `matchType: IGNORED` satırlar recurring hesabına dahil edilmez.
  - `TRANSFER` ve `NEUTRAL` hareketler recurring dışıdır.
  - Analiz son 12 aylık scoped veri üzerinde çalışır.
- Kira benzeri hareketler normalize edildi:
  - Türkçe karakterler, büyük/küçük harf farkı, noktalama ve fazla boşluklar temizlenir.
  - Ay/yıl/dönem gibi değişken parçalar gruplamayı bozmaz.
  - `KIRA`, `KİRA`, `OFİS KİRASI`, `OFFICE RENT`, `RENT`, `DÜKKAN KİRASI` aynı rent semantik grubuna alınabilir.
- Tutar gruplaması sabit band yerine toleranslı hale getirildi:
  - Aynı recurring adayında ortalama tutara göre yaklaşık `%10` tolerans uygulanır.
  - Küçük mutlak farklar için taban tolerans korunur.
- Output geriye uyumlu genişletildi:
  - Mevcut `label`, `category`, `count`, `averageAmount`, `totalAmount` alanları korunur.
  - Ek olarak `name`, `total`, `frequency`, `confidence` alanları sağlanır.

## Test Kapsamı

Hedefli test datası şu kira varyasyonlarını kapsayacak şekilde güçlendirildi:

- `KIRA`
- `OFİS KİRASI`
- `OFFICE RENT`
- `DÜKKAN KİRASI`
- Küçük tutar varyansı: 10.000 / 10.300 / 9.800 / 10.100 TL

Beklenen sonuç:

- `analysis.recurring.expense` içinde kira recurring kaydı bulunur.
- `count = 4`
- `total = 40.200`
- `frequency = MONTHLY`
- `confidence >= 0.8`
- Analiz kullanıcı onayı olmadan `Income`, `Expense` veya `CashLedgerEntry` oluşturmaz.

## Doğrulama

Çalıştırılan komutlar:

- `npx playwright test tests/e2e/v3-bank-analysis-engine.spec.ts --project=chromium-desktop` PASS, 2 passed
- `npm run test` PASS, 35 passed, 2 skipped
- `npm run typecheck` PASS

Son kapı komutları ayrıca çalıştırılmıştır:

- `npm run lint`
- `npm run build`

## Not

Bu düzeltme deterministic rule engine yaklaşımını korur. LLM, dış servis veya kullanıcı onayı olmadan otomatik finans kaydı oluşturma davranışı eklenmemiştir.
