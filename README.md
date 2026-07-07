# Hukuk Finans Otomasyon

Tek avukatın kişisel kullanımı için geliştirilmiş, düşük maliyetli ve mobil uyumlu finans takip uygulaması.

V1 stabil sürüm korunmuştur. V2 geliştirmeleri dijital kasa, premium dashboard, PWA ve production hazırlığı için yapılmaktadır.

## Teknoloji

- Next.js App Router
- TypeScript
- Prisma ORM
- SQLite
- Tailwind CSS
- React Hook Form
- Zod validation
- Recharts
- PWA manifest ve service worker
- Tek kullanıcı oturum sistemi

## Kurulum

Önce `.env.example` dosyasını temel alarak `.env` oluşturun:

```bash
cp .env.example .env
```

`.env` içinde en az şu değerleri kontrol edin:

```text
NODE_ENV="development"
APP_URL="http://localhost:3000"
DATABASE_URL="file:./dev.db"
AUTH_SECRET="local-development-secret-change-me-32chars"
SESSION_SECRET="local-development-secret-change-me-32chars"
ADMIN_EMAIL="avukat@example.com"
ADMIN_PASSWORD="DemoAvukat2026!"
```

Ardından bağımlılıkları kurup veritabanını hazırlayın:

```bash
npm install
npm run db:deploy
npm run db:seed
npm run dev
```

Uygulama varsayılan olarak şu adreste açılır:

```text
http://localhost:3000
```

Varsayılan giriş bilgileri `.env` dosyasındadır:

```text
ADMIN_EMAIL=avukat@example.com
ADMIN_PASSWORD=DemoAvukat2026!
```

İlk kullanımdan önce `.env` içindeki `AUTH_SECRET`, `SESSION_SECRET`, `ADMIN_EMAIL` ve `ADMIN_PASSWORD` değerlerini değiştirin. Şifre en az 10 karakter olmalıdır; production için daha güçlü ve benzersiz şifre kullanın.

## Kullanım

1. `/login` ekranından tek kullanıcı hesabı ile giriş yapın.
2. Önce müvekkil kaydı oluşturun.
3. Dosya kaydı oluştururken mutlaka bir müvekkil seçin.
4. Tahsilat, gider, makbuz/fatura ve hatırlatma kayıtlarını ilgili ekranlardan takip edin.
5. Dashboard üzerinde günlük, aylık ve yıllık finans durumunu kontrol edin.
6. Raporlar ve export ekranlarından CSV/Excel çıktıları alın.

Formlar kayıt sırasında kilitlenir; aynı kaydın hızlı çift tıklama ile iki kez oluşması engellenir. Para alanları Türk Lirası formatında, tarihler Türkiye formatında gösterilir.

## Komutlar

```bash
npm run dev          # Geliştirme sunucusu
npm run setup        # Prisma client + migration deploy + seed
npm run db:migrate   # Yeni migration oluşturur/uygular
npm run db:deploy    # Var olan migrationları uygular
npm run db:push      # SQLite şemasını günceller
npm run db:seed      # Tek kullanıcı, ayarlar ve örnek finans verileri oluşturur
npm run backup:sqlite # SQLite dosyasını tarihli yedek olarak kopyalar
npm run backup:v3     # V3 veritabanı + private belge storage yedeği
npm run restore:v3:dry-run -- <yedek-klasoru> # V3 restore provası
npm run typecheck    # TypeScript kontrolü
npm run build        # Üretim build
npm run bundle:analyze # Build sonrası client asset boyutlarını listeler
npm run start        # Üretim sunucusu
npm run lint         # ESLint kontrolü
```

Port doluysa geliştirme sunucusunu farklı portta açabilirsiniz:

```bash
npm run dev -- -p 3003
```

Telefon tarayıcısından denemek için bilgisayar ve telefon aynı ağdaysa terminalde görünen `Network` adresini açın. Örnek:

```text
http://192.168.1.102:3003
```

## PWA Kurulum ve Cihaz Kullanımı

