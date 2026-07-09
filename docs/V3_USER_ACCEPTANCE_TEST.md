# V3-RC1 Kullanıcı Kabul Testi

Amaç: Tek avukatın günlük gerçek kullanımını simüle ederek V3-RC1 sürümünün iş akışı, güvenlik, belge, banka, mutabakat, sermaye, rapor ve mobil deneyim açısından kabul edilebilir olduğunu doğrulamak.

Sürüm: V3-RC1 / `3.0.0-rc.1`  
Test tarihi: `____ / ____ / 2026`  
Test eden: `____________________`  
Ortam: `Local / Staging / Production benzeri`  
Tarayıcı: `Chrome / Safari / Firefox / Edge / Mobil Safari / Chrome Android`  
Viewport: `Desktop / Tablet / Mobil`

## Ön Koşullar

- Uygulama çalışıyor olmalı.
- Test kullanıcısı hazır olmalı.
- Private document storage erişilebilir olmalı.
- Test için anonim PDF/JPG/PNG/CSV/XLSX dosyaları hazır olmalı.
- Banka ekstresi CSV fixture dosyası hazır olmalı.
- Gerçek müvekkil, gerçek TC, gerçek IBAN veya gerçek banka verisi kullanılmamalı.

## Test Verisi

| Alan | Kullanılacak değer |
|---|---|
| Kullanıcı e-posta | `avukat@example.com` veya staging kullanıcısı |
| Test müvekkili | `UAT Anonim Müvekkil` |
| Test dosyası | `UAT Tahsilat ve Masraf Takibi` |
| Tahsilat tutarı | `12.500 TRY` |
| Gider tutarı | `2.750 TRY` |
| Döviz varlığı | `USD Test Hesabı` |
| Altın varlığı | `Gram Altın Test` |
| Borç kaydı | `Kredi Kartı Test Borcu` |
| Banka ekstresi | Anonim CSV fixture |
| Dekont dosyası | Test PDF/JPG |
| Fiş dosyası | Test JPG/PNG/PDF |

## Kabul Kriteri

Bu UAT’nin kabul edilebilir sayılması için:

- Kritik akışlar `PASS` olmalı: login, dashboard, müvekkil/dosya/tahsilat/gider, belge yükleme, PDF indirme, banka import, mutabakat, sermaye, logout.
- Hiçbir adımda uygulama çökmesi, beyaz ekran, hydration hatası veya hassas hata mesajı olmamalı.
- Belge dosyaları auth olmadan erişilebilir olmamalı.
- Kullanıcı onayı olmadan banka hareketinden tahsilat/gider veya kalıcı mutabakat oluşmamalı.
- Mobil viewport’ta temel akışlar yatay taşma olmadan tamamlanmalı.

## Checklist

