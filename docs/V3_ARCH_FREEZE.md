# V3 Mimari Dondurma ve Envanter

Tarih: 2026-07-06

Bu dokuman, V1/V2 omurgasinin V3 gelistirmeleri baslamadan once korunacak mimari sinirlarini ve mevcut sistem envanterini sabitler. V3; belge merkezi, banka ekstresi analizi, mutabakat ve sermaye merkezi gibi ust katmanlari eklerken V1/V2'nin calisan finans, dijital kasa, audit log, soft delete, dashboard, rapor, PWA ve auth akislarini bozmamalidir.

## 1. Dondurma Kurallari

V1/V2 cekirdek omurgasi dondurulmustur.

Asagidaki modeller yeniden adlandirilamaz, drop edilemez veya mevcut anlami degistirilemez:

- `User`
- `Client`
- `CaseFile`
- `Income`
- `Expense`
- `InvoiceOrReceipt`
- `TaskReminder`
- `AppSetting`
- `AuditLog`
- `CashAccount`
- `CashLedgerEntry`
- `CashTransfer`
- `BalanceSnapshot`

V3 gelistirmeleri yalnizca iliski tabanli ust katman olarak eklenmelidir. Mevcut kayitlarin anlamini degistirmek yerine yeni tablolar, nullable iliski alanlari, servis katmani ve rapor/analiz katmani kullanilmalidir.

Yasaklar:

- Cekirdek modelleri rename/drop etmek.
- Cekirdek alanlari destructive migration ile silmek.
- Mevcut enum degerlerini silmek veya anlamini degistirmek.
- Mevcut route davranisini sessizce degistirmek.
- Soft delete filtrelerini kaldirmak.
- Audit log yazilan kritik islemleri logsuz hale getirmek.
- Dashboard ve raporlarda silinen kayitlari tekrar toplamlara dahil etmek.
- Client componentlere `Date`, `Decimal`, `BigInt` gibi non-serializable degerleri dogrudan gondermek.
- Server Component'ten Client Component'e function prop gecmek.
- Ilk render'da `window`, `document`, `localStorage`, `matchMedia`, `Date.now`, `Math.random` gibi hydration farki yaratabilecek degerlerle branch olusturmak.

Izin verilen degisiklikler:

- Yeni V3 modelleri eklemek.
- Cekirdek modellere geriye uyumlu nullable iliski alani eklemek.
- Enumlara geriye uyumlu yeni deger eklemek.
- Yeni API route, servis ve rapor katmani eklemek.
- Mevcut sorgulari sadece daha guvenli hale getirmek, ornegin eksik `deletedAt: null` filtresi eklemek.

## 2. Prisma Model Envanteri

Kaynak: `prisma/schema.prisma`

### V1 Cekirdek Finans

- `User`: tek kullanici auth ve veri sahipligi.
- `Client`: muvekkil kayitlari, soft delete ve arsiv destegi.
- `CaseFile`: muvekkile bagli dosya kayitlari, soft delete ve arsiv destegi.
- `Income`: tahsilat kayitlari, `cashAccountId` ile V2 kasa baglantisi.
- `Expense`: gider kayitlari, `cashAccountId` ile V2 kasa baglantisi.
- `InvoiceOrReceipt`: makbuz/fatura takip kayitlari.
- `TaskReminder`: genel, gider, tahsilat, dosya, makbuz/fatura ve vergi hatirlatmalari.
- `AppSetting`: firma ve uygulama ayarlari.

### V2 Dijital Kasa

- `CashAccount`: nakit, banka, kredi karti, sanal ve diger kasa hesaplari.
- `CashLedgerEntry`: kasa hareketleri; tahsilat, gider, transfer, duzeltme ve acilis bakiyesi.
- `CashTransfer`: hesaplar arasi transfer kaydi.
- `BalanceSnapshot`: tarih bazli kasa bakiye snapshot altyapisi.

### Denetim Izi

- `AuditLog`: create, update, delete, restore, archive ve cancel gibi kritik islemler icin islem gecmisi.

