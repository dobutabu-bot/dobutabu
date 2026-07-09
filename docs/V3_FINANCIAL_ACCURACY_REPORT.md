# V3-RC1 Finansal Doğruluk Raporu

Bu rapor V3-RC1 stabilizasyon fazında eklenen otomatik finansal doğruluk testlerinin kapsamını özetler. Testler production verisine dokunmadan izole bir test kullanıcısı, müvekkil, dosya ve kasa hesapları oluşturur; senaryo sonunda oluşturduğu kayıtları ve private test dosyalarını temizler.

## Test Altyapısı

- Test runner: Node.js yerleşik test runner.
- Komut: `npm run test`
- Test dosyası: `tests/financial-invariants.test.ts`
- Alias resolver: `tests/register-ts-paths.mjs`
- Decimal hesapları: `Prisma.Decimal` ile karşılaştırılır; floating point toplama yapılmaz.

## Kapsanan İnvariantlar

| Alan | Kontrol | Durum |
| --- | --- | --- |
| Tahsilat oluşturma | `Income` ve `CashLedgerEntry(IN)` oluşur, kasa bakiyesi artar. | PASS |
| Tahsilat düzenleme | Gelir ve bağlı ledger güncellenir, duplicate ledger oluşmaz. | PASS |
| Tahsilat silme | Gelir ve ledger soft delete olur, dashboard/rapor toplamlarından düşer. | PASS |
| Gider oluşturma | `Expense` ve `CashLedgerEntry(OUT)` oluşur, kasa bakiyesi azalır. | PASS |
| Gider düzenleme | Gider ve bağlı ledger güncellenir, duplicate ledger oluşmaz. | PASS |
| Gider silme | Gider ve ledger soft delete olur, dashboard/rapor toplamlarından düşer. | PASS |
| Kasa transferi | Çift ledger ile kasalar arası aktarım yapılır, toplam kasa değişmez, gelir/gider toplamı şişmez. | PASS |
| Banka import | `BankStatementRow` staging kayıtları oluşur; kullanıcı onayı olmadan gelir/gider oluşmaz; duplicate import engellenir. | PASS |
| Mutabakat | Eşleşmiş hareket tekrar eşleşmez, unlink çalışır, bankadan oluşturulan gider rollback ile soft delete edilir. | PASS |
| Sermaye | Borç negatif sayılır; değerleme geçmişi korunur; net sermaye varlık eksi borçtur; bağlı kasa önerilerde ikinci kez sayılmaz. | PASS |

## Çalıştırma

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## Son Çalıştırma Sonucu

2026-07-07 tarihinde V3-RC1 için aşağıdaki kapılar çalıştırıldı:

| Komut | Sonuç |
| --- | --- |
| `npm run test` | PASS - 8 test geçti, 0 fail |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |

`npm run test` Node.js yerleşik test runner ile çalışır. Node 24 altında `--experimental-transform-types` ve paket tipi uyarıları görülebilir; bu uyarılar test sonucunu başarısız yapmaz ve finansal doğruluk doğrulamasını etkilemez.

## Notlar

- Testler gerçek servisleri kullanır; mock tabanlı değildir. Bu nedenle ledger senkronizasyonu, rapor/dashboard filtreleri, banka import staging, mutabakat rollback ve sermaye özet hesapları birlikte doğrulanır.
- Banka import duplicate kontrolü dosya hash'i ve satır hash'i üzerinden doğrulanır. Aynı ekstre yeniden içe aktarılmaya çalışıldığında import reddedilir ve duplicate satır çoğalmaz.
- Bu test seti V3-RC1 release gate kapsamındadır; başarısız olursa release adayı stabil kabul edilmemelidir.