Uygulama production ortamında HTTPS alan adı üzerinden PWA olarak kurulabilecek şekilde hazırlanmıştır. Kurulum yardım ekranı:

```text
/install
```

Desteklenen kullanım senaryoları:

- macOS Safari: Paylaş menüsünden `Add to Dock / Dock'a Ekle`.
- iPhone Safari: Paylaş menüsünden `Ana Ekrana Ekle`.
- Chrome/Edge desktop: adres çubuğundaki install ikonu veya tarayıcı menüsünden `Uygulamayı yükle`.
- Android Chrome: `Install app / Uygulamayı yükle` bildirimi veya menüden `Ana ekrana ekle`.
- Firefox desktop: PWA kurulum desteği sınırlı olabilir; uygulama normal tarayıcıda çalışmaya devam eder.

Notlar:

- PWA install ve tarayıcı bildirimleri production ortamında HTTPS gerektirir. Localhost geliştirme ortamında tarayıcılar genellikle istisna tanır.
- Service worker statik uygulama kabuğunu, ikonları, manifest dosyalarını ve Next.js statik assetlerini cache'ler.
- Offline veri yazma ilk sürümde desteklenmez. Bağlantı kesilirse uygulama içinde “İnternet bağlantısı yok. Veriler güncellenemeyebilir.” uyarısı gösterilir.
- Finans verilerinin güncel ve güvenli kalması için offline durumda kayıt düzenleme/oluşturma yapılmamalıdır.

## Performans ve Hücresel Veri

V2 dashboard grafiklerle zenginleştirilmiştir; ancak ilk açılışın mobil internetle de hızlı kalması için grafikler ana uygulama kabuğundan ayrı yüklenir. Dashboard önce özet kartları, ticker, hızlı aksiyonlar ve son hareketleri gösterir; Recharts tabanlı grafikler görünür alana yaklaşıldığında veya tarayıcı boşta kaldığında yüklenir. Grafik yüklenirken skeleton, veri yoksa empty state, chunk yükleme hatasında ise tekrar deneme ekranı gösterilir.

Veri hazırlama kuralları:

- Dashboard hesapları server-side yapılır; client componentlere sadece küçük ve serializable veri setleri gönderilir.
- Dashboard grafiklerinde son 7 gün, bu ay, son 6 ay, top 5 müvekkil, son 10 hareket gibi sınırlı setler kullanılır.
- Raporlar filtreye göre server-side hazırlanır; büyük veri ham haliyle client'a gönderilmez.
- Decimal ve Date değerleri client'a doğrudan gönderilmez; number/string/plain object formatına çevrilir.
- Mobilde grafikler tek sütuna düşer ve container dışına taşmayacak şekilde `ResponsiveContainer` ile render edilir.
- PWA service worker statik app shell ve Next.js assetlerini cache'ler; offline veri yazma bilinçli olarak kapalı tutulur.

Build sonrası client asset boyutlarını görmek için:

```bash
npm run build
npm run bundle:analyze
```

## Doğrulama

Kod değişikliğinden sonra önerilen kontrol sırası:

```bash
npm install
npm run db:deploy
npm run db:seed
npm run typecheck
npm run lint
npm run build
npx playwright test
```

Cross-browser ve responsive E2E testleri Playwright ile çalışır. Testler Chromium, Firefox, WebKit, desktop, laptop, tablet, iPhone ve Android boyutlarında `/login`, `/dashboard`, `/cash`, `/cash/accounts`, `/cash/ledger`, `/clients`, `/cases`, `/collections`, `/expenses`, `/reminders`, `/reports`, `/settings` ve `/install` rotalarını kontrol eder.

İlk kurulumda Playwright tarayıcılarını indirin:

```bash
npx playwright install chromium firefox webkit
```

