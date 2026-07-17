# V5.0.1 PDF Test Matrisi

## PDF route envanteri

| Rapor | Route | Yerel renderer/API |
|---|---|---|
| Aylık finans | `/api/reports/monthly/pdf` | PASS |
| Kasa | `/api/reports/cash/pdf` | PASS |
| Belge | `/api/reports/documents/pdf` | PASS |
| Banka ekstreleri | `/api/reports/bank-statements/pdf` | PASS |
| Mutabakat | `/api/reports/reconciliation/pdf` | PASS |
| Sermaye | `/api/reports/capital/pdf` | PASS |
| Avans | `/api/reports/advances/pdf` | PASS |
| Müvekkil cari | `/api/reports/client/[id]/pdf` | PASS |
| Dosya finans | `/api/reports/case/[id]/pdf` | PASS |
| Tahsilat özeti | `/api/reports/collections/[id]/pdf` | PASS |
| Gider özeti | `/api/reports/expenses/[id]/pdf` | PASS |
| Banka analizi | `/api/reports/bank-analysis/[id]/pdf` | PASS |

## Zorunlu doğrulamalar

Her route için aşağıdakiler birlikte aranır:

- auth olmayan isteğe `401`
- auth olan isteğe `200`
- `Content-Type: application/pdf`
- tarihli `.pdf` attachment dosya adı
- `Cache-Control: private, no-store`
- `%PDF-` imzası
- 1.500 bayttan büyük içerik
- PDF metninin başarıyla ayrıştırılması
- gerçek tarayıcı download olayı
- console error olmaması

## Tarayıcı matrisi

`tests/e2e/v501-pdf-downloads.spec.ts` Chromium, Firefox, WebKit/Safari ve iPhone profillerinde gerçek link tıklamasıyla 12 raporu indirir. Test kayıtları yalnız `PDF-SMOKE-TEST-*` marker'ı taşır ve test sonunda soft delete edilir.

| Hedef | Yerel | Staging | Production |
|---|---|---|---|
| Chromium | Bekliyor | Bekliyor | Bekliyor |
| Firefox | Bekliyor | Bekliyor | Bekliyor |
| WebKit/Safari | Bekliyor | Bekliyor | Bekliyor |
| iPhone profili | Bekliyor | Bekliyor | Bekliyor |

Bu tablo deploy kanıtları geldikçe güncellenecektir. HTTP 200 tek başına PASS sayılmaz.

## Paralel regresyon izolasyonu

Uzun CRUD tarayıcı senaryoları her Playwright projesinde benzersiz marker ile çalışır. Test başlangıcında genel marker önekine göre toplu temizlik yapılmaz; böylece paralel Chromium/Firefox/WebKit projeleri birbirinin devam eden fixture kayıtlarını silemez. Her senaryo yalnız kendi marker kayıtlarını `finally` aşamasında temizler.

## WebKit bildirim isteği stabilizasyonu

WebKit PDF matrisi sırasında 12 PDF'nin tamamı indirilip ayrıştırıldığı halde, her tam sayfa yüklenişinde yeniden başlayan `/api/reminders/due` isteği sonraki navigasyonda Safari tarafından erişim kontrolü hatası olarak raporlanıyordu. Bildirim yöneticisi artık sunucudan gelen ilk veriyi kullanır, periyodik kontrolü korur ve anlık yenilemeyi yalnız dashboard'da gecikmeli ve iptal edilebilir biçimde yapar. Auth, PDF route'ları ve console-error kabul kriteri gevşetilmemiştir.

Yerel hedefli doğrulama:

- `npx playwright test tests/e2e/v501-pdf-downloads.spec.ts --project=webkit-desktop --reporter=line`: **PASS (1/1)**
- 12 gerçek download olayı, PDF imzası, boyut ve metin ayrıştırması: **PASS**
- WebKit console error: **0**

## CI çalışma yükü izolasyonu

GitHub runner üzerinde farklı tarayıcı projeleri ve iki uzun, yazma ağırlıklı CRUD senaryosu aynı Next.js sunucusu ile SQLite dosyasını eşzamanlı kullanınca ilk denemelerde kaynak yarışları oluşabiliyordu. CI artık test kapsamını eksiltmeden proje bazlı matris çalıştırır:

1. Chromium desktop/laptop, Firefox, WebKit/Safari, tablet, iPhone ve Android projelerinin her biri ayrı runner, ayrı SQLite test veritabanı ve ayrı Next.js sunucusu kullanır.
2. Her projede PDF, responsive, güvenlik ve feature testleri tek worker ile çalışır.
3. Aynı projede `final-action-runtime.spec.ts` ile `crud-runtime-verification.spec.ts` daha sonra tek worker ile çalışır.
4. Typecheck, lint, build, unit/service testleri ve Docker font smoke ayrı kalite job'ında çalışır.

Assertion, retry ve tarayıcı kapsamı değiştirilmemiştir. Yerel eşzamanlı doğrulamalar:

- Chromium iki ağır CRUD dosyası, `--workers=2`: **PASS (2/2)**
- WebKit ağır CRUD + responsive matrisi, `--workers=2`: **PASS (79/79)**

## Tablet dokunmatik hedef düzeltmesi

V2 tablet smoke kontrolü eski liste filtrelerinde 40px kalan `Filtrele` aksiyonunu tespit etti. Tahsilat, gider, dosya, makbuz, işlem geçmişi ve kasa hareketleri filtre/temizleme aksiyonları ortak minimum 44px standardına getirildi. Test eşiği değiştirilmedi.

- `npx playwright test tests/e2e/v2-cross-browser.spec.ts --project=tablet --grep "login, protected routes" --workers=1 --retries=0 --reporter=line`: **PASS (1/1)**
