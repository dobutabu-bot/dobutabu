# V3 Bilinen Sınırlamalar

Bu sınırlamalar bilinçli ürün kararlarıdır; release'i engellemez ama kullanıcıya ve operasyona açıkça anlatılmalıdır.

## Entegrasyonlar

- GİB, e-SMM, e-Fatura, Paraşüt, Logo, Mikro ve banka API entegrasyonu yoktur.
- Banka ekstresi importu CSV/XLSX önceliklidir. PDF banka ekstreleri bankadan bankaya değiştiği için düşük güvenli fallback olarak ele alınır.
- Canlı döviz, altın, borsa veya crypto fiyat sağlayıcısı yoktur. Sermaye merkezi manuel değerleme ile çalışır.
- Sistem yatırım tavsiyesi vermez; yalnızca kayıt, sınıflandırma ve görselleştirme yapar.

## OCR ve Belge İşleme

- Image OCR opsiyonel worker hattıdır ve varsayılan olarak PNG/JPEG için tasarlanmıştır.
- Taranmış PDF OCR aktif değildir. PDF görsele dönüştürme entegrasyonu ileride eklenecek ayrı bir konudur.
- AV/CDR sağlayıcısı interface düzeyinde bırakılmıştır; varsayılan local geliştirmede devre dışıdır.
- Extracted text hassas veri kabul edilir ve yalnız auth olan kullanıcı tarafından görülmelidir.

## Storage ve Backup

- Belgeler `public/` altında tutulmaz; private storage kökü varsayılan olarak `./storage/documents` olur.
- JSON/CSV export belge metadata'sını içerir; fiziksel belge dosyaları ayrıca yedeklenmelidir.
- Production'da document storage için persistent volume, NAS veya S3 benzeri adapter gerekir.
- SQLite tek kullanıcı/VPS için uygundur; serverless/ephemeral filesystem ortamlarında PostgreSQL gibi kalıcı veritabanı kullanılmalıdır.

## PWA ve Bildirimler

- Tarayıcı bildirimleri kullanıcı iznine ve production'da HTTPS'e bağlıdır.
- Uygulama kapalıyken kesin bildirim için ileride push, email veya cron/scheduled function gerekir.
- Service worker app shell/offline fallback sağlar; offline veri yazma ilk sürümde garanti edilmez.

## Test ve Operasyon

- Playwright derin veri değiştiren servis testleri yalnız `chromium-desktop` projesinde koşar; diğer projeler route, responsive, PWA ve runtime gate olarak kullanılır.
- Yerel makinede Docker CLI yoksa Docker smoke koşulamaz. CI/staging üzerinde `docker compose config` ve `docker build` çalıştırılmalıdır.
- Büyük PDF raporlar ve büyük banka importları için production timeout, reverse proxy body size ve persistent volume ayarları gerçek veriyle ayrıca izlenmelidir.

## Güvenlik Notları

- Private document download/preview route'ları auth kontrollüdür; direct filesystem path kullanıcıya gösterilmez.
- Backup dosyaları kişisel veri, müvekkil bilgisi, finansal veri ve belge metadata'sı içerebilir.
- Gizlilik modu ekran paylaşımı için yardımcıdır; veri güvenliği yerine geçmez.
