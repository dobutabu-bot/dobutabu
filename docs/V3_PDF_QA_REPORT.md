# V3-RC1 PDF Çıktı Kalite Kontrol Raporu

Bu rapor V3-RC1 kapsamındaki PDF çıktıların üretim, güvenlik, dosya adı, format ve uzun tablo davranışını doğrular.

## Kapsam

Kontrol edilen PDF türleri:

- Müvekkil cari raporu
- Dosya finans raporu
- Tahsilat özeti
- Gider özeti
- Aylık finans raporu
- Kasa raporu
- Banka ekstresi analiz raporu
- Mutabakat raporu
- Sermaye raporu

## Otomatik Test

Test dosyası:

- `tests/pdf-qa.test.ts`

Test edilen başlıklar:

1. PDF `%PDF` imzası ile oluşuyor.
2. PDF boyutu boş dosya sınırının üzerinde.
3. Türkçe başlıklar ve örnek Türkçe karakterli içerik metinden okunabiliyor.
4. Para formatı `TL`/TRY biçimiyle üretiliyor.
5. Tarih formatı Türkiye formatıyla veya tarihli dosya adıyla doğrulanıyor.
6. Uzun tablo için 180 satırlı anonim PDF oluşturuluyor.
7. Mobil Safari/Chrome indirme davranışı için `Content-Disposition: attachment`, `Content-Type: application/pdf`, `Cache-Control: private, no-store` başlıkları doğrulanıyor.
8. Auth olmayan kullanıcı her PDF route’unda 401 alıyor.
9. Dosya adları anlamlı prefix ve tarih içeriyor.
10. Büyük rapor üretimi timeout olmadan tamamlanıyor.
11. Silinen kayıtlar PDF metnine dahil edilmiyor.

## Üretilen Örnekler

Anonim test PDF örnekleri `fixtures/generated-pdfs/` altında oluşturulur:

- `long-table-quality.pdf`
- `muvekkil-cari.pdf`
- `dosya-finans.pdf`
- `tahsilat-ozet.pdf`
- `gider-ozet.pdf`
- `aylik-finans.pdf`
- `kasa-hareketleri.pdf`
- `banka-ekstresi-analiz.pdf`
- `mutabakat-raporu.pdf`
- `sermaye-varlik.pdf`

Bu dosyalar gerçek müvekkil verisi içermez; test sırasında oluşturulan anonim kayıtlarla üretilir.

## Gizlilik Modu Kararı

PDF çıktılara gizlilik modu uygulanmamalıdır.

Gerekçe:

- PDF çıktılar arşiv, rapor, mutabakat ve paylaşılabilir kayıt niteliğindedir.
- Tutarları maskelemek, raporun hukuki/finansal anlamını bozabilir.
- Gizlilik modu ekran paylaşımı ve canlı UI kullanımı içindir.
- PDF indirme bilinçli kullanıcı aksiyonudur ve private auth route üzerinden yapılır.

Güvenlik karşılığı:

- PDF route’ları auth kontrollüdür.
- `Cache-Control: private, no-store` kullanılır.
- Dosyalar attachment olarak indirilir.
- Hassas veri içeren PDF’lerin güvenli saklanması kullanıcıya dokümante edilmelidir.

## Görsel Kontrol Notu

Poppler `pdfinfo/pdftoppm` bu ortamda yüklü olmadığı için otomatik PNG render kontrolü çalıştırılamadı. Bunun yerine RC1 otomasyonu PDF imzası, dosya boyutu, metin çıkarımı, başlıklar, tarihli dosya adı, auth ve uzun tablo üretimini doğrular. Poppler kurulu bir CI ortamında ek görsel render testi eklenebilir.

## Çalıştırma

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## RC1 Test Sonucu

7 Temmuz 2026 tarihinde çalıştırılan son kontrolde:

- `tests/pdf-qa.test.ts`: 11/11 geçti, skip yok.
- `npm run test`: 54/54 geçti, skip yok.
- `npm run typecheck`: geçti.
- `npm run lint`: geçti.
- `npm run build`: geçti.

Build sonrası dev server’ın `.next` çıktısı yenilendiği için uygulamanın `http://localhost:3010` üzerinde tekrar başlatılması gerekir; testlerde PDF route’ları çalışan dev server üzerinden doğrulanmıştır.
