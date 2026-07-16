# CRUD Action Audit

Tarih: 2026-07-10

Kapsam: Bu audit yeni ozellik eklemeden mevcut aksiyon butonlarinin gercek API/server islemlerine bagli olup olmadigini kontrol eder.

## Envanter

| Route | Component | Buton etiketi | Server action/API route | Prisma islemi | Beklenen sonuc | Durum | Hata sebebi |
|---|---|---|---|---|---|---|---|
| `/clients` | `RecordEditButton` | Düzenle | `PATCH /api/clients/[id]` | `client.update` | Ayni müvekkil güncellenir | PASS | - |
| `/clients`, `/clients/[id]` | `ClientArchiveButton` | Sil/Arşivle | `POST /api/clients/[id]/archive` | `client.update({ archivedAt, deletedAt })` | Soft delete; bağlı kayıtlar korunur | PASS | - |
| `/settings/deleted-records` | `RestoreRecordButton` | Geri Al | `POST /api/deleted-records/clients/[id]/restore` | `client.update({ deletedAt: null, archivedAt: null })` | Müvekkil normal listeye döner | PASS | - |
| `/cases`, `/cases/[id]` | `RecordEditButton` | Düzenle | `PATCH /api/cases/[id]` | `caseFile.update` | Ayni dosya güncellenir | PASS | - |
| `/cases`, `/cases/[id]` | `ConfirmActionButton` | Sil/Arşivle | `DELETE /api/cases/[id]` | `caseFile.update({ status: ARCHIVED, archivedAt, deletedAt })` | Dosya normal listeden düşer, finans kayıtları korunur | PASS | - |
| `/settings/deleted-records` | `RestoreRecordButton` | Geri Al | `POST /api/deleted-records/cases/[id]/restore` | `caseFile.update` | Dosya aktif hale döner | PASS | - |
| `/collections`, `/collections/[id]`, `/cases/[id]` | `RecordEditButton` | Düzenle | `PATCH /api/collections/[id]` | `income.update` + `cashLedgerEntry.upsert` | Tahsilat ve bağlı ledger güncellenir, duplicate ledger oluşmaz | PASS | - |
| `/collections`, `/collections/[id]`, `/cases/[id]` | `ConfirmActionButton` | Sil | `DELETE /api/collections/[id]` | `income.update({ deletedAt })` + ledger soft delete sync | Tahsilat dashboard/rapordan düşer | PASS | - |
| `/settings/deleted-records` | `RestoreRecordButton` | Geri Al | `POST /api/deleted-records/incomes/[id]/restore` | `income.update` + ledger sync | Tahsilat ve ledger geri gelir | PASS | - |
| `/expenses`, `/expenses/[id]`, `/cases/[id]` | `RecordEditButton` | Düzenle | `PATCH /api/expenses/[id]` | `expense.update` + `cashLedgerEntry.upsert` | Gider ve bağlı ledger güncellenir | PASS | - |
| `/expenses`, `/expenses/[id]`, `/cases/[id]` | `ConfirmActionButton` | Sil | `DELETE /api/expenses/[id]` | `expense.update({ deletedAt })` + ledger sync | Gider dashboard/rapordan düşer | PASS | - |
| `/settings/deleted-records` | `RestoreRecordButton` | Geri Al | `POST /api/deleted-records/expenses/[id]/restore` | `expense.update` + ledger sync | Gider ve ledger geri gelir | PASS | - |
| `/receipts`, `/receipts/[id]` | `RecordEditButton` | Düzenle | `PATCH /api/receipts/[id]` | `invoiceOrReceipt.update` | Belge kaydı güncellenir | PASS | - |
| `/receipts`, `/receipts/[id]` | `ConfirmActionButton` | Sil / İptal | `DELETE /api/receipts/[id]` | Taslakta `deletedAt`, kesilmişte `status: CANCELLED` | Taslak soft delete, kesilmiş belge iptal | PASS | - |
| `/settings/deleted-records` | `RestoreRecordButton` | Geri Al | `POST /api/deleted-records/receipts/[id]/restore` | `invoiceOrReceipt.update({ deletedAt: null })` | Makbuz/fatura geri gelir | PASS | - |
| `/documents`, `/documents/[id]` | `ConfirmActionButton` | Sil | `DELETE /api/documents/[id]` | `document.update({ deletedAt })` | Belge normal listeden düşer, dosya storage'da kalır | PASS | - |
| `/documents/[id]/edit` | `EntityForm` | Kaydet | `PATCH /api/documents/[id]` | `document.update` + tag relation update | Metadata ve bağlantılar güncellenir | PASS | - |
| Kayıt detaylarındaki belge panelleri | `DocumentLinkSection` / API | Bağla / Bağlantıyı kaldır | `POST/DELETE /api/documents/links` | `document.update({ linked*Id })` | Link kurulur/kaldırılır, belge silinmez | PASS | - |
| `/settings/deleted-records` | `RestoreRecordButton` | Geri Al | `POST /api/deleted-records/documents/[id]/restore` | `document.update({ deletedAt: null })` | Belge normal listeye döner | PASS | Önceden MISSING; bu onarımda eklendi |
| `/bank-statements/[id]/analysis`, `/reconciliation` | `BankRowActionPanel` | Tahsilat/Gider/Kasa hareketi oluştur | `POST /api/reconciliation/create-from-row` | transaction ile Income/Expense/Ledger + row linkage | Kullanıcı onayı sonrası kayıt oluşur | PASS | - |
| `/reconciliation` | `ReconciliationActionButton` | Onayla / Bağlantıyı kaldır | `POST /api/reconciliation/match` / `unmatch` | `bankStatementRow.update`, CREATED_FROM_BANK rollback soft delete | Eşleşme kurulur veya geri alınır | PASS | - |
| `/reconciliation` | `BankRowActionPanel` | Yoksay / Geri al | `POST /api/reconciliation/ignore` / `unmatch` | `bankStatementRow.update` | Yoksayma durumu set/reset edilir | PASS | - |
| `/settings/deleted-records` | `RestoreRecordButton` | Geri Al | `POST /api/deleted-records/bank-imports/[id]/restore` | `bankStatementImport.update({ deletedAt: null })` | Import normal listede görünür | PASS | Önceden MISSING; bu onarımda eklendi |
| `/cash/accounts` | `RecordEditButton` | Düzenle | `PATCH /api/cash/accounts/[id]` | `cashAccount.update` | Hesap güncellenir | PASS | - |
| `/cash/accounts` | `ConfirmActionButton` | Sil/Arşivle | `DELETE /api/cash/accounts/[id]` | `softDeleteCashAccount` | Kasa soft delete/pasif olur | PASS | - |
| `/settings/deleted-records` | `RestoreRecordButton` | Geri Al | `POST /api/deleted-records/cash-accounts/[id]/restore` | `cashAccount.update({ deletedAt: null, isActive: true })` | Kasa tekrar aktifleşir | PASS | Önceden MISSING; bu onarımda eklendi |
| `/reminders` | `RecordEditButton` | Düzenle | `PATCH /api/reminders/[id]` | `taskReminder.update` | Hatırlatma güncellenir | PASS | - |
| `/reminders` | `ReminderStatusButton` | Tamamla / Aç | `PATCH /api/reminders/[id]` | `taskReminder.update({ status })` | Durum değişir | PASS | - |
| `/reminders` | `ReminderPayButton` | Öde | `POST /api/reminders/[id]/pay` | transaction ile Expense + Ledger + Reminder DONE | Gider duplicate olmadan oluşur | PASS | - |
| `/reminders` | `ConfirmActionButton` | Sil | `DELETE /api/reminders/[id]` | `taskReminder.update({ deletedAt })` | Hatırlatma normal listeden düşer | PASS | - |
| `/settings/deleted-records` | `RestoreRecordButton` | Geri Al | `POST /api/deleted-records/reminders/[id]/restore` | `taskReminder.update({ deletedAt: null })` | Hatırlatma geri gelir | PASS | Önceden MISSING; bu onarımda eklendi |
| `/capital`, `/capital/assets` | `RecordEditButton` | Düzenle | `PATCH /api/capital/assets/[id]` | `assetAccount.update` | Varlık güncellenir | PASS | - |
| `/capital`, `/capital/assets` | `ConfirmActionButton` | Sil | `DELETE /api/capital/assets/[id]` | `softDeleteAssetAccount` | Varlık soft delete olur | PASS | - |
| `/capital` | Valuation form | Değer güncelle | `POST /api/capital/assets/[id]/valuations` | `assetValuation.create` | Değerleme geçmişi korunur | PASS | - |
| `/settings/deleted-records` | `RestoreRecordButton` | Geri Al | `POST /api/deleted-records/assets/[id]/restore` | `assetAccount.update({ deletedAt: null, isActive: true })` | Varlık tekrar görünür | PASS | Önceden MISSING; bu onarımda eklendi |

## Ortak Bulgular

- `RecordEditButton`, `ConfirmActionButton`, `RestoreRecordButton` ve `EntityForm` function prop yerine serializable endpoint/config alıyor.
- Client componentler Prisma çağrısı yapmıyor; private API route üzerinden ilerliyor.
- Tahsilat/gider update ve delete işlemleri ledger sync ile transaction içinde yapılıyor.
- Banka hareketinden kayıt oluşturma ve rollback işlemleri kullanıcı onaylı ve transaction tabanlı.
- Eksik kalan ana alan V3 restore görünürlüğüydü; belge, banka importu, kasa hesabı, hatırlatma ve sermaye varlığı geri alma akışları bu onarımda bağlandı.

