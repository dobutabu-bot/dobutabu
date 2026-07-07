# V3-RC1 Mimari Doğrulama Raporu

Tarih: 2026-07-07  
Sürüm: V3-RC1 / 3.0.0-rc.1  
Amaç: Yayın adayı öncesinde V1/V2 çekirdeğinin bozulmadığını, V3 modüllerinin ilişki tabanlı üst katman olarak eklendiğini ve hydration/server-client sınırlarının korunduğunu doğrulamak.

## Denetim Yöntemi

- Prisma şeması model ve ilişki taraması yapıldı.
- Soft delete, audit log, import, mutabakat ve sermaye servisleri hedefli incelendi.
- Client Component sınırı için `use client`, `serializeEntity`, browser-only API ve lazy chart kullanımları tarandı.
- `window`, `document`, `localStorage`, `matchMedia`, `navigator`, `Date.now`, `Math.random`, `Intl` ve tarih/para serialization riskleri incelendi.
- Zorunlu kalite kapıları çalıştırıldı:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

## Sonuç Özeti

| Başlık | Sonuç | Not |
| --- | --- | --- |
| V1/V2 çekirdek modeller rename/drop edilmemiş mi? | PASS | `User`, `Client`, `CaseFile`, `Income`, `Expense`, `InvoiceOrReceipt`, `CashAccount`, `CashLedgerEntry` modelleri korunuyor. |
| Çekirdek finans kayıtları korunuyor mu? | PASS | Müvekkil, dosya, tahsilat, gider, makbuz/fatura, kasa hesabı ve kasa hareketi tabloları mevcut; V3 ilişkileri optional/SetNull üst katman olarak eklenmiş. |
| V3 modelleri üst katman mı? | PASS | `Document`, `BankStatementImport`, `BankStatementRow`, `TransactionRule`, `AssetAccount` ve ilişkili V3 modelleri çekirdek kayıtları rename/drop etmeden bağlanıyor. |
| Soft delete tüm modüllerde çalışıyor mu? | PASS | `deletedAt` alanları ve normal sorgularda `deletedAt: null` filtreleri korunuyor; V3 için `src/lib/db/soft-delete.ts` merkezi servis var. |
| Audit log kritik işlemleri kaydediyor mu? | PASS | CRUD, belge, banka import, mutabakat, kasa ve sermaye işlemlerinde `writeAuditLog` kullanılıyor; log hatası ana işlemi patlatmıyor. |
| Banka import doğrudan tahsilat/gider oluşturmuyor mu? | PASS | `/api/bank-statements/import` yalnız `BankStatementImport` ve `BankStatementRow` staging kayıtları oluşturuyor. |
| Mutabakat kullanıcı onayı olmadan kalıcı işlem yapıyor mu? | PASS | Kalıcı match/create işlemleri ayrı reconciliation action route'larında; öneriler onaysız finans kaydı üretmiyor. |
| Sermaye varlığı kullanıcı onayı olmadan oluşturuluyor mu? | PASS | `/capital/import` akışı öneri üretir; yalnız `accepted` kararına sahip öneriler `AssetAccount`/`AssetValuation` oluşturur. |
| Client Component'e function prop geçiliyor mu? | PASS | Server Component'ten function prop geçişi bulunmadı. `BrowserNotificationManager` gibi callback prop'ları client-to-client sınırında kalıyor. |
| Decimal, Date, BigInt ham şekilde client'a gidiyor mu? | PASS | Kritik dashboard, rapor, sermaye, banka analizi, mutabakat ve layout geçişlerinde `serializeEntity`, `serializeMoney`, `serializeDate` kullanılıyor. |
| Hydration mismatch riski var mı? | PASS | Browser-only API kullanımları `useEffect`, event handler veya client action içinde. İlk render'da localStorage/matchMedia/window branch'iyle HTML farkı üretilmiyor. |

## Detaylı Bulgular

### 1. Çekirdek Model Koruması

`prisma/schema.prisma` içinde V1/V2 çekirdek modelleri korunuyor:

- `User`
- `Client`
- `CaseFile`
- `Income`
- `Expense`
- `InvoiceOrReceipt`
- `CashAccount`
- `CashLedgerEntry`

V3 alanları çekirdek modellere ilişki veya optional alan olarak eklenmiş durumda. Örneğin `Income`, `Expense`, `InvoiceOrReceipt` ve `CashLedgerEntry` tarafında `attachedDocuments` ve `documentNotRequired` gibi üst katman alanları var; temel kayıt kimliği ve finans hesap mantığı korunuyor.

### 2. V3 Üst Katman Modelleri

V3 modelleri bağımsız tablolar ve optional relation yaklaşımıyla eklendi:

- `Document`
- `DocumentTag`
- `DocumentProcessingLog`
- `BankStatementImport`
- `BankStatementRow`
- `BankImportMapping`
- `TransactionCategory`
- `TransactionRule`
- `AssetAccount`
- `AssetValuation`
- `AssetTransaction`
- `CapitalSnapshot`
- `CapitalImport`
- `CapitalImportSuggestion`

Bu modeller çekirdek finans kayıtlarını silmiyor, yeniden adlandırmıyor veya zorunlu yeni bağımlılığa çevirmiyor. Bağlantıların çoğu `onDelete: SetNull` veya üst kayıt bağlamında güvenli relation olarak tasarlanmış.

### 3. Soft Delete Doğrulaması

Soft delete alanları çekirdek ve V3 modüllerinde mevcut:

