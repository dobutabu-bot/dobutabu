# V5.0.1 Staging PDF Blocker Onarımı

Tarih: 18.07.2026

## Kapsam

- Production ortamı, production veritabanı ve production volume'u değiştirilmedi.
- `main` branch birleştirilmedi; production tag veya production deployment oluşturulmadı.
- Rollback baseline `4cc1b06` olarak korundu.
- Çalışma yalnız `hotfix/v5.0.1-pdf-stability` branch'i ve `staging-v501-pdf` ortamında yürütüldü.

## Staging Kanıtı

| Alan | Değer |
| --- | --- |
| URL | `https://dobutabu-staging-v501-pdf.up.railway.app` |
| Branch | `hotfix/v5.0.1-pdf-stability` |
| Uygulama commit'i | `2c28a7c1f01c658b6c486cea9a2d5cc8725b7a1f` |
| Railway deployment | `c91c7b48-84cd-4fb0-8564-f7ac42c6faba` |
| Deployment durumu | `SUCCESS` |
| Health | `ok:true`, database `ok`, storage `ok`, environment `staging` |

Railway deployment metadata'sında branch ve commit SHA doğrulandı. Build Dockerfile
ile tamamlandı; `/api/health` healthcheck ve `/data` staging volume'u korundu.

## Kapatılan Blocker'lar

1. Ortak `PdfDownloadButton` ve `usePdfDownload` remote hotfix branch'ine alındı.
2. Müvekkil üç nokta aksiyon menüsüne gerçek `PDF indir` aksiyonu eklendi.
3. PDF başarı/hata akışları gerçek browser download olayıyla doğrulandı.
4. Toast event listener hydration yarışı deterministik readiness işaretiyle kapatıldı.
5. Streaming sayfalarda ve aksiyon menüsünde React event bağlanmadan test tıklaması yapılmasını önleyen readiness işaretleri eklendi.
6. Full regresyon testindeki belge upload URL beklemesi `/documents/new` adresini yanlış başarı kabul etmeyecek şekilde düzeltildi.
7. Silinen gider tablosu açıklama göstermediği için restore fixture seçicisi tabloda gerçekten görünen benzersiz müvekkil adına bağlandı.

## Test Beklentisi Düzeltmeleri

Testler gevşetilmedi. Aşağıdaki durumlar gerçek hata cevabı değil, route değişiminde
browser/Next.js tarafından iptal edilen eski GET istekleri olarak dar kapsamda
sınıflandırıldı:

- exact `ERR_ABORTED`/`cancelled` olan Next statik chunk isteği,
- `_rsc` parametreli superseded GET isteği,
- `/api/reminders/due` yardımcı GET poll isteği.

HTTP 4xx/5xx, PDF, auth, upload ve diğer ağ hataları testi düşürmeye devam eder.

## Yerel Production Build Matrisi

| Motor | Kritik route | Gerçek PDF download/parse |
| --- | --- | --- |
| Chromium | PASS | PASS |
| Firefox | PASS | PASS |
| WebKit | PASS | PASS |
| iPhone | PASS | PASS |
| Android | PASS | PASS |

Chromium üzerinde gerçek create/edit/delete/restore, ledger, belge upload ve PDF
akışını içeren yazma regresyonu da PASS oldu. Fixture kayıtları test sonunda
soft-delete cleanup sürecinden geçirildi.

## Public Staging Matrisi

| Motor | Kritik route | Gerçek PDF download/parse | Sonuç |
| --- | --- | --- | --- |
| Chromium | PASS | PASS | 4 PASS, 1 production-write koruma skip |
| Firefox | PASS | PASS | 2 PASS, 3 beklenen motor-scope skip |
| WebKit | PASS | PASS | 2 PASS, 3 beklenen motor-scope skip |
| iPhone | PASS | PASS | 2 PASS, 3 beklenen motor-scope skip |
| Android | PASS | PASS | 2 PASS, 3 beklenen motor-scope skip |

Firefox'un deployment hemen sonrasındaki ilk koşusunda banka ekstreleri chunk'ı
bir kez yüklenemedi. Aynı chunk URL'si ayrıca `HTTP 200`, doğru JavaScript MIME
ve immutable cache header'larıyla doğrulandı; aynı commit üzerinde testi
değiştirmeden yapılan yeniden koşu tamamen PASS oldu.

## Kalite Sonucu

- Prisma generate: PASS
- Typecheck: PASS
- Lint: PASS
- Production build: PASS, 81/81 route
- Unit/service tests: PASS
- Chromium PDF ve kritik route: PASS
- Firefox/WebKit/iPhone/Android PDF ve kritik route: PASS

## 18 Temmuz Toast Kontratı Build Onarımı

Railway'in `2f508a94e8feb489a7ce98ecfcba0663547380d0` commit'i için başlattığı temiz
build, `use-pdf-download.ts` içindeki iki parametreli `showToast` çağrısının aynı
commit'teki tek parametreli ortak toast kontratıyla uyuşmaması nedeniyle typecheck
aşamasında durdu. PDF, auth veya veri iş mantığı değiştirilmeden iki çağrı ortak
kontrata uyarlandı.

Düzeltme commit'i: `36271de357688e0733716a0974f765f1882e3bcd`.

Düzeltme sonrası yerel doğrulama:

- Prisma generate: PASS
- Typecheck: PASS
- Lint: PASS
- Production build: PASS
- Unit/service tests: 105 PASS, 0 FAIL, 2 beklenen entegrasyon skip
- Chromium gerçek PDF ve kritik route E2E: 7 PASS

## Karar

Staging PDF blocker'ları kapatıldı. Bu rapor production GO kararı değildir.
Aşama 14, production backup/rollback/CI/release kapıları ayrıca ve açık kullanıcı
talimatıyla yürütülene kadar production ortamı dondurulmuş kalır.
