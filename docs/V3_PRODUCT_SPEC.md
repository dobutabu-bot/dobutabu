# V3 - Akıllı Finans, Belge ve Sermaye Merkezi

## 1. Amaç

V3 ile uygulama yalnızca hukuk bürosu gelir-gider ve dijital kasa sistemi olmaktan çıkar; belge arşivi, banka ekstresi analiz motoru, mutabakat sistemi ve kişisel/mesleki sermaye takip merkezi haline gelir.

Bu sürümde kullanıcı; dekont, makbuz, fiş, fatura, PDF ve görsel belgeleri finans kayıtlarına bağlayabilecek, banka ekstresini sisteme yükleyip kasa hareketleriyle karşılaştırabilecek, son 1 yıllık finansını analiz edebilecek ve nakit/banka/döviz/altın/borsa/crypto/diğer varlıklarını tek net varlık ekranından takip edebilecektir.

V3 yatırım tavsiyesi vermez. Sistem yalnızca kullanıcının kendi finansal kayıtlarını sınıflandırır, analiz eder, görselleştirir ve mutabakat kontrolü yapmasına yardımcı olur.

## 2. Korunacak Mevcut Sistem

V3 geliştirmeleri mevcut çalışan V1/V2 yapısının üstüne eklenecektir. Refactor bahanesiyle mevcut davranışlar kırılmayacaktır.

Korunacak ana parçalar:

- Müvekkil, dosya, tahsilat, gider ve makbuz/fatura CRUD akışları.
- Soft delete, geri alma ve normal listelerde `deletedAt: null` filtreleri.
- Audit log altyapısı.
- Hatırlatmalar ve bildirim merkezi.
- Dijital kasa, kasa hesapları, kasa hareketleri ve transfer mantığı.
- Dashboard V2 ve Raporlar V2 hesaplamaları.
- CSV/JSON export ve yedekleme altyapısı.
- Auth, ownership kontrolü ve tek kullanıcı mantığı.
- PWA hazırlığı ve mobil kullanım prensipleri.

Teknik kural: V3 modelleri ve route'ları mevcut modelleri kırmadan ek katman olarak tasarlanacaktır.

## 3. Kullanıcı Profili

Ana kullanıcı tek avukattır. Kullanıcı hem büro finansını hem de mesleki/kişisel sermayesini tek panelden görmek ister.

Kullanıcının temel ihtiyaçları:

- Her tahsilat ve giderin belgesini kolayca saklamak.
- Müvekkil ve dosya bazlı belge arşivi oluşturmak.
- Bankadan indirilen ekstreyi sisteme yüklemek.
- Banka hareketleri ile sistemdeki kasa hareketlerinin örtüşüp örtüşmediğini görmek.
- Eksik, belgesiz veya eşleşmemiş kayıtları fark etmek.
- Son 1 yıllık gelir-gider trendini hızlı okumak.
- Nakit, banka, döviz, altın, borsa, crypto ve diğer varlıklarını net varlık ekranında izlemek.
- Bunların tamamını telefon, tablet ve desktop üzerinden sade bir arayüzle kullanmak.

## 4. V3 Ana Modülleri

1. Belge Merkezi
2. PDF çıktı sistemi
3. Banka ekstresi yükleme
4. Akıllı analiz ve öneri motoru
5. Banka/kasa mutabakatı
6. Sermaye ve varlık merkezi
7. V3 dashboard kartları
8. V3 raporları
9. V3 export ve audit log genişletmeleri

## 5. Belge Merkezi

### Kapsam

Belge Merkezi, kullanıcının hukuk bürosu finansına ait tüm dijital belgeleri güvenli şekilde saklayacağı modüldür.

Desteklenecek belge türleri:

- Dekont
- Makbuz
- Fiş
- Fatura
- PDF
- Görsel
- Banka ekstresi
- Sözleşme veya diğer ofis belgesi

Desteklenecek dosya formatları:

