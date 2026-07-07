# Büro Finans Paneli V2 - Dijital Kasa

## 1. Ürün Amacı

Büro Finans Paneli V2, tek avukatın hukuk bürosunu yalnızca gelir-gider kaydıyla değil, tam bir dijital kasa ve finans kontrol merkezi mantığıyla yönetmesini sağlar.

V2 ile uygulama; müvekkil, dosya, tahsilat, gider, makbuz/fatura, hatırlatma ve rapor modüllerini koruyarak kasa hesapları, kasa hareketleri, nakit akışı, ödeme alarmları ve premium finans dashboard deneyimiyle genişletilecektir.

En önemli ürün kuralı: V1 stabil sürümde çalışan CRUD, soft delete, audit log, dashboard, rapor, hatırlatma, müvekkil, dosya, tahsilat, gider ve makbuz/fatura akışları bozulmayacaktır.

## 2. Kullanıcı Profili

Ana kullanıcı tek avukattır.

Kullanıcı;
- büro gelirlerini ve giderlerini hızlı görmek,
- hangi paranın hangi kasada olduğunu bilmek,
- nakit, banka, kredi kartı ve sanal hesap bakiyelerini izlemek,
- tahsilat ve giderleri müvekkil/dosya/kasa bağlamında okumak,
- yaklaşan ödeme ve tahsilatları kaçırmamak,
- mobil, tablet ve desktop cihazlarda aynı güvenilir deneyimi almak ister.

## 3. V2 Hedefleri

1. Tam dijital kasa sistemi kurmak.
2. Kasa, banka, kredi kartı, nakit ve sanal hesap mantığını desteklemek.
3. Tahsilat ve giderleri kasa hesabına bağlamak.
4. Gelirleri yeşil, giderleri ve negatif değerleri kırmızı finans diliyle göstermek.
5. Investing/finans terminali hissinde grafik ve ticker deneyimi sunmak.
6. Apple/macOS estetiğine yakın, sade ve premium bir arayüz oluşturmak.
7. Basit, hızlı ve dokunmatik uyumlu kullanım sağlamak.
8. Mobil, tablet ve desktop uyumluluğunu güçlendirmek.
9. macOS Dock / masaüstü kısayolu için PWA desteğini iyileştirmek.
10. iPhone ana ekran kullanımı için PWA deneyimini iyileştirmek.
11. Modern tarayıcılarda sorunsuz web kullanımı sağlamak.
12. Hücresel veriyle hızlı açılacak performans hedeflemek.
13. Yayına hazır production yapısını güçlendirmek.
14. V1'in çalışan hiçbir özelliğini bozmamak.

## 4. MVP Kapsamı

### Dijital Kasa

- Kasa hesabı oluşturma: nakit, banka, kredi kartı, sanal hesap.
- Kasa hesabı listeleme ve bakiye görüntüleme.
- Kasa hareketleri: giriş, çıkış, transfer, düzeltme.
- Tahsilat kaydı oluştururken kasa hesabı seçme.
- Gider kaydı oluştururken kasa hesabı seçme.
- Kredi kartı hesabı için borç/ödeme takibi altyapısı.
- Silinen kayıtların kasa bakiyesine dahil edilmemesi.
- Kritik kasa hareketlerinde audit log oluşturma.

### Premium Dashboard

- Günlük kasa özeti.
- Toplam kasa/banka/nakit/kredi kartı görünümü.
- Günlük nakit akışı grafiği.
- Aylık kasa trend grafikleri.
- Finans ticker bandı.
- Yaklaşan ödeme ve tahsilat alarm alanı.
- Son kasa hareketleri.
- Gelir/gider/kasa değerlerinde yeşil-kırmızı finans ayrımı.

### Raporlar V2

- Kasa bazlı gelir-gider raporu.
- Kasa hareketleri raporu.
- Müvekkil/dosya/kasa kırılımı.
- Aylık kasa ve nakit akışı grafikleri.
- CSV export yapısının korunması.

### PWA ve Production

- PWA kurulum ekranı veya yönlendirme alanı.
- iPhone ana ekran ve macOS Dock kullanım notları.
- Service worker ve manifest kontrolleri.
- Cross-browser manuel test listesi.
- Production checklist: env, build, yedekleme, güvenlik, deploy.

## 5. MVP Dışı Bırakılanlar

İlk V2 MVP kapsamında aşağıdakiler yapılmayacaktır:

- Gerçek borsa verisi çekme.
- Kripto veya hisse fiyatı entegrasyonu.
- Banka API entegrasyonu.
- GİB/e-SMM/e-Fatura doğrudan entegrasyonu.
- Paraşüt, Logo, Mikro veya ERP entegrasyonu.
- Çok kullanıcılı kurumsal muhasebe sistemi.
- Otomatik muhasebe fişi veya resmi defter üretimi.

Bu alanlar için ilk yaklaşım manuel kayıt, CSV/JSON export, raporlama ve ileride entegrasyona uygun veri modeli bırakmaktır.

## 6. V2 Modülleri

- Dijital Kasa
- Kasa Hesapları
- Kasa Hareketleri
- Tahsilat/Gider kasa bağlantısı
- Premium Dashboard
- Finans Ticker
- Günlük Nakit Akışı
- Aylık Kasa Grafikleri
- Raporlar V2
- Hatırlatma ve ödeme alarm merkezi
- PWA kurulum ekranı
- Yayın/production hazırlığı
- Cross-browser test sistemi

## 7. Veri Modeli Taslakları

