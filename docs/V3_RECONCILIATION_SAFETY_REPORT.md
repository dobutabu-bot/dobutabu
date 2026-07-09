# V3-RC1 Mutabakat Güvenlik Raporu

Bu rapor V3-RC1 mutabakat sisteminde banka hareketlerinin sistem kayıtlarıyla kullanıcı onayı olmadan hatalı biçimde kalıcı eşleştirilmemesini doğrular.

## Test Kapsamı

`tests/reconciliation-safety.test.ts` aşağıdaki senaryoları izole test verisiyle kontrol eder:

1. Tek banka girişi ve tek aynı tutarlı tahsilat için yüksek güvenli öneri oluşur.
2. Öneri yalnızca öneridir; kullanıcı onayı olmadan `matchType` değişmez ve link alanları boş kalır.
3. Aynı tutarlı iki tahsilat olduğunda sistem otomatik karar vermez; hareket unmatched kalır.
4. Aynı tutar ama ters yön olduğunda öneri çıkmaz ve onaylı eşleştirme reddedilir.
5. 1 gün tarih farkı tolerans içinde öneri üretir.
6. 10 gün tarih farkı öneri üretmez.
7. Açıklamada/müvekkil sinyalinde müvekkil adı varsa öneri gerekçesinde müvekkil sinyali görünür.
8. Kullanıcı öneriyi onaylarsa `matchedIncomeId`, `matchedExpenseId` veya `matchedCashLedgerEntryId` alanları ve `matchType` güncellenir.
9. Geri alma işleminde linkler temizlenir ve `matchType` tekrar `NONE` olur.
10. Bankadan tahsilat oluşturma `Income` + `CashLedgerEntry` kaydını aynı akışta oluşturur, duplicate oluşturma engellenir ve rollback soft delete ile çalışır.
11. Bankadan gider oluşturma `Expense` + `CashLedgerEntry` kaydını aynı akışta oluşturur ve rollback soft delete ile çalışır.
12. Eşleştirme, geri alma ve bankadan kayıt oluşturma işlemleri audit log yazar.

## Şema Notu

Ürün dilinde “UNMATCHED / reconciliationStatus” olarak ifade edilen durum, mevcut Prisma şemasında `BankStatementRow.matchType = "NONE"` karşılığıyla tutulur.

Onaylı durumlar:

- `AUTO_MATCHED`
- `MANUALLY_MATCHED`
- `CREATED_FROM_BANK`

Geri alma sonrası beklenen durum:

- `matchType = "NONE"`
- `matchedIncomeId = null`
- `matchedExpenseId = null`
- `matchedCashLedgerEntryId = null`

## Güvenlik Sonucu

- Mutabakat önerileri kullanıcı onayı olmadan kalıcı işlem yapmaz.
- Ambiguous eşleşmeler otomatik öneri listesine alınmaz.
- Ters yönlü hareketler eşleştirilemez.
- Bankadan kayıt oluşturma duplicate koruması ve rollback mantığıyla çalışır.
- Audit log kritik mutabakat işlemlerini kaydeder.

## Çalıştırma

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## RC1 Test Sonucu

7 Temmuz 2026 tarihinde çalıştırılan son kontrolde:

- `tests/reconciliation-safety.test.ts`: 8/8 geçti.
- `npm run test`: 43/43 geçti, skip yok.
- `npm run typecheck`: geçti.
- `npm run lint`: geçti.
- `npm run build`: geçti.
- Dev server build sonrası tekrar başlatıldı ve `http://localhost:3010/api/health` 200 OK döndü.