- `Client.deletedAt`
- `CaseFile.deletedAt`
- `Income.deletedAt`
- `Expense.deletedAt`
- `InvoiceOrReceipt.deletedAt`
- `CashAccount.deletedAt`
- `CashLedgerEntry.deletedAt`
- `Document.deletedAt`
- `BankStatementImport.deletedAt`
- `BankStatementRow.deletedAt`
- `TransactionCategory.deletedAt`
- `TransactionRule.deletedAt`
- `AssetAccount.deletedAt`
- `AssetValuation.deletedAt`
- `AssetTransaction.deletedAt`
- `CapitalSnapshot.deletedAt`

Normal liste, dashboard, rapor, arama, belge ve mutabakat sorgularında `deletedAt: null` filtreleri kullanılıyor. V3 generic soft delete/restore davranışı `src/lib/db/soft-delete.ts` içinde standartlaştırılmış.

### 4. Audit Log Doğrulaması

`src/lib/audit.ts` içindeki `writeAuditLog` kritik operasyonları kaydediyor. Hata durumunda ana işlem bozulmuyor; hata server log'a yazılıyor.

Audit kapsamı gözlenen başlıklar:

- Müvekkil/dosya/tahsilat/gider/makbuz-fatura CRUD
- Belge upload/update/delete/link/unlink/reprocess/OCR
- Kasa hesabı, kasa hareketi, transfer ve düzeltme
- Hatırlatma update/delete/done/pay
- Banka import ve mutabakat
- Transaction rule yönetimi
- Sermaye asset, valuation, transaction ve import
- Restore işlemleri

### 5. Banka Import ve Mutabakat Güvenliği

`src/app/api/bank-statements/import/route.ts` import isteğini `commitStagedBankStatementImport` üzerinden çalıştırıyor. Bu akış finans kaydı oluşturmaz; banka verisini staging alanına alır.

Tahsilat/gider/kasa hareketi oluşturma yalnız `src/lib/reconciliation/reconciliation-service.ts` içindeki explicit action fonksiyonlarıyla yapılır. Bu fonksiyonlar:

- Eşleşmiş/yoksayılmış hareketten tekrar kayıt oluşturmayı engeller.
- Banka hareket yönü ile kayıt tipini doğrular.
- Kasa hesabını çözer.
- Aynı kasa, yakın tarih, aynı yön ve aynı tutarda duplicate ledger adayını reddeder.
- İşlemi transaction içinde `Income`/`Expense` + `CashLedgerEntry` + `BankStatementRow` bağlantısı olarak kurar.
- Geri alma için `unmatchBankStatementRow` soft delete ve status reset akışını destekler.

### 6. Sermaye Import Güvenliği

`src/lib/capital/capital-import-service.ts` import sırasında önerileri `CapitalImportSuggestion` olarak kaydeder. `AssetAccount`, `AssetValuation` ve `AssetTransaction` yalnız kullanıcı tarafından kabul edilen öneriler için oluşturulur. Düşük güvenli veya reddedilen öneriler varlığa dönüşmez.

### 7. Server/Client Serialization

Ortak helper'lar mevcut:

- `serializeMoney`
- `serializeDate`
- `serializeEntity`

Kritik server-to-client geçişleri doğrulandı:

- `src/app/(app)/layout.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/reports/page.tsx`
- `src/app/(app)/capital/page.tsx`
- `src/app/(app)/bank-statements/analysis/page.tsx`
- `src/app/(app)/bank-statements/[id]/analysis/page.tsx`
- `src/app/(app)/reconciliation/page.tsx`
- `src/app/(app)/cash/reconciliation/page.tsx`
- `src/app/(app)/search/page.tsx`
- `src/app/(app)/notifications/page.tsx`

Bu geçişlerde Prisma Decimal, Date, BigInt veya Prisma object ham şekilde Client Component'e verilmemektedir.

### 8. Function Prop Sınırı

Server Component'ten Client Component'e callback/function prop geçişi bulunmadı. İncelenen function prop kullanımları client boundary içinde kalıyor:

- `AppShell` -> `BrowserNotificationManager` içinde `setLiveReminderNotifications`
- Lazy chart error boundary `onRetry`
- Modal/drawer/action event handler'ları

Bu kullanımlar server serialization sınırını ihlal etmez.

### 9. Hydration Güvenliği

Browser-only kullanımlar şu sınıflarda kalıyor:

- `useEffect` sonrası çalışan kontroller
- Kullanıcı aksiyonu handler'ları
- Client-only notification/PWA/preview akışları
- Lazy chart yükleme ve IntersectionObserver

Özellikle `AppShell` ilk render'da aktif path'i `hydratedPathname` null iken deterministik üretir; pathname kaynaklı className farkları effect sonrası uygulanır. `localStorage`, `Notification`, `navigator`, `matchMedia`, `window` ve `document` ilk server/client HTML farkı oluşturacak şekilde kullanılmıyor.

### 10. Release Gate Komutları

Son denetimde çalışan komutlar:

```bash
npm run typecheck
npm run lint
npm run build
```

Sonuç:

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS

## Fail Listesi

FAIL bulunmadı. Kod değişikliği gerektiren mimari ihlal tespit edilmedi.

## RC1 Kararı

V3-RC1 mimari doğrulama kapısı geçmiştir. Bundan sonraki aşamada yeni özellik eklenmemeli; yalnız hata düzeltme, test genişletme, güvenlik sertleştirmesi, staging, Docker smoke ve release hazırlığı yapılmalıdır.
