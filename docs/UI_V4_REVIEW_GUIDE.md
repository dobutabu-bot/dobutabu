# UI V4 Inceleme Rehberi

Bu rehber, Büro Finans Paneli'nin güncel yerel sürümünü incelemek için hazırlanmıştır. Bu çalışma yayın/deploy görevi değildir; uygulama local makinede çalıştırılır.

## Uygulamayı nasıl açacağım?

1. Finder'da proje klasörünü aç:
   `/Users/bugra/Documents/Codex/2026-07-04/bir-hukuk-b-rosunda-yaln-zca-2`
2. `START_LOCAL.command` dosyasına çift tıkla.
3. Terminal penceresi açık kalsın. Terminal kapanırsa uygulama da kapanır.
4. Script eski yerel server'ı güvenli şekilde kapatır, local SQLite veritabanını kullanır ve uygun portu seçer.

Script port seçiminde önce `3000` kullanır. Bu port doluysa `3010` kullanır.

Gerektiğinde cache temiz başlatma:

```bash
cd "/Users/bugra/Documents/Codex/2026-07-04/bir-hukuk-b-rosunda-yaln-zca-2"
CLEAN_NEXT=1 ./START_LOCAL.command
```

veya:

```bash
./START_LOCAL.command --clean
```

## Hangi linke gireceğim?

Script başarılı açıldığında Terminal içinde net link basar:

```text
http://localhost:PORT/dashboard
```

Beklenen örnekler:

- `http://localhost:3000/dashboard`
- `http://localhost:3010/dashboard`

Giriş gerekirse local demo bilgileri:

- E-posta: `avukat@example.com`
- Şifre: `DemoAvukat2026!`

## Telefon aynı Wi-Fi'daysa

`START_LOCAL.command`, makinenin local IP adresini bulabilirse ayrıca şu formatta telefon linki basar:

```text
http://LOCAL_IP:PORT/dashboard
```

Örnek:

```text
http://192.168.1.25:3000/dashboard
```

Telefon ve Mac aynı Wi-Fi ağında olmalıdır. macOS firewall izin istemi gösterirse Node/Terminal için yerel ağ erişimine izin verilmelidir.

## Hangi ekranları kontrol edeceğim?

Öncelikli V4 inceleme ekranları:

1. `/dashboard`
2. `/advances`
3. `/clients`
4. `/cases`
5. `/collections`
6. `/expenses`
7. `/receipts`
8. `/documents`
9. `/cash`
10. `/cash/ledger`
11. `/bank-statements`
12. `/bank-statements/analysis`
13. `/reconciliation`
14. `/capital`
15. `/reports`
16. `/settings`

Özellikle `/advances` ekranında formun sayfada sürekli açık olmaması, kayıtların sayfalı görünmesi ve mobil/desktop görünümün aynı anda üst üste basılmaması kontrol edilmelidir.

## CRUD nasıl test edilecek?

Her ana modülde şu akış kısa şekilde denenmelidir:

1. Yeni kayıt oluştur.
2. Kaydı düzenle.
3. Liste araması ile kaydı bul.
4. Filtre ve sayfalama davranışını kontrol et.
5. Detay ekranına gir.
6. Belge paneli varsa belge bağlama alanını kontrol et.
7. Sil/Arşivle/İptal Et aksiyonunda confirm dialog açıldığını doğrula.
8. Onay verildiğinde kayıt normal listeden kalkıyor mu bak.
9. Silinen kayıtlar/geri alma ekranında restore akışını kontrol et.
10. İşlem sonrası toast/bildirim ve audit log davranışını kontrol et.

Kontrol edilecek aksiyonlar:

- Düzenle
- Sil
- Arşivle
- Geri Al
- İptal Et
- Modal
- Drawer
- Pagination
- Filtre
- Arama
- Mobil menü
- Desktop sidebar
- PDF/print

## Ekran görüntülerinin konumu

Planlanan V4 review screenshot klasörü:

```text
artifacts/ui-v4-review/
```

Bu Codex sandbox ortamında Chromium başlatma izni nedeniyle otomatik screenshot üretimi engellenmiştir. Klasörde şu kanıt dosyası bulunabilir:

```text
artifacts/ui-v4-review/SCREENSHOT_CAPTURE_FAILED.txt
```

Normal macOS Terminal veya CI ortamında screenshot üretmek için:

```bash
npm run ui:v4:screenshots
```

## Bilinen eksikler

- Bu sandbox içinde Playwright Chromium başlatılamadığı için gerçek browser screenshot ve E2E aksiyon kanıtı üretilemedi.
- Sandbox içinde dev server port açma denemeleri sistem izni nedeniyle başarısız olabilir. `START_LOCAL.command` normal macOS kullanıcı ortamı için hazırlanmıştır.
- Production deploy bu rehberin kapsamı dışındadır.
- Banka PDF import hâlâ düşük güvenli fallback olarak değerlendirilmelidir; CSV/XLSX önerilir.
- Taranmış PDF OCR kapsamı sınırlıdır; görsel OCR ayrı worker hattına bağlıdır.

## Performans sonucu

Son yerel kod kalite kontrollerinde:

- `npx prisma generate`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run test`: PASS

Playwright browser testleri bu sandbox içinde Chromium MachPort izni nedeniyle BLOCKED durumundadır. Normal Terminal/CI ortamında tekrar çalıştırılmalıdır.

Önerilen browser testleri:

```bash
npx playwright test tests/e2e/crud-runtime-verification.spec.ts --project=chromium-desktop
npx playwright test tests/e2e/crud-actions-recovery.spec.ts --project=chromium-desktop
npx playwright test tests/e2e/v3-responsive-regression.spec.ts --project=chromium-desktop
npx playwright test tests/e2e/v3-release-gates.spec.ts --grep "console" --project=chromium-desktop
```

## Onay sonrası yapılacaklar

1. Kullanıcı görsel incelemede kritik sorun bildirmezse V4 UI değişiklikleri için ayrı commit hazırlanır.
2. Normal macOS Terminal veya CI ortamında Playwright CRUD/responsive/console testleri çalıştırılır.
3. Başarılı testlerden sonra screenshot paketi `artifacts/ui-v4-review/` altında tamamlanır.
4. Production veya Railway deploy istenirse ayrı deployment görevi açılır.