Testler varsayılan olarak `http://localhost:3006` adresini kullanır ve gerekirse geliştirme sunucusunu bu portta başlatır. Farklı adres için:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3006 npx playwright test
```

E2E kapsamı login, dashboard açılışı, finans ticker, kasa kartları, tahsilat/gider kayıtlarının kasa bakiyesine etkisi, yaklaşan gider hatırlatması, rapor grafikleri, mobil menü, PWA kurulum sayfası, offline fallback, hydration hatası ve kritik console/runtime hatası kontrolünü içerir.

Manuel hızlı test akışı:

1. `/login` ekranından seed kullanıcısı ile giriş yapın.
2. Müvekkil ekleyin.
3. Eklenen müvekkile bağlı dosya oluşturun.
4. Aynı müvekkil için tahsilat ve gider kaydı girin.
5. Dashboard’daki bugün, bu ay tahsilat, gider ve net durum kartlarını kontrol edin.
6. `/api/export?resource=clients&format=csv` veya uygulamadaki export bağlantılarıyla CSV indirmeyi kontrol edin.
7. Mobil genişlikte dashboard kartlarının tek sütun, menünün alt navigasyon olarak göründüğünü kontrol edin.

## Proje Yapısı

```text
prisma/
  schema.prisma      # SQLite veri modeli
  migrations/        # Prisma migration SQL dosyaları
  seed.mjs           # Varsayılan kullanıcı, ayarlar ve örnek veriler
public/
  app.webmanifest   # Modern PWA manifest
  manifest.json      # PWA manifest
  sw.js              # Service worker
scripts/
  backup-sqlite.sh   # VPS/SQLite günlük yedek scripti
  backup-v3.sh        # Veritabanı + private belge dosyaları yedek scripti
  restore-v3-dry-run.sh # V3 yedeği restore provası
Dockerfile            # Production container image
docker-compose.yml    # App + Caddy + opsiyonel Postgres profili
Caddyfile             # HTTPS reverse proxy ve hassas belge headerları
docs/
  OPERATIONS.md       # Production, backup, restore ve deployment operasyon notları
src/app/
  (app)/             # Oturum gerektiren ekranlar
  api/               # Auth, kayıt, export ve yedekleme endpointleri
  login/             # Giriş ekranı
