# V3-RC1 Gerçekçi Anonim Test Veri Seti

Bu veri seti hukuk bürosu finans otomasyonunun V3-RC1 sürümünü demo seed verisinden daha yoğun ve gerçek kullanıma yakın bir hacimle test etmek için hazırlanmıştır.

## Komut

```bash
npm run seed:v3-realistic
```

Script mevcut admin kullanıcısını `.env` içindeki `ADMIN_EMAIL` üzerinden bulur. Kullanıcı yoksa aynı `.env` değerleriyle hash'li bir test kullanıcısı oluşturur.

## Güvenlik ve Anonimlik

- Gerçek kişi adı, gerçek TC kimlik no, gerçek IBAN veya gerçek müvekkil bilgisi kullanılmaz.
- Tüm kayıtlar `V3RC1-REALISTIC` prefix'i ve `V3-RC1 Gerçekçi Test Verisi` marker'ı ile işaretlenir.
- Script tekrar çalıştırıldığında yalnızca kendi ürettiği eski anonim V3 test verisini temizler.
- Belge kayıtları metadata amaçlıdır; fiziksel belge dosyası oluşturmaz.

## Oluşturulan Veri

| Veri türü | Adet | Not |
| --- | ---: | --- |
| Müvekkil | 50 | Bireysel ve şirket karışık, tamamı anonim |
| Dosya | 80 | İcra, alacak, iş, ticari dava, arabuluculuk gibi türler |
| Tahsilat | 250 | Avukatlık ücreti, avans, masraf iadesi |
| Gider | 300 | Harç, noter, UYAP, bilirkişi, kira, SGK, vergi, personel, yazılım |
| Makbuz/Fatura | 120 | Taslak, kesildi, ödendi, ödenmedi ve iptal durumları |
| Kasa hesabı | 8 | Nakit, banka, kredi kartı, sanal ve diğer hesaplar |
| Kasa hareketi | 500 | 250 tahsilat girişi + 250 gider çıkışı |
| Belge metadata | 80 | Dekont, makbuz, fiş, fatura, sözleşme, ekstre, vergi belgesi |
| Banka ekstresi import | 3 | CSV, XLSX ve PDF kaynak türü örnekleri |
| Banka hareketi | 600 | Eşleşmiş, önerilen, eşleşmemiş, duplicate ve hatalı satırlar |
| Sermaye/Varlık | 20 | Nakit, banka, döviz, altın, borsa, crypto, borç ve diğer varlıklar |
| Varlık değerleme | 240 | 20 varlık için 12 aylık manuel değerleme geçmişi |
| Hatırlatma | 50 | Gider, tahsilat, dosya, makbuz/fatura, vergi ve genel türler |
| Audit log | 150 | Oluşturma/güncelleme örnekleri |

## Test Amaçları

- Dashboard ve rapor ekranlarında yüksek veri hacmiyle render ve hesaplama kontrolü.
- Banka ekstresi analizinde eşleşmiş/eşleşmemiş hareketlerin görünmesi.
- Aynı tutarlı ve yakın tarihli hareketlerle mutabakat ambiguity senaryosu.
- Belgesiz tahsilat, gider, kasa hareketi ve makbuz/fatura raporlarının dolması.
- Sermaye ekranında borç, döviz, altın, borsa, crypto ve bağlı kasa varlıklarının birlikte hesaplanması.

## Sınırlamalar

- Belge kayıtları private storage metadata'sı oluşturur; gerçek PDF/JPG dosyası üretmez.
- Banka import kayıtları parser üzerinden değil doğrudan staging tablolarına yazılır; amaç yoğun veri ve UI/rapor testidir.
- Bu veri seti gerçek finansal veya hukuki kayıt değildir; yalnızca anonim test ve görsel doğrulama içindir.

## Son Doğrulama

2026-07-07 tarihinde veri seti `avukat@example.com` kullanıcısı için oluşturuldu ve aşağıdaki kontroller yapıldı:

| Kontrol | Sonuç |
| --- | --- |
| `npm run seed:v3-realistic` | PASS - hedef adetler üretildi |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test` | PASS - 8 finansal invariant testi geçti |
| `/dashboard` | PASS - V3 akıllı merkez, belge, banka, mutabakat ve sermaye özetleri dolu |
| `/reports` | PASS - yoğun tahsilat/gider verisiyle rapor özetleri dolu |
| `/bank-statements` | PASS - 3 import ve 600 banka hareketi görünüyor |
| `/bank-statements/analysis` | PASS - son 12 ay analiz verisi açılıyor |
| `/capital` | PASS - sermaye/varlık özetleri dolu |
| `/documents` | PASS - belge metadata ve filtre listeleri dolu |

Build sonrası açık dev server eski `.next` chunk'ını aradığı için bir kez yeniden başlatıldı. Yeniden başlatma sonrası `http://localhost:3010/dashboard` sağlıklı açıldı.