V2 için önerilen yeni temel entity'ler:

### CashAccount

- id
- userId
- name
- type: CASH, BANK, CREDIT_CARD, VIRTUAL
- currency
- openingBalance
- currentBalance
- color nullable
- isDefault
- archivedAt nullable
- deletedAt nullable
- createdAt
- updatedAt

### CashTransaction

- id
- userId
- cashAccountId
- type: INFLOW, OUTFLOW, TRANSFER, ADJUSTMENT
- sourceType: INCOME, EXPENSE, MANUAL, TRANSFER, CREDIT_CARD_PAYMENT
- sourceId nullable
- amount
- currency
- date
- description nullable
- relatedClientId nullable
- relatedCaseFileId nullable
- deletedAt nullable
- createdAt
- updatedAt

### Tahsilat/Gider Bağlantısı

- Income modeline cashAccountId nullable eklenebilir.
- Expense modeline cashAccountId nullable eklenebilir.
- Eski V1 kayıtları migration sonrası bozulmamalıdır.
- Eski kayıtlarda kasa hesabı boş olabilir veya varsayılan kasa hesabına sonradan bağlanabilir.

## 8. Kullanıcı Akışları

### Kasa Hesabı Oluşturma

1. Kullanıcı Dijital Kasa ekranına girer.
2. Yeni kasa hesabı oluşturur.
3. Hesap türünü seçer: nakit, banka, kredi kartı veya sanal hesap.
4. Açılış bakiyesi girer.
5. Hesap dashboard ve kasa raporlarında görünür.

### Tahsilat Kaydı

1. Kullanıcı tahsilat ekler.
2. Müvekkil ve opsiyonel dosya seçer.
3. Tutar, tarih, kategori ve ödeme yöntemini girer.
4. Kasa hesabı seçer.
5. Tahsilat kaydedilir, ilgili kasa bakiyesi artar.
6. Audit log kaydı oluşur.

### Gider Kaydı

1. Kullanıcı gider ekler.
2. Genel gider veya müvekkil/dosya gideri seçer.
3. Kasa hesabı seçer.
4. Gider kaydedilir, ilgili kasa bakiyesi azalır.
5. Dashboard ve raporlar güncellenir.

### Kasa Transferi

1. Kullanıcı iki kasa hesabı arasında transfer başlatır.
2. Kaynak ve hedef hesabı seçer.
3. Tutar ve açıklama girer.
4. Kaynak hesap azalır, hedef hesap artar.
5. İşlem geçmişi tutulur.

## 9. Tasarım İlkeleri

V2, finans terminali hissi vermelidir; ancak hiçbir ürünün marka, logo, renk yerleşimi veya proprietary tasarımı birebir taklit edilmeyecektir.

Uygulanacak yaklaşım:
- Investing benzeri hızlı finans okuma mantığı.
- Yeşil gelir/pozitif değer, kırmızı gider/negatif değer ayrımı.
- Grafik, ticker ve finans kartlarıyla yoğun ama okunabilir veri düzeni.
- Apple/macOS estetiğine yakın sade, premium, yumuşak ve rafine arayüz.
- Mobilde tek elle kullanılabilen büyük dokunma alanları.
- Desktop'ta finans terminali gibi güçlü, geniş ekran dashboard.
- Gereksiz animasyon, renk karmaşası ve kalabalık açıklama metinlerinden kaçınma.

## 10. Teknik Kurallar

- Server Component'ten Client Component'e function prop geçirilmeyecek.
- Client componentlere yalnızca serializable data gönderilecek.
- Decimal, Date ve BigInt doğrudan client'a gönderilmeyecek; string, number veya plain object'e çevrilecek.
- İlk render'da window, document, localStorage, matchMedia, Date.now, Math.random veya locale farkı yaratabilecek browser-only değerler kullanılmayacak.
- Hydration mismatch yaratılmayacak.
- Soft delete mantığı korunacak.
- Dashboard ve raporlarda deletedAt null filtreleri korunacak.
- Kritik kasa işlemleri audit log'a yazılacak.
- Migration mevcut veriyi silmeyecek.
- V1 route'ları korunacak.

## 11. Kabul Kriterleri

V2 MVP aşağıdaki koşullarda kabul edilir:

- V1 modülleri çalışmaya devam eder.
- TypeScript, lint ve production build temiz geçer.
- Kasa hesabı oluşturulabilir.
- Tahsilat ve gider kasa hesabına bağlanabilir.
- Kasa bakiyeleri tahsilat/gider/transfer hareketlerinden doğru hesaplanır.
- Soft delete edilen kayıtlar kasa ve rapor hesaplarına dahil edilmez.
- Dashboard kasa ve nakit akışı verilerini hızlı okunabilir şekilde gösterir.
- Mobil, tablet ve desktop görünümde ana ekranlar taşmaz.
- PWA manifest ve service worker çalışır.
- CSV/JSON export V1 davranışını korur.
- Kritik işlemler audit log'a yazılır.

## 12. Faz Planı

1. Kasa veri modeli ve migration.
2. Kasa hesapları CRUD.
3. Kasa hareketleri ve transfer altyapısı.
4. Tahsilat/gider kasa bağlantısı.
5. Dashboard V2 dijital kasa kartları ve grafikler.
6. Raporlar V2 kasa grafikleri.
7. PWA kurulum ve production checklist ekranları.
8. Cross-browser, mobile ve build testleri.

Her faz sonunda:

```bash
npm run typecheck
npm run lint
npm run build
```