| # | Adım | Beklenen sonuç | PASS/FAIL | Not |
|---:|---|---|---|---|
| 1 | Login ol. | `/login` ekranından geçerli kullanıcıyla giriş yapılır, kullanıcı `/dashboard` ekranına yönlenir. Güvenli olmayan hata detayı gösterilmez. | ☐ PASS / ☐ FAIL | |
| 2 | Dashboard’u aç. | Dashboard V2/V3 kartları, finans ticker, hatırlatmalar, son hareketler ve akıllı uyarılar yüklenir. Para değerleri TRY formatındadır. | ☐ PASS / ☐ FAIL | |
| 3 | Gizlilik modunu aç/kapat. | Göz ikonuyla hassas tutarlar `•••••` olarak maskelenir; tekrar kapatınca değerler görünür. Hydration hatası oluşmaz. | ☐ PASS / ☐ FAIL | |
| 4 | Yeni müvekkil ekle. | `/clients` veya hızlı aksiyon üzerinden yeni müvekkil oluşturulur. Liste ve arama içinde görünür. | ☐ PASS / ☐ FAIL | |
| 5 | Dosya ekle. | `/cases` üzerinden yeni dosya seçilen müvekkile bağlanır. Dosya numarası serbest metin kabul edilir. | ☐ PASS / ☐ FAIL | |
| 6 | Tahsilat ekle. | `/collections?create=1` ile tahsilat oluşturulur. Kasa hesabı seçilebilir veya varsayılan kasa kullanılır. Ledger IN hareketi oluşur. | ☐ PASS / ☐ FAIL | |
| 7 | Tahsilat için dekont yükle. | Tahsilat detayındaki Belgeler bölümünden dekont yüklenir veya `/documents/new?linkedIncomeId=...` ile bağlanır. Belge tahsilatta görünür. | ☐ PASS / ☐ FAIL | |
| 8 | Gider ekle. | `/expenses?create=1` ile gider oluşturulur. Ledger OUT hareketi oluşur ve dashboard/net durum güncellenir. | ☐ PASS / ☐ FAIL | |
| 9 | Gider için fiş yükle. | Gider detayındaki Belgeler bölümünden fiş/dekont yüklenir. Belge gidere bağlı görünür. | ☐ PASS / ☐ FAIL | |
| 10 | Müvekkil cari PDF indir. | Müvekkil detayında `PDF indir` ile PDF alınır. Dosya boş değildir; Türkçe karakter, tarih ve para formatı doğrudur. | ☐ PASS / ☐ FAIL | |
| 11 | Banka ekstresi CSV yükle. | `/bank-statements/import` ekranında CSV yüklenir. Banka adı, kasa hesabı ve para birimi seçilebilir. | ☐ PASS / ☐ FAIL | |
| 12 | Kolon eşleme yap. | Tarih, açıklama, borç/çıkış, alacak/giriş, bakiye kolonları otomatik veya manuel eşlenir. Parse özeti gösterilir. | ☐ PASS / ☐ FAIL | |
| 13 | Banka analizini aç. | `/bank-statements/[id]/analysis` veya `/bank-statements/analysis` ekranında son 12 ay, kategori önerileri, büyük işlemler ve eşleşme durumu görünür. | ☐ PASS / ☐ FAIL | |
| 14 | Bir banka hareketinden tahsilat oluştur. | Banka hareketi modalı otomatik dolar, kullanıcı onayı sonrası Income + CashLedgerEntry oluşur. Aynı satırdan ikinci kayıt oluşturulmaz. | ☐ PASS / ☐ FAIL | |
| 15 | Bir banka hareketinden gider oluştur. | Banka hareketi modalı otomatik dolar, kullanıcı onayı sonrası Expense + CashLedgerEntry oluşur. Rollback/undo akışı uygun şekilde çalışır. | ☐ PASS / ☐ FAIL | |
| 16 | Bir banka hareketini var olan tahsilatla eşleştir. | Öneri veya manuel seçimle eşleşme yapılır. Kullanıcı onayı olmadan kalıcı işlem oluşmaz; onay sonrası link alanları ve audit log güncellenir. | ☐ PASS / ☐ FAIL | |
| 17 | Mutabakat farkını kontrol et. | `/reconciliation` veya `/cash/reconciliation` ekranında banka bakiyesi, sistem bakiyesi, fark, eşleşmiş/eşleşmemiş hareketler görünür. Fark renkleri doğru çalışır. | ☐ PASS / ☐ FAIL | |
| 18 | Sermaye ekranına döviz varlığı ekle. | `/capital/assets?create=1` üzerinden FX türünde varlık eklenir. Toplam varlık ve net sermaye güncellenir. | ☐ PASS / ☐ FAIL | |
| 19 | Altın varlığı ekle. | GOLD türünde varlık eklenir. Miktar, birim fiyat, toplam değer ve değerleme geçmişi doğru görünür. | ☐ PASS / ☐ FAIL | |
| 20 | Borç ekle. | DEBT türünde varlık/borç eklenir. Net sermaye hesabında negatif etki eder; borçlar kırmızı/uyarı tonunda görünür. | ☐ PASS / ☐ FAIL | |
| 21 | Net sermaye raporu PDF indir. | `/api/reports/capital/pdf` üzerinden PDF indirilir. Rapor boş değildir ve “yatırım tavsiyesi değildir” kapsamı korunur. | ☐ PASS / ☐ FAIL | |
| 22 | Belgesiz kayıtları kontrol et. | `/documents/missing` ekranında belgesiz tahsilat/gider/kasa/makbuz kayıtları görünür. Belge gerekmiyor işaretlenen kayıtlar listeden düşer. | ☐ PASS / ☐ FAIL | |
| 23 | Eksik belge yükle. | Belgesiz kayıt için `Belge yükle` veya `Mevcut belgeyi bağla` aksiyonu çalışır. Kayıt eksik belge listesinden düşer. | ☐ PASS / ☐ FAIL | |
| 24 | Raporlar V3 ekranını aç. | `/reports` ekranında V3 belge, banka analizi, mutabakat ve sermaye rapor bölümleri grafik/özetlerle açılır. CSV/PDF aksiyonları görünür. | ☐ PASS / ☐ FAIL | |
| 25 | Mobil viewport’ta aynı temel akışı dene. | Mobilde alt nav, hızlı aksiyon, formlar, tablolar/kartlar ve grafikler taşmadan çalışır. Belge yükleme ve tahsilat/gider ekleme tek elle kullanılabilir. | ☐ PASS / ☐ FAIL | |
| 26 | Logout ol. | Çıkış yapılır, kullanıcı `/login` ekranına döner. Auth gerektiren route’lara tekrar giriş yapmadan erişilemez. | ☐ PASS / ☐ FAIL | |

## Ek Kontrol Alanları

| Kontrol | Beklenen sonuç | PASS/FAIL | Not |
|---|---|---|---|
| Hydration/runtime hata kontrolü | Console’da hydration mismatch veya kritik runtime error yok. | ☐ PASS / ☐ FAIL | |
| Gizli dosya erişimi | Auth olmadan belge preview/download `401` veya login yönlendirmesi döndürür. | ☐ PASS / ☐ FAIL | |
| Eksik fiziksel dosya davranışı | Eksik dosyada uygulama çökmez; kullanıcı dostu 404 mesajı gösterilir. | ☐ PASS / ☐ FAIL | |
| Audit log | Tahsilat/gider/belge/banka/mutabakat/sermaye kritik işlemleri audit log’a yazılır. | ☐ PASS / ☐ FAIL | |
| Soft delete | Silinen kayıtlar normal listelerden düşer; restore altyapısı korunur. | ☐ PASS / ☐ FAIL | |
| Sistem Durumu | `/settings/system-status` database, storage, migration, PWA ve kayıt özetlerini gösterir; secret göstermez. | ☐ PASS / ☐ FAIL | |
| Backup/restore | `npm run backup:v3` ve `restore:v3:dry-run` başarılıdır. | ☐ PASS / ☐ FAIL | |

## Test Sonucu

Genel sonuç:

- ☐ KABUL
- ☐ ŞARTLI KABUL
- ☐ RED

Kritik blocker var mı?

- ☐ Hayır
- ☐ Evet: `____________________________________________________________`

Şartlı kabul notları:

```text
-
-
-
```

Gözlenen hatalar:

| Öncelik | Ekran/Akış | Hata | Beklenen düzeltme | Sahibi |
|---|---|---|---|---|
| P0 / P1 / P2 | | | | |
| P0 / P1 / P2 | | | | |
| P0 / P1 / P2 | | | | |

Onay:

| Rol | İsim | İmza/Tarih |
|---|---|---|
| Test eden avukat | | |
| Teknik kontrol | | |