- PDF
- JPG
- JPEG
- PNG
- WEBP
- CSV
- XLSX

### Belge Bağlantıları

Bir belge aşağıdaki kayıtlara bağlanabilir:

- Müvekkil
- Dosya
- Tahsilat
- Gider
- Makbuz/fatura
- Kasa hareketi
- Kasa hesabı
- Hatırlatma

Bir belge birden fazla kayda bağlanabilir. Örnek: Bir banka dekontu hem tahsilata hem müvekkile hem de kasa hareketine bağlı olabilir.

### Belge Alanları

Belge kaydı şu alanları desteklemelidir:

- Belge adı
- Belge tipi
- Orijinal dosya adı
- Güvenli dosya adı
- Mime type
- Dosya boyutu
- Checksum
- Belge tarihi
- Tutar
- Para birimi
- Açıklama
- Etiketler
- Bağlı müvekkil
- Bağlı dosya
- Bağlı finans kaydı
- Yüklenme tarihi
- Silinme tarihi

### Belge Listeleme

Liste ekranında şunlar olmalıdır:

- Arama
- Belge tipine göre filtre
- Tarih aralığı filtresi
- Müvekkil filtresi
- Dosya filtresi
- Tutar aralığı filtresi
- Bağlı kayıt türü filtresi
- Belgesi olmayan giderleri gösterme filtresi
- Mobilde kart görünümü
- Desktop'ta tablo görünümü

### Belge Detayı

Belge detayında şunlar görünmelidir:

- Belge önizleme
- Belge bilgileri
- Bağlı kayıtlar
- İndirme butonu
- Düzenle butonu
- Sil butonu
- Audit log kısa geçmişi

### Belge Güvenliği

Yüklenen belgeler `public` klasöründe açık tutulmayacaktır. Belgeler auth kontrolünden geçen özel route ile indirilecek veya önizlenecektir.

## 6. PDF Çıktı Sistemi

PDF çıktılar ilk sürümde sade, profesyonel ve hukuk bürosuna uygun olacaktır. Amaç resmi muhasebe belgesi üretmek değil, kullanıcıya düzenli finans özeti vermektir.

PDF çıktı türleri:

- Tahsilat PDF özeti
- Gider PDF özeti
- Müvekkil cari PDF raporu
- Dosya finans PDF raporu
- Aylık finans PDF raporu
- Kasa hareketleri PDF raporu
- Sermaye PDF raporu

### PDF İçerik Standardı

Her PDF raporunda şu bilgiler yer almalıdır:

- Büro adı
- Rapor başlığı
- Tarih aralığı
- Oluşturulma tarihi
- Özet kartları
- Detay tablo
- Toplamlar
- Uyarı notu

PDF çıktılarında para formatı Türk Lirası biçiminde gösterilecektir. Gelirler artı, giderler eksi mantığıyla belirtilecektir.

## 7. Banka Ekstresi Yükleme

### Amaç

Kullanıcı bankadan indirdiği ekstreyi sisteme yükleyerek banka hareketleri ile sistemdeki tahsilat/gider/kasa hareketlerini karşılaştırabilecektir.

### Desteklenen Formatlar

- CSV
- XLSX
- PDF

İlk uygulanabilir MVP'de CSV ve XLSX ayrıştırma önceliklidir. PDF ekstresi yüklenebilir ve saklanabilir; otomatik PDF ayrıştırma daha kontrollü şekilde sonraki fazda genişletilebilir.

### Ekstre Import Alanları

Banka ekstresi import ekranında şu alanlar olmalıdır:

- Banka adı
- Hesap seçimi
- Para birimi
- Tarih aralığı
- Ekstre dosyası
- Kolon eşleme modu
- Açılış bakiyesi
- Kapanış bakiyesi
- Not

### Manuel Kolon Eşleme

CSV/XLSX kolonları otomatik tanınamazsa kullanıcı şu alanları manuel eşleyebilmelidir:

