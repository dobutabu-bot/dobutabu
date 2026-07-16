# CRUD Runtime Verification

Tarih: 2026-07-10

Bu çalışma, düzenle/sil/arşivle/geri al/iptal aksiyonlarının gerçek tarayıcı arayüzünde doğrulanması için hazırlandı. Yeni özellik eklenmedi; mevcut CRUD ve soft delete yapısı değiştirilmedi.

## Ortam

| Kontrol | Sonuç |
| --- | --- |
| Branch | `deployment-rescue` |
| `DATABASE_URL` | `file:./dev.db` |
| SQLite veri seti | Beklenen aktif veri setiyle uyumlu |
| Müvekkil sayısı | 54 |
| Dosya sayısı | 81 |
| Tahsilat sayısı | 324 |
| Gider sayısı | 341 |
| Belge sayısı | 536 |
| Banka hareketi sayısı | 768 |
| Sermaye kaydı sayısı | 20 |

## Cache ve Build Temizliği

Temizlenenler:

- `.next`
- `node_modules/.cache`
- `test-results`
- `playwright-report`

Silinmeyenler:

- `dev.db`
- `prisma/migrations`
- `storage`
- `recovery-backups`
- belge dosyaları

## Çalıştırılan Komutlar

| Komut | Sonuç |
| --- | --- |
| `npx prisma generate` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test` | PASS, 35 passed / 2 skipped |
| `npx playwright test tests/e2e/crud-runtime-verification.spec.ts --project=chromium-desktop` | BLOCKED |

## Runtime UI Testi

Yeni test dosyası:

- `tests/e2e/crud-runtime-verification.spec.ts`

Testin amacı:

- Login ekranından gerçek giriş yapmak.
- Geçici `CRUD-RT-*` kayıtlarıyla müvekkil, dosya, tahsilat, gider, makbuz/fatura, belge, hatırlatma, kasa hesabı, sermaye ve mutabakat aksiyonlarını UI üzerinden tıklamak.
- Silinen kayıtları `/settings/deleted-records` ekranından gerçek `Geri Al` butonuyla geri almak.
- Tahsilat/gider ledger duplicate oluşmadığını Prisma read-only assertions ile doğrulamak.
- Her ana modül için `test-results/crud-runtime-verification/` altında screenshot üretmek.

## Blocker

Gerçek UI testi bu ortamda tamamlanamadı.

Sebep:

1. In-app browser `http://localhost:3000/login` için `ERR_CONNECTION_REFUSED` gösteriyor.
2. `curl http://localhost:3000/api/health` bağlantı kuramıyor.
3. Codex sandbox içinde Next.js dev server port açarken `EPERM` alıyor:
   - `listen EPERM: operation not permitted ::1:3006`
4. Build sonrası Playwright production server moduna geçtiğinde mevcut/bozuk 3000 portuyla çakışma da görüldü:
   - `listen EADDRINUSE: address already in use 0.0.0.0:3000`

Bu nedenle gerçek tarayıcıda açılan uygulama ekranı üzerinden aksiyonlara tıklanamadı. Talimat gereği doğrulanmayan modüllere PASS verilmedi.

## Son Rapor Formatı

CRUD RUNTIME VERIFICATION

LOCAL URL:
`http://localhost:3000/login` bekleniyor, ancak bu ortamda bağlantı reddedildi.

HEALTH:
FAIL / BLOCKED

LOGIN:
BLOCKED

CLIENT EDIT:
BLOCKED

CLIENT DELETE:
BLOCKED

CLIENT RESTORE:
BLOCKED

CASE ACTIONS:
BLOCKED

COLLECTION ACTIONS:
BLOCKED

EXPENSE ACTIONS:
BLOCKED

RECEIPT ACTIONS:
BLOCKED

DOCUMENT ACTIONS:
BLOCKED

REMINDER ACTIONS:
BLOCKED

CASH ACCOUNT ACTIONS:
BLOCKED

CAPITAL ACTIONS:
BLOCKED

RECONCILIATION ACTIONS:
BLOCKED

BROWSER CONSOLE:
NOT CHECKED, uygulama ekranı açılamadı.

NETWORK REQUESTS:
FAIL / BLOCKED, local server erişilebilir değil.

DUPLICATE RECORD CHECK:
NOT CHECKED, UI aksiyonları çalıştırılamadı.

DATA PRESERVED:
YES. Veritabanı resetlenmedi; mevcut kayıtlar korunuyor.

SCREENSHOTS:
Üretilmedi. Test gerçek UI aşamasına geçemedi. Test başarılı çalıştığında hedef klasör:
`test-results/crud-runtime-verification/`

TYPECHECK:
PASS

LINT:
PASS

BUILD:
PASS

FINAL STATUS:
PARTIAL / BLOCKED

## Mac Üzerinde Tam Doğrulama İçin

Codex sandbox port açamadığı için gerçek Mac Terminal/Finder üzerinden uygulama başlatılmalı:

```bash
cd "/Users/bugra/Documents/Codex/2026-07-04/bir-hukuk-b-rosunda-yaln-zca-2"
zsh START_LOCAL.command
```

Uygulama açıldıktan sonra ayrı bir Terminal penceresinde:

```bash
cd "/Users/bugra/Documents/Codex/2026-07-04/bir-hukuk-b-rosunda-yaln-zca-2"
PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/crud-runtime-verification.spec.ts --project=chromium-desktop
```

Eğer `START_LOCAL.command` farklı port seçerse `PLAYWRIGHT_BASE_URL` o porta göre verilmelidir.

## Not

Bu rapor uygulama kodunun build/test tarafında sağlıklı olduğunu gösterir; fakat gerçek UI CRUD runtime doğrulaması, çalışan bir local server olmadan tamamlanmış sayılamaz.
