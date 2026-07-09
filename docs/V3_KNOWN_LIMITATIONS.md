# V3 Bilinen Sınırlamalar

Bu bölüm bir “eksikler listesi” değil; V3-RC1’in güvenilir, denetlenebilir ve doğru kapsamda kullanılabilmesi için bilinçli olarak çizilen ürün sınırlarını açıklar. Amaç kullanıcının uygulamaya ne zaman güvenebileceğini, hangi işlemleri ayrıca yetkili sistemlerde yapması gerektiğini ve production kullanımında hangi operasyon koşullarının şart olduğunu netleştirmektir.

## Şeffaf Kullanım Notları

| # | Sınırlama | Kullanıcı için anlamı |
|---:|---|---|
| 1 | Sistem resmi e-SMM/e-Fatura kesmez. | Makbuz/fatura ekranı takip ve raporlama içindir; resmi belge düzenleme yetkili e-belge sisteminde yapılmalıdır. |
| 2 | GİB entegrasyonu yoktur. | GİB’e gönderim, iptal veya resmi doğrulama işlemleri uygulama dışındaki yetkili sistemlerden yürütülmelidir. |
| 3 | Paraşüt, Logo ve Mikro entegrasyonu yoktur. | İlk sürüm manuel kayıt, CSV/Excel import-export, raporlama ve denetim izi odaklıdır. |
| 4 | Banka API bağlantısı yoktur. | Banka hareketleri dosya yükleme yoluyla analiz edilir; banka hesabına canlı bağlantı kurulmaz. |
| 5 | CSV/XLSX banka ekstresi önerilir. | Kolon eşleme, decimal format, duplicate kontrolü ve analiz sonuçları CSV/XLSX dosyalarında daha güvenilirdir. |
| 6 | Banka PDF import düşük güvenli fallback’tir. | Banka PDF formatları farklı olduğu için sistem her PDF tablo yapısını kesin ayrıştıramayabilir. |
| 7 | Taranmış PDF OCR aktif değilse otomatik okuma yapılamayabilir. | Seçilebilir metin içermeyen veya görüntü tabanlı PDF’lerde kullanıcı manuel metadata girebilir; görsel OCR ayrı/opsiyonel hattır. |
| 8 | Canlı borsa, crypto, döviz veya altın fiyatı çekilmez. | Sermaye ekranındaki değerler kullanıcı tarafından manuel girilir ve güncellenir. |
| 9 | Sermaye ekranı yatırım tavsiyesi vermez. | Ekran yalnızca kişisel/mesleki varlık takibi, kayıt ve görselleştirme amacıyla kullanılır. |
| 10 | Offline veri yazma garanti edilmez. | PWA shell, ikonlar ve offline uyarı desteklenir; ancak çevrim dışıyken yeni kayıt oluşturmanın kalıcı yazılması garanti değildir. |
| 11 | Production kullanım için HTTPS, güçlü şifre/secret, persistent storage ve düzenli backup gerekir. | Güvenli canlı kullanım için `AUTH_SECRET`, güçlü kullanıcı parolası, kalıcı database/storage ve yedekleme planı zorunludur. |

## Neden Böyle?

Bu sınırlar V3-RC1’i daha güvenilir kılar:

- Resmi belge ve GİB işlemleri yanlışlıkla “tamamlandı” sanılmaz.
- Banka verisi kullanıcı onayı olmadan finans kaydına dönüşmez.
- PDF ve OCR gibi format riski yüksek alanlarda sistem aşırı iddialı davranmaz.
- Sermaye ekranı finansal karar yönlendirmez; yalnız kayıt ve analiz desteği sunar.
- Production koşulları açık olduğu için veri kaybı, gizlilik ve erişim riskleri azaltılır.

## Kullanıcıya Gösterilen Yerler

- `/settings/system-status`: Sistem sağlığı ve bilinen sınırlamalar bölümü.
- `/install`: PWA kurulum yönergeleri yanında “Şeffaf Kullanım Notları”.
- Bu doküman: `docs/V3_KNOWN_LIMITATIONS.md`.

## Operasyon Notları

- Gerçek production kullanımından önce `docs/V3_BACKUP_RESTORE_DRILL.md` ve `docs/V3_DOCKER_STAGING_SMOKE_TEST.md` gözden geçirilmelidir.
- Banka PDF importlarında düşük güven uyarısı kullanıcıya açıkça gösterilmelidir.
- CSV/XLSX import, yedekleme ve restore dry-run düzenli aralıklarla test edilmelidir.
- Gizlilik modu ekran paylaşımı için yardımcıdır; auth, private storage ve backup güvenliği yerine geçmez.