- Tarih
- Açıklama
- Borç/çıkış
- Alacak/giriş
- Tutar
- Bakiye
- Referans numarası
- Karşı taraf

### Duplicate Kontrolü

Duplicate kontrolü şu sinyallerle yapılmalıdır:

- Dosya checksum
- Banka adı
- Hesap
- Tarih
- Tutar
- Açıklama
- Referans numarası

Aynı hareket tekrar import edilmeye çalışılırsa kullanıcıya uyarı verilmeli ve hareket taslakta duplicate olarak işaretlenmelidir.

## 8. Akıllı Analiz

Akıllı analiz sistemi otomatik karar vermez; kullanıcıya öneri sunar.

### Analiz Alanları

- Gelir/gider ayrımı
- Kategori tahmini
- Müvekkil tahmini
- Dosya tahmini
- Tahsilat/gider eşleştirme
- Son 1 yıllık gelir/gider trendi
- Aylık net nakit akışı
- En yüksek gider kalemleri
- En yüksek gelir kaynakları
- Düzenli ödeme tespiti

### Öneri Mantığı

Sistem şu sinyallerle öneri üretir:

- Tutar eşleşmesi
- Tarih yakınlığı
- Açıklamada müvekkil adı geçmesi
- Açıklamada dosya numarası geçmesi
- Ödeme yöntemi
- Geçmiş benzer hareketler
- Düzenli ödeme örüntüsü

### Eşleştirme Skoru

Öneriler düşük, orta ve yüksek güven seviyesinde gösterilir.

Örnek skor yaklaşımı:

- Aynı tutar: yüksek katkı
- 0-3 gün tarih farkı: yüksek katkı
- Açıklamada müvekkil adı: yüksek katkı
- Açıklamada kategori anahtar kelimesi: orta katkı
- Aynı banka hesabı/kasa hesabı: orta katkı

Kullanıcı onay vermeden eşleşme kesinleşmez.

## 9. Mutabakat

### Amaç

Mutabakat ekranı bankadaki gerçek bakiye ile sistemdeki kasa bakiyesinin farkını gösterir.

### Mutabakat Alanları

- Bankadaki bakiye
- Sistemdeki kasa bakiyesi
- Fark
- Eşleşmiş hareketler
- Eşleşmemiş banka hareketleri
- Eşleşmemiş sistem hareketleri
- Manuel eşleştirme
- Otomatik eşleştirme önerileri

### Mutabakat Durumları

- Mutabık: Fark yok veya tolerans içinde
- Küçük fark: Kullanıcı kontrolü gerekli
- Kritik fark: Eşleşmeyen hareket veya hatalı kayıt olabilir
- Eksik sistem kaydı: Bankada var, sistemde yok
- Eksik banka hareketi: Sistemde var, bankada yok

### Mutabakat Aksiyonları

Kullanıcı şunları yapabilmelidir:

- Banka hareketini tahsilatla eşleştirme
- Banka hareketini giderle eşleştirme
- Banka hareketini kasa hareketiyle eşleştirme
- Banka hareketinden yeni tahsilat oluşturma
- Banka hareketinden yeni gider oluşturma
- Banka hareketinden kasa düzeltmesi oluşturma
- Eşleşmeyi kaldırma
- Hareketi yok sayma

Transferler gelir/gider toplamlarını şişirmemelidir.

## 10. Sermaye ve Varlık Merkezi

### Amaç

Sermaye Merkezi, kullanıcının büro ve kişisel finansal varlıklarını manuel takip edeceği net varlık ekranıdır.

### Varlık Türleri

- Nakit
- Banka
- Döviz
- Altın
- Borsa
- Crypto
- Diğer varlık
- Borç/eksi varlık

### Varlık Alanları

- Varlık adı
- Varlık türü
- Miktar
- Birim
- Para birimi
- Maliyet değeri
- Güncel değer
- Değerleme tarihi
- Not
- Bağlı kasa hesabı
- Aktif/pasif durumu

### Toplam Net Varlık

