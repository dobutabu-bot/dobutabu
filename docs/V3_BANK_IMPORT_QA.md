# V3-RC1 Banka Ekstresi Import Kalite Provası

Bu rapor V3-RC1 stabilizasyon fazında banka ekstresi import hattının CSV/XLSX ağırlıklı ve PDF için düşük güvenli fallback mantığıyla çalıştığını doğrulamak için hazırlanmıştır.

## Fixture Seti

Fixture dosyaları `fixtures/bank-statements/` altında tutulur.

| Fixture | Amaç | Beklenen Sonuç |
| --- | --- | --- |
| `garanti-benzeri.csv` | Standart virgül delimiter, nokta decimal | 3 başarılı satır |
| `is-bankasi-benzeri.csv` | Noktalı tarih, nokta binlik, virgül decimal | 3 başarılı satır |
| `yapi-kredi-benzeri.csv` | Semicolon delimiter, para birimi kolonu | 3 başarılı satır |
| `enpara-benzeri.csv` | Pipe delimiter, eksi/artı kolonları | 3 başarılı satır |
| `ziraat-benzeri.csv` | Valör kolonu, Türkçe açıklamalar | 3 başarılı satır |
| `xlsx-banka-ekstresi.xlsx` | Excel import | 3 başarılı satır |
| `bozuk.csv` | Hatalı CSV satırı | Kullanıcı dostu hata satırı |
| `eksik-kolon.csv` | Eksik/fazla kolon toleransı | 1 başarılı, 1 hatalı satır |
| `virgul-decimal.csv` | Virgül ondalık | 2 başarılı satır |
| `nokta-decimal.csv` | Nokta ondalık | 2 başarılı satır |
| `binlik-ayirici.csv` | Binlik ayırıcı | 2 başarılı satır |
| `duplicate-hareketler.csv` | Aynı hareket satırı | Duplicate raporlanır, tekrar kaydedilmez |
| `pdf-fallback-ekstre.pdf` | PDF fallback | Düşük güven uyarısı ve CSV/XLSX önerisi |

XLSX ve PDF binary fixture dosyaları tekrar üretilebilir şekilde `fixtures/bank-statements/generate-binary-fixtures.mjs` ile hazırlanır.

## Doğrulanan Kurallar

- CSV/XLSX dosyaları server-side parser ile okunur.
- PDF dosyaları düşük güvenli fallback olarak işaretlenir.
- PDF ekranında “CSV veya Excel” formatı önerisi korunur.
- Bozuk veya eksik kolonlu dosyalarda sistem çökmez; hatalı satırlar kullanıcı dostu mesajla raporlanır.
- Import işlemi hiçbir zaman kullanıcı onayı olmadan `Income` veya `Expense` oluşturmaz.
- Duplicate `rowHash` değerli satırlar parse özetinde `duplicateRows` olarak görünür, fakat `BankStatementRow` tablosuna tekrar yazılmaz.
- Aynı dosya ikinci kez kaydedilmek istendiğinde “daha önce içe aktarılmış olabilir” uyarısı döner.

## Test Komutu

```bash
npm run test
```

Bu komut `tests/bank-import-qa.test.ts` dosyasını da çalıştırır. Test izole bir kullanıcı ve kasa hesabı oluşturur, tüm fixture dosyalarını import eder, sonra DB ve private storage kalıntılarını temizler.

## RC1 Test Sonucu

7 Temmuz 2026 tarihinde çalıştırılan son kontrolde:

- `tests/bank-import-qa.test.ts`: 15/15 geçti.
- `npm run test`: 35/35 geçti, skip yok.
- `npm run typecheck`: geçti.
- `npm run lint`: geçti.
- `npm run build`: geçti.

## RC1 Notu

PDF banka ekstreleri bankadan bankaya değişebildiği için V3-RC1’de güvenilir birincil yol CSV veya XLSX importtur. PDF fallback yalnızca metin çıkarılabilen basit dosyalarda düşük güvenli önizleme sağlar; başarısız olursa kullanıcıya CSV/XLSX önerisi gösterilir.