### V3 Belge Merkezi

- `Document`: dekont, makbuz, fis, fatura, PDF, gorsel ve banka ekstresi metadata kaydi.
- `DocumentTag`: belge etiketleri.
- `DocumentTagOnDocument`: belge-etiket iliskisi.
- `DocumentProcessingLog`: belge isleme ve metin cikarma loglari.

### V3 Banka Ekstresi, Kural ve Mutabakat

- `BankStatementImport`: banka ekstresi import oturumu.
- `BankStatementRow`: import edilen banka hareketleri.
- `TransactionRule`: kullanici tanimli siniflandirma kurallari.

Mutabakat davranisi servis/API katmaninda yurutulur. Banka hareketleri ve sistem kasa hareketleri kalici link/status alanlari uzerinden eslestirilir; otomatik oneriler kullanici onayi olmadan kalici isleme donusmemelidir.

### V3 Sermaye ve Varlik

- `AssetAccount`: nakit, banka, doviz, altin, borsa, crypto, fon, gayrimenkul, arac, alacak, borc ve diger varliklar.
- `AssetValuation`: manuel/import/system kaynakli varlik degerlemeleri.
- `AssetTransaction`: varlik alim, satis, deposit, withdraw, value update, transfer ve adjustment hareketleri.
- `CapitalSnapshot`: toplam varlik, toplam borc ve net sermaye snapshot'i.
- `CapitalImport`: sermaye/mali belge import oturumu.
- `CapitalImportSuggestion`: import sonucunda kullanici onayina sunulan varlik onerileri.

## 3. Soft Delete Envanteri

Normal liste, dashboard ve rapor sorgularinda silinen kayitlar dahil edilmemelidir.

`deletedAt` kullanan ana modeller:

- `Client`
- `CaseFile`
- `Income`
- `Expense`
- `InvoiceOrReceipt`
- `CashAccount`
- `CashLedgerEntry`
- `CashTransfer`
- `TaskReminder`
- `Document`
- `BankStatementImport`
- `BankStatementRow`
- `TransactionRule`
- `AssetAccount`
- `AssetTransaction`
- `CapitalImport`

`archivedAt` kullanan ana modeller:

- `Client`
- `CaseFile`

Kurallar:

- Silme varsayilani hard delete degil, soft delete olmalidir.
- Iliskili finansal kayitlar olan muvekkil/dosya hard delete edilmemelidir.
- Silinen tahsilat/gider bagli ledger kaydini da soft delete etmelidir.
- Restore islemleri `deletedAt` ve gerekiyorsa `archivedAt` alanlarini temizlemeli ve audit log yazmalidir.
- Raporlar, dashboard, cari hesap, dosya finans ozeti ve kasa bakiyesi hesaplari `deletedAt: null` filtresini korumalidir.

## 4. Route Envanteri

Kaynak: `src/app/**`

### Public ve Auth

- `/login`
- `/install`
- `/api/auth/login`
- `/api/auth/logout`

### V1 Finans ve Operasyon

- `/dashboard`
- `/clients`
- `/clients/[id]`
- `/cases`
- `/cases/[id]`
- `/collections`
- `/collections/[id]`
- `/expenses`
- `/expenses/[id]`
- `/receipts`
- `/advances`
- `/balances`
- `/reports`
- `/reminders`
- `/activity`
- `/settings`
- `/settings/deleted-records`
- `/backup`
- `/export`

### V2 Dijital Kasa

- `/cash`
- `/cash/accounts`
- `/cash/ledger`
- `/cash/ledger/[id]`
- `/cash/reconciliation`
- `/reconciliation`
- `/reconciliation/balances`

### V3 Belge, Banka, Sermaye ve Arama

- `/documents`
- `/documents/new`
- `/documents/[id]`
- `/documents/[id]/edit`
- `/documents/missing`
- `/bank-statements`
- `/bank-statements/import`
- `/bank-statements/[id]`
- `/bank-statements/analysis`
- `/bank-statements/[id]/analysis`
- `/bank-statements/[id]/reconciliation`
- `/capital`
- `/capital/assets`
- `/capital/history`
- `/capital/import`
- `/search`
- `/settings/transaction-rules`