Toplam net varlık şu mantıkla hesaplanır:

- Pozitif varlıklar toplamı
- Borç/eksi varlıklar toplamı
- Net varlık = pozitif varlıklar - borçlar

Pozitif değerler yeşil, borç ve negatif değerler kırmızı gösterilir.

### Varlık Geçmişi

Kullanıcı manuel değer güncellediğinde snapshot tutulmalıdır. Bu sayede varlık değerinin zaman içindeki değişimi grafikle gösterilebilir.

### MVP Sınırı

İlk V3 sürümünde canlı fiyat çekme yapılmaz. Döviz, altın, borsa ve crypto değerleri kullanıcı tarafından manuel güncellenir.

## 11. V3 Veri Modeli Taslağı

Mevcut modeller bozulmadan aşağıdaki yeni modeller eklenebilir.

### DocumentFile

- id
- userId
- originalName
- storedName
- mimeType
- size
- checksum
- documentType: BANK_RECEIPT, RECEIPT, SLIP, INVOICE, PDF, IMAGE, BANK_STATEMENT, CONTRACT, OTHER
- filePath
- previewPath nullable
- documentDate nullable
- amount nullable Decimal
- currency default TRY
- notes nullable
- tags Json nullable
- deletedAt nullable
- createdAt
- updatedAt

### DocumentLink

- id
- userId
- documentFileId
- linkedEntityType: CLIENT, CASE_FILE, INCOME, EXPENSE, INVOICE_OR_RECEIPT, CASH_LEDGER_ENTRY, CASH_ACCOUNT, TASK_REMINDER
- linkedEntityId
- createdAt

### BankStatement

- id
- userId
- cashAccountId nullable
- documentFileId nullable
- bankName
- accountName nullable
- iban nullable
- currency default TRY
- periodStart nullable
- periodEnd nullable
- openingBalance nullable Decimal
- closingBalance nullable Decimal
- importStatus: DRAFT, IMPORTED, REVIEWED, ARCHIVED
- deletedAt nullable
- createdAt
- updatedAt

### BankStatementTransaction

- id
- userId
- bankStatementId
- cashAccountId nullable
- transactionDate
- description
- amount Decimal
- direction: IN, OUT
- balanceAfter nullable Decimal
- referenceNo nullable
- counterparty nullable
- rawData Json nullable
- duplicateKey nullable
- isDuplicate Boolean default false
- matchStatus: UNMATCHED, SUGGESTED, MATCHED, IGNORED
- deletedAt nullable
- createdAt
- updatedAt

### BankTransactionMatch

- id
- userId
- bankStatementTransactionId
- matchedEntityType: INCOME, EXPENSE, CASH_LEDGER_ENTRY, CASH_TRANSFER, INVOICE_OR_RECEIPT
- matchedEntityId
- score nullable Int
- matchedBy: SYSTEM, USER
- notes nullable
- createdAt

### CapitalAsset

- id
- userId
- name
- assetType: CASH, BANK, FX, GOLD, STOCK, CRYPTO, OTHER_ASSET, LIABILITY
- quantity Decimal
- unit nullable
- currency default TRY
- costBasis nullable Decimal
- currentValue Decimal
- valuationDate
- relatedCashAccountId nullable
- notes nullable
- isActive default true
- deletedAt nullable
- createdAt
- updatedAt

### CapitalAssetSnapshot

- id
- userId
- capitalAssetId
- quantity Decimal
- value Decimal
- currency default TRY
- snapshotDate
- createdAt

## 12. Ekranlar

### Yeni Route'lar

- `/documents`
- `/documents/[id]`
- `/bank-statements`
- `/bank-statements/[id]`
- `/bank-reconciliation`
- `/capital`
- `/capital/assets/[id]`
- `/reports/yearly-analysis`

### Mevcut Ekranlara Eklenecek Alanlar