src/components/      # Ortak UI bileşenleri
src/lib/             # Prisma, auth, validation ve yardımcılar
```

## Modüller

- Dashboard
- Müvekkiller
- Dosyalar
- Tahsilatlar
- Giderler
- Masraf avansları
- Alacak/borç takibi
- Makbuz/fatura takibi
- Raporlar
- CSV/Excel export
- JSON/SQLite yedekleme
- Ayarlar

## Bildirimler

Hatırlatma kontrolü uygulama açıldığında, dashboard'a girildiğinde ve uygulama açıkken her 10 dakikada bir yapılır. Tarayıcı bildirimi kullanıcı izin verirse çalışır; izin verilmezse uygulama içi bildirim merkezi çalışmaya devam eder.

Tarayıcı bildirimi production ortamında HTTPS gerektirir. Localhost geliştirme ortamında tarayıcılar bu kural için genellikle istisna tanır.

Uygulama kapalıyken kesin bildirim için ileride cron/email/push entegrasyonu gerekir. İlk sürümde uygulama içi ve tarayıcı bildirimi desteklenmektedir.

## Veri ve Yedekleme

Aktif Prisma şeması SQLite provider kullanır. Veriler başlangıçta `prisma/dev.db` SQLite dosyasında tutulur.

Uygulama içinden:

- `/export` ekranı tüm müvekkil, dosya, tahsilat, gider ve makbuz/fatura kayıtlarını CSV olarak indirir.
- `/export` ekranı tüm CSV çıktıları tek ZIP paketi olarak indirebilir.
- `/backup` ekranı JSON yedek, CSV ZIP paketi ve ham SQLite dosyası indirir.
- JSON/CSV yedekleri silinen kayıtları, `deletedAt` bilgisini ve audit log kayıtlarını koruyacak şekilde hazırlanır.
- V3 JSON yedeği belge metadata, belge işleme logları, banka ekstresi import/satır kayıtları, işlem kuralları ve sermaye/varlık kayıtlarını içerir.
- Belge dosyalarının fiziksel içerikleri JSON/CSV yedeklerine gömülmez. `storage/documents` veya `DOCUMENT_STORAGE_DIR` altında kullanılan private storage klasörü ayrıca yedeklenmelidir.
- Banka ekstresi satırlarında `rawData` hassas finansal veri içerebilir. JSON yedekleri ve ham SQLite yedekleri şifreli saklanmalı, üçüncü kişilerle paylaşılmamalıdır.
- Raporlar, müvekkil cari, dosya finans, tahsilat/gider özeti ve kasa hareketleri için auth kontrollü server-side PDF çıktıları alınabilir.
- Türkçe karakterlerin sorunsuz görünmesi için production ortamında `PDF_FONT_PATH` ve gerekirse `PDF_FONT_BOLD_PATH` ile TTF font yolu tanımlanabilir.

Manuel SQLite yedeği almak için uygulamayı durdurup veritabanı dosyasını güvenli bir klasöre kopyalayın:

```bash
mkdir -p backups
cp prisma/dev.db "backups/hukuk-finans-$(date +%Y-%m-%d).db"
```

VPS profilinde otomatik yedek için:

```bash
npm run backup:sqlite
```

V3 belge merkezi, banka ekstresi, mutabakat ve sermaye tablolarıyla birlikte tam yedek için:

```bash
npm run backup:v3
npm run restore:v3:dry-run -- backups/buro-finans-v3-YYYY-MM-DD_HH-MM-SS
```

`backup:v3` veritabanını ve fiziksel private belge dosyalarını ayrı ayrı paketler:

- `database.sqlite` veya `database.pgcustom`: Prisma veritabanı yedeği ve V3 metadata tabloları.
- `document-storage-manifest.tsv`: private belge dosyalarının boyut ve SHA-256 listesi.
- `document-files.tar.gz`: fiziksel belge dosyaları.

Operasyonel ayrıntılar için [docs/OPERATIONS.md](docs/OPERATIONS.md) dosyasına bakın.

Cron örneği:

```cron
15 3 * * * cd /opt/buro-finans && BACKUP_DIR=/secure/backups npm run backup:sqlite >> /var/log/buro-finans-backup.log 2>&1
```

Restore örneği:

```bash
systemctl stop buro-finans
cp /secure/backups/buro-finans-sqlite-YYYY-MM-DD_HH-MM-SS.db prisma/dev.db
npm run db:deploy
systemctl start buro-finans
```

`DATABASE_URL` farklı bir SQLite dosyasını gösteriyorsa `.env` içindeki yolu esas alın. Yedek dosyalar kişisel veri ve finansal bilgi içerebilir. Güvenli yerde saklayınız.

Önerilen yedekleme rutini:

- Günlük kullanım sonunda CSV ZIP veya JSON yedek alın.
- VPS kullanımında günlük otomatik SQLite yedeği alın.
- Haftada en az bir kez ham SQLite dosyasını harici bir diske veya şifreli bulut klasörüne kopyalayın.
- Yedek dosya adlarında tarih kullanın.
- Yedekleri restore etmeden önce `.sha256` kontrolünü yapın.
- Yedekleri üçüncü kişilerle paylaşmayın; müvekkil bilgisi ve finansal veri içerir.
- Belgeler için veritabanı yedeği tek başına yeterli değildir; private storage klasörü ve veritabanı aynı zaman diliminden yedeklenmelidir.

## Güvenlik Notları

- Oturum cookie'si `httpOnly`, `sameSite=lax` ve production ortamında `secure` olarak ayarlanır.
- `AUTH_SECRET` veya `SESSION_SECRET` en az 32 karakter olmalıdır; production ortamında kısa veya eksik secret ile çalıştırılmaz.
- `APP_URL` production ortamında HTTPS adresi olmalıdır. Production middleware bu değeri doğrular.
- Production ortamında HTTP istekleri HTTPS'e yönlendirilir.
- Şifreler düz metin tutulmaz; `scrypt` + rastgele salt ile hashlenir.
- İlk kullanıcı şifresi en az 10 karakter, büyük/küçük harf ve rakam içermelidir; production için uzun, benzersiz ve tahmin edilemez şifre kullanın.
- Login endpointinde IP + e-posta bazlı basit in-memory rate limit uygulanır. Bu tek Node/VPS kullanım için temel korumadır; serverless/cloud ortamında WAF veya hosting sağlayıcısı rate limit'i de açılmalıdır.
- Login hata mesajı bilinçli olarak geneldir: e-posta var/yok bilgisi sızdırılmaz.
- Auth olmayan kullanıcılar middleware ve protected layout ile dashboard ve modüllere alınmaz.
- Mutating isteklerde temel CSRF koruması için origin / fetch-site kontrolü yapılır.
- XSS riskini azaltmak için React escape davranışı korunur.
- Güvenlik başlıkları: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, temel `Content-Security-Policy` ve production HTTPS altında `Strict-Transport-Security`.
- Ana finans tablolarında `userId` sahipliği vardır. Tüm listeleme, rapor, export ve JSON yedekleme sorguları oturumdaki kullanıcının verisiyle sınırlandırılır.
- Ham SQLite yedeği tek kullanıcı yerel kullanım içindir. İleride çok kullanıcıya geçilirse kullanıcı bazlı yedek formatı tercih edilmelidir.
- Belge yükleme sadece auth olan kullanıcıya açıktır; MIME tipi, uzantı, boyut limiti, sanitize dosya adı, UUID storage adı, SHA-256 duplicate hash kontrolü ve path traversal engeli uygulanır.
- Belgeler `public` klasörüne yazılmaz; private storage alanından yalnızca auth kontrollü indirme/önizleme route'ları ile servis edilir. Bu route'larda hassas veri için `no-store` cache header'ları kullanılır.
- Banka ekstresi `rawData`, belge `extractedText` ve sermaye/portföy değerleri hassas veri kabul edilir. Loglarda ham ekstre veya tam belge metni basılmamalıdır.
- Dashboard ve platform genelinde header'daki göz ikonu ile gizlilik modu açılabilir. Bu mod ekran paylaşımı sırasında tutarları `•••••` olarak maskeler; localStorage tercihi yalnızca client mount sonrası uygulanır ve hydration farkı üretmez.
- `.env` dosyasını git'e eklemeyin; sadece `.env.example` paylaşılmalıdır.
- Production öncesi `npm run typecheck`, `npm run lint`, `npm run build` ve `npm audit --omit=dev` komutlarını çalıştırın.
- `npm audit fix --force` komutunu otomatik kullanmayın; breaking change yaratabilir.

## Production Checklist

Yayına almadan önce:

```bash
npm install
npm run db:deploy
npm run typecheck
npm run lint
npm run build
docker compose config
```

Kontrol listesi:

- `NODE_ENV=production`
- `APP_URL=https://alan-adiniz`
- Docker Compose kullanılıyorsa `DOCKER_APP_URL=https://alan-adiniz`
- `AUTH_SECRET` veya `SESSION_SECRET` en az 32 karakter
- `ADMIN_PASSWORD` güçlü ve benzersiz
- HTTPS reverse proxy veya hosting TLS aktif
- SQLite kullanılıyorsa kalıcı disk ve otomatik yedek aktif
- Cloud/serverless kullanılıyorsa kalıcı production database aktif
- `/backup`, `/export` ve CSV/JSON export akışı korunmuş
- Silinen kayıtlar ve audit log export kapsamına dahil
- `DOCUMENT_STORAGE_DIR` private, kalıcı ve public web root dışında
- Belge preview/download route'ları auth kontrollü ve `no-store` cache header'ları döndürüyor
- `docker compose config` temiz
- `npm run backup:v3` ve restore dry-run düzenli test edilmiş