### Kritik API Gruplari

- Core CRUD: `/api/clients`, `/api/cases`, `/api/collections`, `/api/expenses`, `/api/receipts`, `/api/reminders`
- Kasa: `/api/cash/accounts`, `/api/cash/ledger/adjustments`, `/api/cash/ledger/transfers`
- Belgeler: `/api/documents/upload`, `/api/documents/[id]`, `/api/documents/[id]/preview`, `/api/documents/[id]/download`, `/api/documents/[id]/reprocess`, `/api/documents/links`, `/api/documents/requirements`
- Banka ekstresi: `/api/bank-statements/import`, `/api/bank-statements/preview`, `/api/bank-statements/analysis/export`
- Mutabakat: `/api/reconciliation/match`, `/api/reconciliation/unmatch`, `/api/reconciliation/ignore`, `/api/reconciliation/create-from-row`
- Sermaye: `/api/capital/assets`, `/api/capital/assets/[id]`, `/api/capital/assets/[id]/valuations`, `/api/capital/import/preview`, `/api/capital/import/confirm`, `/api/capital/snapshots`
- PDF raporlar: `/api/reports/**/pdf`
- Export/backup: `/api/export`, `/api/export/zip`, `/api/backup`, `/api/backup/sqlite`
- Ayarlar ve kurallar: `/api/settings`, `/api/settings/documents`, `/api/settings/transaction-rules`
- Arama: `/api/search`

## 5. Servis Katmani Envanteri

Kaynak: `src/lib/**`

### Auth, Guvenlik ve Ortak Altyapi

- `src/lib/auth.ts`
- `src/lib/session.ts`
- `src/lib/password.ts`
- `src/lib/rate-limit.ts`
- `src/lib/production-env.ts`
- `src/lib/security-headers.ts`
- `src/lib/prisma.ts`
- `src/middleware.ts`

### Audit, Ownership ve Ayarlar

- `src/lib/audit.ts`
- `src/lib/ownership.ts`
- `src/lib/settings.ts`
- `src/lib/restore-service.ts`

### Core Finans

- `src/lib/client-sync.ts`
- `src/lib/collection-query.ts`
- `src/lib/expense-query.ts`
- `src/lib/receipt-query.ts`
- `src/lib/validations.ts`
- `src/lib/labels.ts`
- `src/lib/utils.ts`

### Dashboard ve Raporlar

- `src/lib/dashboard/dashboard-data.ts`
- `src/lib/dashboard/v3-dashboard-data.ts`
- `src/lib/reports/report-data.ts`
- `src/lib/reports/v3-report-data.ts`
- `src/lib/reporting.ts`

### Dijital Kasa

- `src/lib/cash/cash-account-service.ts`
- `src/lib/cash/cash-ledger-service.ts`
- `src/lib/cash/cash-dashboard-data.ts`
- `src/lib/cash/cash-report-data.ts`
- `src/lib/cash-ledger.ts`

### Hatirlatmalar ve Bildirimler

- `src/lib/reminders/check-reminders.ts`
- `src/lib/reminders/reminder-data.ts`
- `src/lib/reminder-notifications.ts`
- `src/lib/browser-notifications.ts`
- `src/lib/notification-read-state.ts`

### Belge Merkezi

- `src/lib/document-helpers.ts`
- `src/lib/document-links.ts`
- `src/lib/document-processing.ts`
- `src/lib/document-requirements.ts`
- `src/lib/document-storage.ts`
- `src/lib/missing-documents.ts`

### Banka Ekstresi ve Analiz

- `src/lib/bank-statements.ts`
- `src/lib/bank-analysis/analyze-statement.ts`
- `src/lib/bank-analysis/categorize-transaction.ts`
- `src/lib/bank-analysis/reconciliation.ts`
- `src/lib/bank-analysis/statement-summary.ts`
- `src/lib/transaction-rules.ts`