- Müvekkil detayında bağlı belgeler.
- Dosya detayında bağlı belgeler.
- Tahsilat satırında belge var/yok göstergesi.
- Gider satırında belge var/yok göstergesi.
- Kasa hareketinde belge ve banka eşleşme göstergesi.
- Dashboard'da mutabakat farkı kartı.
- Dashboard'da toplam net varlık kartı.
- Raporlarda son 1 yıllık finans analizi.

## 13. Dashboard V3

Dashboard V2 korunur ve yeni V3 kartları eklenir.

Yeni kartlar:

- Toplam net varlık
- Banka/sistem kasa farkı
- Eşleşmemiş banka hareketleri
- Belgesiz giderler
- Son yüklenen belgeler
- Son 1 yıllık net finans trendi
- Düzenli ödemeler

Yeni grafikler:

- Son 12 ay gelir/gider/net trendi
- Varlık dağılım grafiği
- Banka hareketi eşleşme dağılımı
- En yüksek gider kalemleri
- En yüksek gelir kaynakları

## 14. Raporlar V3

V3 raporları mevcut Raporlar V2 ekranını bozmaz; yeni rapor kartları ve route'ları eklenir.

Raporlar:

- Son 1 yıllık gelir/gider raporu
- Aylık net nakit akışı raporu
- Belgesiz giderler raporu
- Belge bağlı tahsilat/gider raporu
- Banka mutabakat raporu
- Eşleşmemiş banka hareketleri raporu
- Sermaye ve net varlık raporu
- Varlık geçmişi raporu

Export:

- CSV korunur.
- JSON export kapsamına V3 kayıtları eklenir.
- PDF çıktı V3 raporlarında desteklenir.

## 15. Güvenlik

Yüklenen belgeler hassas kişisel ve finansal veri içerebilir. V3 güvenlik sınırları bu nedenle katı olmalıdır.

Kurallar:

- Belgeler `public` klasöründe açık durmayacak.
- Belge indirme ve önizleme route'ları auth kontrolü yapacak.
- Kullanıcı yalnızca kendi belgelerine erişebilecek.
- Dosya tipi kontrol edilecek.
- Dosya boyutu limiti olacak.
- Dosya adı sanitize edilecek.
- Dosya checksum ile duplicate kontrolü yapılacak.
- Upload klasörü production ortamında güvenli ve yedeklenebilir konumda olacak.
- Silme işlemleri soft delete olacak.
- Audit log tutulacak.
- Banka ekstresi import ve eşleştirme işlemleri loglanacak.
- Kullanıcıya şu uyarı gösterilecek:
  "Yüklenen belgeler kişisel veri, müvekkil bilgisi ve finansal bilgi içerebilir. Güvenli şekilde saklayınız."

## 16. MVP Dışı

İlk V3 MVP kapsamında aşağıdakiler yapılmayacaktır:

- Gerçek banka API bağlantısı.
- Otomatik canlı döviz/borsa/crypto fiyatı çekme.
- GİB'e doğrudan belge gönderme.
- Finansal yatırım tavsiyesi.
- Muhasebeci yerine geçecek resmi beyanname sistemi.
- Tam otomatik OCR ile tüm PDF ve görsellerden kusursuz veri çıkarma.
- Kullanıcı onayı olmadan banka hareketinden otomatik finans kaydı oluşturma.
- Çok kullanıcılı kurumsal onay mekanizması.

## 17. Teknik Prensipler

- Server Component'ten Client Component'e function prop geçilmeyecek.
- Client componentlere Decimal, Date veya BigInt doğrudan gönderilmeyecek.
- Tüm para hesaplarında Decimal yaklaşımı korunacak.
- Soft delete filtreleri korunacak.
- Audit log kritik V3 işlemlerinde çalışacak.
- Yeni route'lar mevcut route'larla çakışmayacak.
- Banka transferleri gelir/gider toplamlarını şişirmeyecek.
- Import işlemleri önce taslak/önizleme olarak çalışacak.
- Eşleştirme kullanıcı onayıyla kesinleşecek.
- Hydration mismatch yaratılmayacak.
- Mobilde belge yükleme ve eşleştirme akışları dokunmatik uyumlu olacak.