V3 production operasyonları için:

```bash
docker compose config
docker compose build app
docker compose up -d app caddy
docker compose exec app npx prisma migrate deploy
docker compose exec app node -e "fetch('http://127.0.0.1:3000/api/health',{headers:{'x-forwarded-proto':'https'}}).then(async r => console.log(r.status, await r.text()))"
```

## Deployment Seçenekleri

### 1. Local Bilgisayarda Kullanım

Tek avukat ve düşük maliyetli ilk kullanım için en basit seçenektir.

```bash
npm install
npm run setup
npm run build
npm run start
```

Avantajları:

- Veriler yerel SQLite dosyasında kalır.
- Banka/GİB/ERP entegrasyonu gerekmez.
- Yedekleme dosya kopyalama ile yapılabilir.

Dikkat edilmesi gerekenler:

- Bilgisayar kapanırsa uygulama da kapanır.
- Düzenli SQLite yedeği alınmalıdır.
- Disk şifreleme ve güçlü oturum şifresi kullanılmalıdır.

### 2. Profil A - Düşük Maliyetli VPS + SQLite

Küçük bir VPS üzerinde Node.js + SQLite ile çalıştırılabilir. Bu profil tek avukat, düşük trafik ve tek kullanıcı senaryosu için uygundur.

Önemli kurallar:

