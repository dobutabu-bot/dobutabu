# PRD: Hukuk Burosu Finans Takip Paneli

## 1. Uygulamanin Amaci

Bu uygulama, tek avukatin kendi hukuk burosu finansini mobil uyumlu bir panelden takip etmesini saglar. Temel amac; muvekkil ve dosya bazli tahsilat, gider, masraf avansi, alacak/borc ve bakiye takibini sade, dusuk maliyetli ve manuel kayit odakli bir sistemle yonetmektir.

Ilk surumde GIB, e-SMM, banka API, Parasut, Logo, Mikro veya benzeri muhasebe/ERP entegrasyonlari olmayacaktir. Bunlarin yerine manuel kayit, CSV import/export, Excel uyumlu cikti ve raporlama kullanilacaktir.

## 2. Kullanici Profili

- Tek kullanici: hukuk burosu sahibi avukat.
- Teknik beklenti: telefondan hizli veri girebilmek, masaustunden rapor alabilmek.
- Finansal beklenti: hangi muvekkilden ne kadar tahsil edildi, hangi dosyada ne kadar masraf var, ne kadar alacak var, hangi giderler yaklasiyor, yatirim icin ayrilabilecek nakit ne kadar gibi sorulara hizli cevap almak.

## 3. MVP Kapsami

- Tek kullanici girisi.
- Dashboard uzerinden gunluk, aylik ve yillik finans ozeti.
- Muvekkil kaydi ve aktif/pasif durum takibi.
- Dosya kaydi, dosya durumu ve beklenen ucret takibi.
- Tahsilat kaydi: tarih, tutar, odeme yontemi, muvekkil, dosya, makbuz no.
- Gider kaydi: kategori, tarih, tutar, muvekkil/dosya baglantisi.
- Masraf avansi kaydi: alinan avans ve harcanan avans.
- Alacak/borc takibi: vade, durum, tutar, muvekkil ve dosya baglantisi.
- Makbuz/fatura takip ekrani: manuel belge numarasi, tutar, durum, vade.
- Sermaye ve nakit durumu ozeti.
- KDV kontrol paneli: tahmini hesaplanan KDV, indirilecek KDV ve net KDV pozisyonu icin manuel takip.
- Kredi karti borcu ve odeme planlari takibi.
- Elektrik, su, internet, kira, aidat, personel, vergi, harc, posta, noter gibi kategorize gider takibi.
- Potansiyel alacaklar: beklenen vekalet ucreti, dosya bazli tahmini tahsilat.
- Yatirim yapilabilir tutar: mevcut nakit, yakin vade borclar ve guvenlik payi dusulerek hesaplanan tahmini serbest nakit.
- CSV/Excel export.
- JSON ve SQLite yedek alma.
- PWA davranisi ve mobil uyumlu arayuz.

## 4. MVP Disi Birakilan Ozellikler

- GIB entegrasyonu.
- e-SMM ve e-Fatura entegrasyonu.
- Banka API ile otomatik hareket cekme.
- Parasut, Logo, Mikro veya ERP entegrasyonu.
- Otomatik muhasebe fisleri.
- Cok kullanici, rol ve yetki yonetimi.
- Cloud senkronizasyonu.
- Resmi belge duzenleme ve mali muhurlu imzalama.
- Otomatik kredi karti ekstresi okuma.
- Banka mutabakati.
- Gelismis vergi beyannamesi uretimi.

## 5. Veri Modeli

Ana varliklar:

- User: tek kullanici giris bilgileri.
- Settings: buro adi, avukat adi, para birimi, guvenlik payi gibi genel ayarlar.
- Client: muvekkil bilgileri.
- CaseFile: dosya bilgileri, durum, beklenen ucret.
- Collection: tahsilatlar.
- Expense: giderler ve fatura kategorileri.
- Advance: masraf avansi giris/cikis hareketleri.
- BalanceEntry: alacak ve borc kayitlari.
- ReceiptRecord: makbuz/fatura/e-SMM takip kayitlari.
- CapitalEntry: avukatin sermaye ve nakit hareketleri.
- TaxSummary: manuel KDV kontrol kayitlari.
- CreditCardDebt: kredi karti borclari, son odeme tarihi ve durum.
- PotentialReceivable: tahmini/potansiyel alacak kayitlari.

Onemli iliskiler:

- Bir muvekkilin birden fazla dosyasi olabilir.
- Tahsilat, gider, avans, bakiye ve belge kayitlari muvekkile; opsiyonel olarak dosyaya baglanabilir.
- Kategorize giderler raporlamada aylik/yillik nakit akisi ve yatirim yapilabilir tutar hesaplarinda kullanilir.

## 6. Ekran Listesi

- Login
- Dashboard
- Muvekkiller
- Dosyalar
- Tahsilatlar
- Giderler
- Masraf Avanslari
- Alacak/Borc
- Makbuz/Fatura Takibi
- Sermaye ve Nakit Durumu
- KDV Kontrol Paneli
- Kredi Karti Borclari
- Potansiyel Alacaklar
- Raporlar
- CSV/Excel Import-Export
- Yedekleme
- Ayarlar

## 7. Kullanici Akislari

1. Avukat sisteme giris yapar.
2. Yeni muvekkil olusturur.
3. Muvekkile bagli dosya acar.
4. Dosya icin beklenen ucret, masraf avansi veya potansiyel alacak girer.
5. Tahsilat yapildiginda manuel tahsilat kaydi ekler.
6. Dosya veya buro gideri olustugunda kategori secerek gider kaydi ekler.
7. Kredi karti borcu, fatura gideri veya vergi odemesi icin vade/durum takibi yapar.
8. Dashboard uzerinden net nakit, acik alacak, acik borc, KDV durumu ve yatirim yapilabilir tutari gorur.
9. Ay sonunda CSV/Excel rapor alir.
10. Belirli araliklarla JSON veya SQLite yedegi indirir.

## 8. Guvenlik Notlari

- Ilk surum tek kullanicili olacaktir.
- Sifre hashlenerek saklanmalidir.
- Session cookie `HttpOnly`, `SameSite=Lax` ve production ortaminda `Secure` olmalidir.
- `.env` dosyasi repoya dahil edilmemelidir.
- SQLite dosyasi ve yedekler hassas veri icerir; kullanici tarafindan guvenli klasorde saklanmalidir.
- Yedek dosyalari sifrelenmeden e-posta veya ortak bulut klasorlerine yuklenmemelidir.
- Uygulama internete acilacaksa HTTPS, guclu `SESSION_SECRET` ve guclu admin sifresi zorunlu olmalidir.

## 9. Gelecekte Eklenebilecek Ozellikler

- CSV import sihirbazi.
- Banka ekstresi yukleme ve manuel eslestirme.
- Kredi karti ekstresi import.
- GIB/e-SMM/e-Fatura entegrasyonu.
- Parasut, Logo, Mikro entegrasyonlari.
- Gelismis KDV ve stopaj raporlari.
- Nakit akisi tahmini.
- Dosya karlilik analizi.
- Muvekkil bazli risk skoru.
- Otomatik vade hatirlaticilari.
- PDF rapor ciktilari.
- Sifreli yedekleme.
- Lokal ag uzerinden guvenli erisim.
- Cok kullanici ve rol bazli yetkilendirme.
