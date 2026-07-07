# Büro Finans Paneli V2 - Release Notes

Release tarihi: 2026-07-05

## Özet

V2 ile uygulama, V1 gelir-gider takip panelinden tek avukat için tasarlanmış dijital kasa ve finans kontrol merkezine genişletildi. Müvekkil, dosya, tahsilat, gider, makbuz/fatura, soft delete, audit log ve rapor akışları korunarak kasa hesapları, kasa hareketleri, premium dashboard, V2 rapor analitiği, mobil/PWA deneyimi ve production hazırlığı eklendi.

## V2'de Eklenenler

- Dijital kasa hesapları: nakit, banka, kredi kartı, sanal ve diğer hesap türleri.
- Kasa ledger altyapısı: tahsilat için giriş, gider için çıkış, transfer ve manuel düzeltme hareketleri.
- Tahsilat/gider formlarında kasa hesabı seçimi ve varsayılan Ana Kasa desteği.
- Tahsilat/gider oluşturma, düzenleme ve silme işlemlerinde bağlı kasa hareketi senkronizasyonu.
- Kasa bakiyesi, günlük giriş/çıkış, aylık net ve son hareketler için merkezi servisler.
- Premium V2 dashboard: Dijital Kasa hero alanı, finans ticker, günlük finans kartları, kasa bakiyesi, alarm merkezi ve son hareketler.
- Dashboard grafiklerinin lazy yüklenmesi, skeleton/empty/error fallback ve mobil veri optimizasyonu.
- V2 raporlar: KPI kartları, nakit akışı, gelir/gider trendleri, kasa raporu, müvekkil kârlılığı ve dosya finans raporu.
- Hatırlatma geliştirmeleri: gider/tahsilat/dosya/fatura/vergi türleri, öncelik, tutar, kasa hesabı, notifyBeforeDays ve notificationEnabled alanları.
- Bildirim merkezi: yaklaşan, bugün vadeli, geciken ve kritik hatırlatmalar.
- Hatırlatmadan gider oluşturma ve ilgili kasa çıkışını ledger'a işleme.
- Browser notification desteği: izin sonrası uyarı, notifiedAt ile spam engelleme.
- PWA manifest, iOS meta tagleri, service worker, offline fallback ve `/install` kurulum ekranı.
- Mobil V2 deneyimi: 5'li alt navigasyon, hızlı işlem FAB, tam ekran form drawer, mobil kart tablo görünümü, safe-area/viewport-fit desteği.
- Backup/export güçlendirmesi: CSV, JSON export, audit log ve silinen kayıtların yedekte korunması.
- Production güvenlik hazırlığı: secret zorunluluğu, secure cookie, rate limit, security headers ve deployment dokümantasyonu.
- Cross-browser ve responsive Playwright test altyapısı.

## Korunan V1 Özellikleri

- Müvekkil CRUD ve sil/arşivle akışı.
- Dosya CRUD ve sil/arşivle akışı.
- Tahsilat, gider, makbuz/fatura CRUD akışları.
- Soft delete ve restore altyapısı.
- Audit log altyapısı.
- Dashboard ve raporlarda `deletedAt: null` filtreleri.
- CSV/JSON export ve SQLite yedekleme talimatları.
- Tek kullanıcı auth ve session yönetimi.

## Bilinen Sınırlamalar

- Banka API entegrasyonu yoktur; kasa hareketleri manuel kayıtlar ve uygulama içi işlemlerle oluşur.
- GİB/e-SMM/e-Fatura entegrasyonu yoktur; makbuz/fatura ekranı yalnızca takip amaçlıdır.
- Paraşüt, Logo, Mikro veya ERP entegrasyonu yoktur.
- Tarayıcı bildirimi kullanıcı iznine ve tarayıcı desteğine bağlıdır.
- Uygulama kapalıyken kesin bildirim için ileride cron, push veya e-posta entegrasyonu gerekir.
- Offline veri yazma desteklenmez; service worker statik app shell ve offline fallback sağlar.
- Aktif Prisma provider SQLite'tır. Serverless/cloud production için PostgreSQL gibi kalıcı veritabanına geçiş ayrıca planlanmalıdır.
- Çok kullanıcılı kurumsal yetkilendirme V2 kapsamına dahil değildir.
- Gerçek borsa/kripto/hisse fiyat verisi çekilmez; finans terminali yaklaşımı yalnızca arayüz ve veri okuma mantığıdır.

## Production Deployment Adımları

1. `.env.example` dosyasını temel alarak production `.env` oluşturun.
2. `NODE_ENV=production` ayarlayın.
3. `APP_URL` değerini HTTPS production domain olarak girin.
4. `DATABASE_URL` değerini seçilen profile göre ayarlayın:
   - VPS + SQLite için kalıcı disk üzerindeki SQLite dosyası.
   - Cloud/serverless için PostgreSQL gibi kalıcı production database.
5. `AUTH_SECRET` ve `SESSION_SECRET` değerlerini en az 32 karakterlik güçlü rastgele secret olarak belirleyin.
6. `ADMIN_EMAIL` ve `ADMIN_PASSWORD` değerlerini production'a özel güçlü bilgilerle değiştirin.
7. Migrationları uygulayın:

```bash
npm install
npm run db:deploy
```

8. İlk kurulum gerekiyorsa seed komutunu dikkatle çalıştırın:

```bash
npm run db:seed
```

9. Production build alın:

```bash
npm run typecheck
npm run lint
npm run build
```

10. Uygulamayı başlatın:

```bash
npm run start
```

11. HTTPS reverse proxy veya hosting TLS ayarlarını aktif edin.
12. VPS + SQLite kullanılıyorsa günlük otomatik backup kurun:

```bash
BACKUP_DIR=/secure/backups npm run backup:sqlite
```

13. PWA kurulumunu `/install` ekranından, iPhone Safari, macOS Safari, Chrome/Edge desktop ve Android Chrome üzerinde manuel doğrulayın.

## Release Doğrulama Komutları

V2 final release için önerilen kontrol sırası:

```bash
npm run typecheck
npm run lint
npm run build
npx playwright test
```

İsteğe bağlı bundle kontrolü:

```bash
npm run bundle:analyze
```

## Final Doğrulama Sonucu

2026-07-05 tarihinde V2 final release checklist kapsamında şu kontroller çalıştırıldı:

- `npm run typecheck`: başarılı.
- `npm run lint`: başarılı.
- `npm run build`: başarılı.
- `npx playwright test`: başarılı.

Playwright sonucu:

- 8 test geçti.
- 6 test atlandı.

Atlanan testler, veri değiştiren dijital kasa E2E akışının yalnızca `chromium-desktop` projesinde çalışacak şekilde bilinçli sınırlandırılmasından kaynaklanır. Route smoke, hydration/runtime, responsive, mobil menü, PWA install ve offline fallback kontrolleri Chromium, Firefox, WebKit, tablet, iPhone ve Android hedeflerinde çalıştırılmıştır.

## Release Kontrol Notları

- V1 uyumluluk için mevcut CRUD, soft delete, audit log, export ve rapor akışları korunmalıdır.
- V2 kasa doğrulaması için tahsilat/gider oluşturma, güncelleme, silme ve ledger etkisi kontrol edilmelidir.
- Dashboard ve raporlarda silinen kayıtlar hesaplara dahil edilmemelidir.
- Client componentlere `Date`, `Decimal` veya `BigInt` doğrudan gönderilmemelidir.
- Server Component'ten Client Component'e function prop geçirilmemelidir.
- Mobilde yatay taşma, safe-area çakışması ve erişilemeyen aksiyon butonu olmamalıdır.