- SQLite dosyası kalıcı diskte tutulmalıdır.
- `DATABASE_URL` güvenli ve yedeklenen bir konumu göstermelidir.
- Sunucuda disk şifreleme, firewall ve düzenli sistem güncellemesi yapılmalıdır.
- Günlük otomatik yedek ve dönemsel restore testi zorunlu kabul edilmelidir.

Özet adımlar:

```bash
git clone <repo-url>
cd <proje-klasoru>
cp .env.example .env
npm install
npm run db:deploy
npm run db:seed
npm run build
npm run start
```

Örnek `.env`:

```text
NODE_ENV="production"
APP_URL="https://finans.alan-adiniz.com"
DATABASE_URL="file:/var/lib/buro-finans/production.db"
AUTH_SECRET="en-az-32-karakterlik-rastgele-secret"
SESSION_SECRET="en-az-32-karakterlik-rastgele-secret"
ADMIN_EMAIL="avukat@alan-adiniz.com"
ADMIN_PASSWORD="cok-guclu-bir-sifre"
```

Systemd veya process manager kullanın:

```bash
npm run build
npm run start
```

HTTPS için Nginx/Caddy reverse proxy kullanın. Reverse proxy `X-Forwarded-Proto: https` başlığını iletmelidir.

Günlük yedek:

```bash
BACKUP_DIR=/secure/backups npm run backup:sqlite
```

Restore:

```bash
systemctl stop buro-finans
cp /secure/backups/buro-finans-sqlite-YYYY-MM-DD_HH-MM-SS.db /var/lib/buro-finans/production.db
npm run db:deploy
systemctl start buro-finans
```

Production kullanımda öneriler:

- `AUTH_SECRET`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` değerlerini değiştirin.
- Uygulamayı `pm2` veya systemd ile servis olarak çalıştırın.
- SQLite dosyasını uygulama klasörü dışında kalıcı ve erişimi sınırlı bir dizinde tutun.
- `scripts/backup-sqlite.sh` ile günlük yedek alın.
- Sunucuda firewall açın, sadece SSH/HTTP/HTTPS portlarını bırakın.

Docker Compose ile VPS yayını:

```bash
cp .env.example .env
# .env içinde APP_DOMAIN, DOCKER_APP_URL, AUTH_SECRET ve SESSION_SECRET değerlerini düzenleyin.
docker compose config
docker compose build app
docker compose up -d app caddy
```

Varsayılan compose profili üç kalıcı volume kullanır:

- `app-sqlite-data`: SQLite database dosyası
- `private-documents`: V3 belge merkezi fiziksel dosyaları
- `app-backups`: yedek çıktıları

Caddy reverse proxy Next.js uygulamasını internetten ayırır, HTTPS sonlandırır, upload body limitini 25 MB ile sınırlar ve `/api/documents/[id]/preview` ile `/api/documents/[id]/download` için hassas veri cache header'larını korur.

Compose, container içinde güvenli varsayılan olarak `DOCKER_APP_URL=https://localhost`, `DOCKER_DATABASE_URL=file:/data/production.db`, `DOCKER_DOCUMENT_STORAGE_DIR=/app/storage/documents` ve `DOCKER_BACKUP_DIR=/app/backups` kullanır. Gerçek domain, harici Postgres veya özel volume yolu için bu `DOCKER_*` değişkenlerini `.env` içinde ayrıca tanımlayın.