### Mutabakat

- `src/lib/reconciliation/balance-reconciliation.ts`
- `src/lib/reconciliation/reconciliation-service.ts`

### Sermaye ve Varlik

- `src/lib/capital/capital-data.ts`
- `src/lib/capital/capital-import.ts`

### PDF, Export, Arama ve PWA Yardimcilari

- `src/lib/pdf/pdf-service.ts`
- `src/lib/export-csv.ts`
- `src/lib/export-data.ts`
- `src/lib/export-zip.ts`
- `src/lib/zip.ts`
- `src/lib/search/search-data.ts`
- `src/lib/api.ts`

## 6. Dashboard ve Rapor Sorgu Sinirlari

Dashboard ve rapor hesaplari server-side hazirlanmalidir. Client componentlere yalnizca plain object, string ve number gonderilmelidir.

Korunacak veri servisleri:

- `src/lib/dashboard/dashboard-data.ts`
- `src/lib/dashboard/v3-dashboard-data.ts`
- `src/lib/reports/report-data.ts`
- `src/lib/reports/v3-report-data.ts`
- `src/lib/cash/cash-dashboard-data.ts`
- `src/lib/cash/cash-report-data.ts`

Kurallar:

- Tahsilat/gider/kasa toplamlarinda `deletedAt: null` filtresi korunur.
- Transferler gelir/gider toplamlarini sisirmemelidir.
- Kasa bakiyesi ledger direction ve entry type mantigina gore hesaplanir.
- V3 belge, banka ve sermaye analizleri V1/V2 dashboard verilerini override etmemeli; ek bolum olarak baglanmalidir.
- Buyuk veri setleri dashboard'a ham olarak gonderilmemeli; ozetlenmis veri gonderilmelidir.

## 7. Audit Log Sinirlari

`AuditLog` V1/V2/V3 kritik islemler icin ortak denetim izi katmanidir.

Loglanmasi gereken V3 islemleri:

- Belge upload/update/delete/link/unlink/reprocess.
- Banka ekstresi import.
- Banka hareketinden tahsilat/gider olusturma.
- Mutabakat match/unmatch/ignore.
- Sermaye varligi create/update/delete.
- Varlik deger guncelleme.
- Sermaye import ve kullanici onayli varlik olusturma.
- Belge gerekmiyor isaretleme.
- Transaction rule create/update/delete/toggle/test sonucu gerekiyorsa.

Log yazilamazsa ana kullanici islemi mumkun oldugunca bozulmamalidir; hata server log'a dusmelidir. Loglarda ham banka ekstresi, tam OCR metni, dosya icerigi veya hassas portfoy detaylari gereksiz yere basilmamalidir.

## 8. Auth, PWA ve Guvenlik Envanteri

### Auth

- Tek kullanici auth akisi `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/password.ts`, `src/lib/rate-limit.ts` ve `/api/auth/*` uzerinden calisir.
- Protected route kontrolu `src/app/(app)/layout.tsx` ve `src/middleware.ts` ile saglanir.
- Yeni V3 route ve API'lar auth kontrolu olmadan veri okumamali/yazmamali.
- Yeni modellerde `userId` veri sahipligi icin korunmalidir.

### PWA

- Manifest: `public/app.webmanifest`, `public/manifest.json`
- Service worker: `public/sw.js`
- Register component: `src/components/pwa-register.tsx`
- Offline uyari: `src/components/offline-status-banner.tsx`
- Kurulum ekrani: `/install`

V3 gelistirmeleri PWA app shell, offline fallback ve install davranisini bozmamalidir. Offline veri yazma ilk surumde zorunlu degildir.

### Dosya Guvenligi

- Belgeler public klasore yazilmamalidir.
- Storage path auth kontrollu preview/download route'lari ile servis edilmelidir.
- MIME, uzanti, boyut, dosya adi sanitize, UUID storage name, duplicate hash ve path traversal kontrolleri korunmalidir.
- Hassas dosya indirme/preview route'lari uygun `Cache-Control` header'lari ile donmelidir.

