# V5 Minimum Veri Girişi

## Durum

`READY_FOR_REVIEW`

V1-V4 CRUD, soft delete, audit log, ledger ve banka mutabakat davranışları korunarak kayıt formları temel ve gelişmiş alanlara ayrıldı. Prisma şeması ve migration geçmişi değiştirilmedi.

## Görünür Alanlar

| Akış | İlk görünüm | Alan sayısı |
| --- | --- | ---: |
| Tahsilat | Müvekkil, tutar, tarih, açıklama | 4 |
| Gider | Tutar, kategori, tarih, açıklama | 4 |
| Müvekkil | Ad/unvan, telefon, not | 3 |
| Dosya | Müvekkil, başlık, dosya numarası, dosya türü | 4 |
| Hatırlatma | Başlık, tür, vade tarihi | 3 |
| Avans | Müvekkil, tutar, yön, açıklama | 4 |
| Belge | Dosya, belge türü | 2 |

Diğer alanlar kapalı `Gelişmiş seçenekler` bölümünde tutulur. Düzenleme formlarında kapalı alanların mevcut değerleri form state'inde korunur ve submit payload'ından çıkarılmaz.

## Akıllı Davranışlar

- Tarih bugün, para birimi TRY, ödeme yöntemi Havale/EFT ve uyarı süresi 3 gün varsayılanıdır.
- Tahsilat ve giderde aktif varsayılan kasa form state'ine hazırlanır; kullanıcı değiştirebilir.
- Son kasa, ödeme yöntemi, para birimi, kategori ve müvekkil tercihleri yalnız mounted client aşamasında saklanır.
- Tutar, açıklama, tarih veya başka finans verisi localStorage'a yazılmaz.
- `noter`, `vergi`, `SGK`, `harç` ve `UYAP` ifadeleri deterministik kategori önerisi üretir.
- Açıklamada müvekkil adı veya dosya numarası varsa bağlantı önerilir.
- Müvekkil seçildiğinde en son aktif dosyası önerilir.
- Öneri kullanıcı `Uygula` veya `Kaydet` demeden kalıcı değildir.
- Şemada ayrı SGK kategorisi bulunmadığı için SGK önerisi mevcut `Vergi` kategorisine yönlendirilir; veri modeli değiştirilmemiştir.

## Global Hızlı Ekle

Global `+ Yeni` paneli tahsilat, gider, müvekkil, dosya, hatırlatma, belge ve avans akışlarını içerir. Panel seçeneklerini yalnız açıldığında auth kontrollü `/api/quick-add/options` endpoint'inden alır. Kayıtlar mevcut API endpoint'lerine gider, işlem bitince mevcut sayfa korunur ve uygulama veri senkronizasyon olayı yayınlanır. `Cmd+N` / `Ctrl+N` paneli açar.

## Liste Sadelik Kontrolü

- Tahsilat: 6 sütun.
- Gider: 6 sütun.
- Avans: 6 sütun.
- Makbuz/fatura: 7 sütun.
- Belgeler: ana karar alanları; ayrıntılar detay ekranında korunur.
- Müvekkil ve dosya oluşturma formları sayfa içinden kaldırılıp modal akışına alındı.
- Dosya metrikleri üç karta indirildi.

## Gerçek Tarayıcı Kontrolü

11 Temmuz 2026 tarihinde çalışan yerel uygulamada doğrulandı:

- Dashboard'da `+ Yeni` paneli URL değişmeden açıldı.
- Panelde 7 kayıt türü görüldü.
- Hızlı gider formunda yalnız 4 temel alan render edildi.
- Standart tahsilat formunda yalnız 4 temel alan render edildi.
- Gelişmiş seçenekler varsayılan olarak kapalıydı.
- `Kadıköy noter masrafı` açıklaması `Noter` önerisi üretti.
- `Uygula` sonrası kategori `NOTARY` oldu; submit yapılmadan veritabanı değişmedi.
- Kontrol edilen ekranda yatay taşma `0px` idi.

## Etkileşim Bütçesi

| Görev | Zorunlu/görünür alan | Global panelden minimum tıklama |
| --- | ---: | ---: |
| Tahsilat | 4 | 2 + alanlar + Kaydet |
| Gider | 4 | 2 + alanlar + Kaydet |
| Müvekkil | 3 | 2 + alanlar + Kaydet |
| Hatırlatma | 3 | 2 + alanlar + Kaydet |
| Belge | 2 | 2 + dosya seçimi + Yükle |

Gerçek render açılışları yaklaşık 0.1-1.6 saniye aralığında gözlendi. Veri oluşturan süre testi mevcut veriyi kirletmemek için host tarayıcıda submit edilmedi; izole CRUD ve finans invariant testleri bunun yerine çalıştırıldı.

## Kalite Sonuçları

- `npx prisma generate`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run test`: PASS
- Host tarayıcı gerçek render: PASS
- Bağımsız Playwright Chromium: BLOCKED - macOS sandbox Mach port izni nedeniyle browser process başlatılamadı; test assertions gevşetilmedi.
- Finansal invariants: PASS
- Veri koruma: PASS; migration veya reset uygulanmadı.

## Bilinen Sınır

Belge extractedText metadata önerileri yükleme sonrasındaki mevcut processing hattında çalışır; ilk dosya seçimi sırasında OCR veya PDF extraction senkron çalıştırılmaz. Bu tercih upload hızını ve güvenilirliğini korur.