V3 tam yedek:

```bash
docker compose exec app npm run backup:v3
docker compose exec app npm run restore:v3:dry-run -- /app/backups/buro-finans-v3-YYYY-MM-DD_HH-MM-SS
```

### 3. Profil B - Cloud/Serverless + Production Database

Vercel ve benzeri serverless ortamlarda dosya sistemi ephemeral olabilir. Bu nedenle SQLite dosya tabanlı kalıcı veri için uygun değildir. Bu profilde PostgreSQL gibi kalıcı production database kullanılmalıdır.

Önerilen yaklaşım:

- PostgreSQL, Neon, Supabase, Railway, Render Postgres veya yönetilen benzeri bir veritabanı seçin.
- `DATABASE_URL` production environment variable olarak hosting paneline girilir.
- `APP_URL` HTTPS production domain olarak girilir.
- `AUTH_SECRET` veya `SESSION_SECRET` en az 32 karakterlik rastgele değer olmalıdır.
- Dosya tabanlı SQLite yedekleme yerine veritabanı sağlayıcısının backup/snapshot sistemi kullanılır.

Örnek environment:

```text
NODE_ENV="production"
APP_URL="https://finans.alan-adiniz.com"
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
AUTH_SECRET="en-az-32-karakterlik-rastgele-secret"
SESSION_SECRET="en-az-32-karakterlik-rastgele-secret"
ADMIN_EMAIL="avukat@alan-adiniz.com"
ADMIN_PASSWORD="cok-guclu-bir-sifre"
```

Production migration notu:

Aktif repo şeması SQLite provider ile gelir:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

PostgreSQL profiline geçilecekse ayrı bir production branch veya ayrı bir Prisma schema hazırlanmalı, provider `postgresql` yapılmalı ve migrationlar PostgreSQL için yeniden üretilmelidir. Önerilen sıra:

```bash
# PostgreSQL provider'lı schema hazırlandıktan sonra
npm run prisma:generate
npx prisma migrate dev --name init_postgres
npx prisma migrate deploy
npm run build
```

Serverless deployment sırasında:

- `prisma migrate deploy` build/deploy pipeline içinde çalıştırılmalıdır.
- Seed komutu production verisini ezebileceği için dikkatle kullanılmalıdır.
- Harici veritabanının otomatik backup/snapshot özelliği açılmalıdır.
- Büyük export dosyaları için hosting timeout limitleri kontrol edilmelidir.
- Private belge storage için S3/NAS/persistent volume benzeri kalıcı ve auth kontrollü bir alan gerekir. Mevcut kodda `LocalDocumentStorage` aktiftir; S3 benzeri storage adapter interface seviyesinde bırakılmıştır.
- Serverless ephemeral filesystem üzerinde `storage/documents` kalıcı kabul edilmemelidir.

Bu seçenek ilk sürüm için zorunlu değildir; düşük maliyetli yerel veya VPS kullanım daha uygundur.

## Notlar

Bu sürümde banka API, GİB/e-SMM/e-Fatura, ERP ve kurumsal cloud entegrasyonları yoktur. Makbuz/fatura ekranı yalnızca takip amaçlıdır; resmi belge düzenleme entegrasyonu değildir.