## 18. Kabul Kriterleri

V3 MVP kabul kriterleri:

- Mevcut V1/V2 özellikleri çalışmaya devam eder.
- Belge yüklenebilir, listelenebilir, filtrelenebilir ve indirilebilir.
- Belge müvekkil, dosya, tahsilat, gider ve kasa hareketine bağlanabilir.
- Belge güvenli private storage üzerinden servis edilir.
- PDF raporlar oluşturulabilir.
- CSV/XLSX banka ekstresi yüklenebilir.
- Kolon eşleme yapılabilir.
- Duplicate hareketler tespit edilir.
- Banka hareketleri tahsilat/gider/kasa hareketleriyle eşleştirilebilir.
- Mutabakat farkı hesaplanır.
- Sermaye/varlık kaydı oluşturulabilir.
- Toplam net varlık hesaplanır.
- V3 işlemleri audit log'a yazılır.
- Typecheck, lint ve build temiz geçer.

## 19. Geliştirme Fazları

### Faz 1 - Belge Merkezi Temeli

- DocumentFile ve DocumentLink modellerini ekle.
- Private upload klasörü ve güvenli dosya servis route'u oluştur.
- Belge listeleme, yükleme, detay ve silme akışını kur.
- Belgeyi müvekkil/dosya/tahsilat/gider/kasa hareketine bağla.
- Audit log ekle.

### Faz 2 - PDF Çıktı Sistemi

- PDF render altyapısını seç ve kur.
- Tahsilat PDF özeti oluştur.
- Gider PDF özeti oluştur.
- Müvekkil cari PDF raporu oluştur.
- Dosya finans PDF raporu oluştur.
- Aylık finans ve kasa hareketleri PDF raporlarını ekle.

### Faz 3 - Banka Ekstresi Import

- BankStatement ve BankStatementTransaction modellerini ekle.
- CSV/XLSX upload ve parse akışını kur.
- Manuel kolon eşleme ekranı oluştur.
- Import preview ekranı oluştur.
- Duplicate kontrolü ekle.

### Faz 4 - Akıllı Eşleştirme

- BankTransactionMatch modelini ekle.
- Tutar, tarih, açıklama, müvekkil ve dosya sinyalleriyle öneri üret.
- Eşleşme skoru göster.
- Manuel eşleştirme ve eşleşme kaldırma akışını ekle.
- Eşleşmeyen banka hareketinden tahsilat/gider/kasa düzeltmesi oluşturma akışını ekle.

### Faz 5 - Mutabakat Merkezi

- Bankadaki bakiye ile sistem kasa bakiyesini karşılaştır.
- Eşleşmiş/eşleşmemiş hareketleri ayır.
- Mutabakat farkını göster.
- Mutabakat PDF raporu ekle.
- Dashboard'a mutabakat kartı ekle.

### Faz 6 - Sermaye ve Varlık Merkezi

- CapitalAsset ve CapitalAssetSnapshot modellerini ekle.
- Varlık listeleme, ekleme, düzenleme ve silme akışını kur.
- Manuel değer güncelleme ve snapshot oluşturma.
- Toplam net varlık hesabını oluştur.
- Varlık dağılım grafiklerini ekle.

### Faz 7 - V3 Dashboard ve Raporlar

- Dashboard'a net varlık, belgesiz gider, mutabakat ve son belge kartlarını ekle.
- Son 1 yıllık gelir/gider analizini ekle.
- V3 raporlarını ve export kapsamını tamamla.
- Mobil responsive ve PWA kontrollerini yap.

### Faz 8 - Final Test ve Sertleştirme

- Typecheck, lint ve build çalıştır.
- Playwright smoke testleri ekle.
- Upload güvenliği testlerini yap.
- Mutabakat ve eşleştirme senaryolarını test et.
- README'ye V3 kullanım ve güvenlik notlarını ekle.
