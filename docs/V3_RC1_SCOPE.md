# V3-RC1 Kapsam ve Stabilizasyon Planı

Tarih: 2026-07-07  
Sürüm etiketi: V3-RC1  
Paket versiyonu: 3.0.0-rc.1  
Durum: Yayın adayı stabilizasyon fazı

## Faz Kuralı

V3 özellik geliştirme fazı kapatılmıştır. Bu noktadan sonra yeni özellik eklenmez. Çalışma yalnızca hata düzeltme, test, güvenlik sertleştirmesi, performans iyileştirmesi, dokümantasyon, staging ve release hazırlığı ile sınırlıdır.

Mevcut V1/V2/V3 omurgası korunacaktır. Müvekkil, dosya, tahsilat, gider, makbuz/fatura, dijital kasa, soft delete, audit log, dashboard, raporlar, hatırlatmalar, belge merkezi, banka import, mutabakat ve sermaye merkezi akışları rename/drop/refactor bahanesiyle kırılmayacaktır.

## Tamamlanan Özellikler

- V1/V2 finans çekirdeği
- Tek kullanıcı auth, session ve güvenli login/logout
- Müvekkil yönetimi
- Dosya yönetimi
- Tahsilat yönetimi
- Gider yönetimi
- Makbuz/fatura takip ekranı
- Soft delete ve geri alma altyapısı
- Audit log ve işlem geçmişi
- Dijital kasa
- Kasa hesapları
- Kasa hareketleri
- Kasa transferi ve manuel düzeltme
- Tahsilat/gider kasa ledger senkronu
- Premium V2/V3 dashboard
- Grafik odaklı raporlar
- Hatırlatma sistemi
- Uygulama içi bildirim merkezi
- PWA manifest, service worker ve install sayfası
- Private belge merkezi
- PDF, görsel, CSV ve XLSX belge yükleme
- Auth kontrollü belge preview/download
- Belgeyi müvekkil, dosya, tahsilat, gider, makbuz/fatura ve kasa hareketine bağlama
- Belgesiz finans kaydı tespiti
- Server-side PDF çıktı altyapısı
- Belge metin çıkarma hattı
- Opsiyonel image OCR worker hattı
- Banka ekstresi import sihirbazı
- CSV/XLSX parser ve kolon eşleme altyapısı
- Son 12 ay banka analizi
- Deterministik kategori ve sınıflandırma kuralları
- Mutabakat motoru
- Banka hareketinden tahsilat/gider oluşturma akışı
- Sermaye/varlık merkezi
- Manuel varlık değerleme
- Mali belge importundan varlık önerisi
- Global akıllı arama
- Gizlilik modu ve tutar masking
- Production dokümantasyonu, backup scriptleri, Docker ve CI hazırlığı

## Bilinen Sınırlamalar

- GİB, e-SMM ve e-Fatura entegrasyonu yoktur.
- Banka API entegrasyonu yoktur.
- Paraşüt, Logo ve Mikro entegrasyonu yoktur.
- Banka PDF import düşük güvenli fallback olarak ele alınır.
- Banka ekstresi için CSV/XLSX formatları önerilir.
- Canlı borsa, crypto, döviz veya altın fiyatı çekilmez.
- Sermaye merkezi ilk sürümde manuel değerleme mantığıyla çalışır.
- Taranmış PDF OCR aktif değildir; PDF OCR için görsele dönüştürme entegrasyonu ileride değerlendirilecektir.
- Image OCR opsiyoneldir ve varsayılan olarak PNG/JPEG için tasarlanmıştır.
- AV/CDR taraması adapter seviyesinde bırakılmıştır; varsayılan local geliştirmede devre dışıdır.
- Offline app shell ve fallback vardır; offline veri yazma garanti edilmez.
- Tarayıcı bildirimi izin, tarayıcı desteği ve production ortamda HTTPS koşullarına bağlıdır.
- Uygulama kapalıyken kesin bildirim için ileride cron, push veya email entegrasyonu gerekir.
- Production için HTTPS, güçlü env değerleri, persistent document storage ve düzenli backup şarttır.
- SQLite tek kullanıcı/VPS senaryosunda kullanılabilir; serverless/ephemeral filesystem ortamlarında PostgreSQL gibi kalıcı veritabanı gerekir.
- Fiziksel belge dosyaları JSON/CSV export içinde yer almaz; ayrıca yedeklenmelidir.
- Docker smoke test yerel makinede Docker CLI yoksa çalıştırılamaz ve CI/staging ortamında doğrulanmalıdır.

## RC1 Release Gate İşleri

1. Kod kalite kapısı:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`

2. E2E ve regresyon kapısı:
   - `npx playwright test`
   - Auth, CRUD, dijital kasa, belge merkezi, banka import, mutabakat, sermaye, raporlar, PWA, mobil ve hydration kontrolleri geçmelidir.

3. Güvenlik kapısı:
   - Auth olmayan belge preview/download erişimi engellenmelidir.
   - Dosyalar `public/` altına yazılmamalıdır.
   - Path traversal, MIME/uzantı/boyut ve duplicate hash kontrolleri doğrulanmalıdır.
   - Production env validation, security headers, secure cookie ayarları ve rate limit kontrolleri gözden geçirilmelidir.

4. Veri bütünlüğü kapısı:
   - Soft delete kayıtları normal listelerde ve raporlarda görünmemelidir.
   - Audit log kritik işlemleri kaydetmelidir.
   - Tahsilat/gider ledger senkronu bozulmamalıdır.
   - Banka hareketinden duplicate finans kaydı oluşmamalıdır.
   - Mutabakat işlemleri kullanıcı onayı olmadan kalıcı eşleme yapmamalıdır.

5. Performans ve mobil kapısı:
   - Dashboard ve rapor chart'ları lazy/skeleton/empty state ile çalışmalıdır.
   - Mobilde yatay taşma olmamalıdır.
   - iPhone, Android, tablet ve desktop route smoke testleri geçmelidir.

6. Production/staging kapısı:
   - `.env.example` güncel kalmalıdır.
   - `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `NODE_ENV`, document storage path ve backup ayarları doğrulanmalıdır.
   - `docker compose config` ve `docker build -t buro-finans-v3-ci .` Docker kurulu CI/staging ortamında geçmelidir.
   - Backup/restore dry run staging ortamında test edilmelidir.

7. Dokümantasyon kapısı:
   - `README.md`
   - `docs/OPERATIONS.md`
   - `docs/V3_RELEASE_GATES.md`
   - `docs/V3_TEST_REPORT.md`
   - `docs/V3_KNOWN_LIMITATIONS.md`
   - `docs/V3_STORAGE.md`
   - `docs/V3_RC1_SCOPE.md`

## RC1 Kapsam Dışı

- Yeni modül veya yeni ürün özelliği eklemek
- Mevcut route isimlerini değiştirmek
- Çekirdek Prisma modellerini rename/drop etmek
- V1/V2 CRUD davranışlarını değiştirmek
- Yeni banka, GİB, muhasebe veya canlı piyasa entegrasyonu eklemek
- Otomatik yatırım yorumu veya yatırım tavsiyesi üretmek

## RC1 Geçme Kriteri

V3-RC1 yalnızca şu koşullarda release adayı kabul edilir:

- Typecheck, lint ve build hatasızdır.
- Playwright release matrix hatasızdır.
- Kritik güvenlik ve veri bütünlüğü kapıları geçmiştir.
- Bilinen sınırlamalar kullanıcı ve operasyon dokümanlarında açıktır.
- Docker/staging gate Docker CLI olan ortamda ayrıca doğrulanmıştır.
