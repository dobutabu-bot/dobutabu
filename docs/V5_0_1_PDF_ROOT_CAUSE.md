# V5.0.1 PDF Hotfix Kök Neden Raporu

## Durum

P0 hata yeniden üretildi. Production'daki ortak PDF route'ları HTTP 500 dönüyordu.

## Kök neden

PDFKit Türkçe karakterler için Unicode TTF gerektiriyor. Railway runner imajı Alpine Linux tabanlıydı ancak imajda font paketi yoktu. Renderer yalnız macOS ve Debian font yollarını aradığı için Railway'de şu kontrollü hata oluşuyordu:

`PDF fontu bulunamadı. Türkçe karakter desteği için PDF_FONT_PATH ile bir TTF font yolu tanımlayın.`

Hata aylık finans, kasa, belge, banka, mutabakat, sermaye, avans ve detay PDF route'larının tamamında aynı ortak renderer'da oluştu. Auth veya rapor verisi hatası değildi.

## Minimal düzeltme

- Docker runner'a Alpine `font-dejavu` paketi eklendi.
- Renderer, Alpine paketinin gerçek `/usr/share/fonts/dejavu` dizinini ve diğer yaygın font yollarını güvenli fallback listesine aldı.
- Docker runner, doğrulanmış düzenli ve kalın font yollarını `PDF_FONT_PATH` değişkenleriyle açıkça tanımlıyor.
- PDF response artık `%PDF-` imzasını ve minimum anlamlı dosya boyutunu doğruluyor.
- HTML hata gövdesinin `.pdf` uzantısıyla indirilmesini engelleyen regresyon testi eklendi.

Finans sorguları, veri modeli, auth, route sözleşmeleri ve kullanıcı kayıtları değiştirilmedi.

## Kanıt

- Production baseline: ortak PDF route'larında 500 ve Railway logunda yukarıdaki font hatası.
- Yerel ortak renderer: uzun Türkçe rapor, imza, boyut ve metin ayrıştırma PASS.
- Yerel 12 route matrisi: geçerli fixture ile 12/12 PASS.
- Container font kontrolü CI kalite kapısına eklendi.

Production sonucu staging ve production deploy sonrasında ayrıca kaydedilecektir.