## 9. V3 Icin Belirsiz / Karar Bekleyen Alanlar

Asagidaki alanlar V3 dokumaninda bilincli olarak unspecified durumdadir. Kod tarafinda provider'a kilitlenen karar alinmadan once ayrica tasarim karari verilmelidir.

### AV / CDR Saglayicisi

Henuz secilmedi.

Karar bekleyenler:

- Local ClamAV veya benzeri antivirus taramasi kullanilacak mi?
- Content Disarm and Reconstruction (CDR) icin harici servis kullanilacak mi?
- Supheli dosyalar icin quarantine akisi olacak mi?
- Buyuk dosyalarda tarama sync mi async mi calisacak?
- Taramasi basarisiz dosya yuklenmis sayilacak mi, yoksa beklemeye mi alinacak?

### PDF OCR Saglayicisi

Henuz secilmedi.

Mevcut hedef:

- Secilebilir metin iceren PDF'lerde text extraction.
- Gorsel PDF/JPG/PNG icin OCR opsiyonel.

Karar bekleyenler:

- Tesseract gibi local OCR mi, yoksa cloud OCR mi kullanilacak?
- Varsayilan dil paketi `tur+eng` mi olacak?
- OCR confidence skoru saklanacak mi?
- OCR islemleri background queue ile mi yapilacak?
- Hassas extracted text icin retention/maskeleme politikasi olacak mi?

### Canli Fiyat Saglayicisi

Henuz secilmedi.

Mevcut kural:

- Sermaye/varlik degerleri manuel veya import kaynakli girilir.
- Sistem yatirim tavsiyesi vermez.

Karar bekleyenler:

- Doviz icin TCMB veya baska provider kullanilacak mi?
- Altin, hisse, fon ve crypto icin hangi provider kullanilacak?
- Rate limit, cache, lisans ve veri gecikmesi nasil yonetilecek?
- Canli fiyatlar sadece bilgi amacli mi, yoksa valuation kaydi olusturacak mi?

### Banka PDF Format Varyasyonlari

Henuz standartlastirilmadi.

Mevcut kural:

- En dogru sonuc icin CSV/XLSX onerilir.
- PDF ekstresi bankadan bankaya degisebilir ve best-effort parse edilir.

Karar bekleyenler:

- Banka bazli parser template'leri tutulacak mi?
- Garanti, Is Bankasi, Akbank, Yapi Kredi, QNB, DenizBank, VakifBank, Ziraat gibi bankalar icin fixture seti olusturulacak mi?
- PDF tablo ayrisma basarisiz olursa manuel kolon esleme mi, yoksa kullaniciya CSV/XLSX yukleme onerisi mi varsayilan olacak?
- Duplicate hash ve row-level duplicate kurallari banka bazli ozellesecek mi?

## 10. V3 PR Kabul Kontrol Listesi

Her V3 degisikligi asagidaki kontrollerden gecmelidir:

- Cekirdek V1/V2 modellerde rename/drop yok.
- Migration additive ve geriye uyumlu.
- Yeni veri modeli `userId` ve auth mantigina uygun.
- Soft delete gereken kayitlarda `deletedAt` var.
- Normal liste, dashboard ve rapor sorgularinda `deletedAt: null` korunuyor.
- Kritik mutation audit log yaziyor.
- Client componentlere non-serializable veri gonderilmiyor.
- Hydration riski olusturacak browser-only API ilk render'da kullanilmiyor.
- Belgeler public klasore yazilmiyor.
- Export/backup ekranlari hassas veri uyarisi koruyor.
- PWA manifest/service worker/install akisina zarar verilmiyor.
- `npm run typecheck`, `npm run lint`, `npm run build` basarili.

## 11. Referans Dosyalar

- `prisma/schema.prisma`
- `src/app/**`
- `src/lib/**`
- `src/middleware.ts`
- `public/app.webmanifest`
- `public/manifest.json`
- `public/sw.js`
- `docs/V3_PRODUCT_SPEC.md`
- `docs/V3_TEST_REPORT.md`
