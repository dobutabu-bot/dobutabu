# V3 Release Gates

Bu belge V3'ün release'e hazır sayılması için geçmesi gereken kapıları tanımlar. Kural nettir: V1/V2 omurgası kırılmadan, V3 modülleri aynı kalite çizgisinden geçmelidir.

## Zorunlu Komutlar

```bash
npm run typecheck
npm run lint
npm run build
npx playwright test
docker compose config
docker build -t buro-finans-v3-ci .
```

Docker komutları Docker CLI kurulu olmayan yerel makinelerde çalışmayabilir. Bu durumda yerel raporda açıkça belirtilir; CI veya Docker kurulu staging makinesinde mutlaka çalıştırılır.

## Playwright Matrisi

Projeler:

- `chromium-desktop`
- `chromium-laptop`
- `firefox-desktop`
- `webkit-desktop`
- `tablet`
- `iphone`
- `android`

Kalıcı route gate'leri:

- `/login`
- `/dashboard`
- `/cash`
- `/cash/accounts`
- `/cash/ledger`
- `/clients`
- `/cases`
- `/collections`
- `/expenses`
- `/reminders`
- `/reports`
- `/settings`
- `/install`
- `/documents`
- `/documents/new`
- `/documents/missing`
- `/bank-statements`
- `/bank-statements/import`
- `/bank-statements/analysis`
- `/reconciliation`
- `/cash/reconciliation`
- `/capital`
- `/capital/assets`
- `/capital/history`
- `/capital/import`
- `/search`
- `/settings/transaction-rules`

## Release Blokerleri

Aşağıdakilerden biri varsa release verilmez:

- TypeScript, lint veya build hatası.
- Playwright'ta başarısız test.
- Hydration mismatch veya critical runtime console hatası.
- Auth olmayan belge preview/download erişimi.
- Public klasöre belge yazılması.
- Banka hareketinden onaysız kalıcı tahsilat/gider oluşturulması.
- Duplicate banka hareketinden ikinci finans kaydı oluşturulması.
- Soft delete kayıtlarının normal listelerde/raporlarda görünmesi.
- Decimal/Date/BigInt/Prisma nesnesinin Client Component'e ham geçmesi.
- V1/V2 CRUD, soft delete, audit log veya dijital kasa ledger senkronunun bozulması.

## CI Gate

`.github/workflows/ci.yml` şu sırayı uygular:

1. `npm ci`
2. `.env.example` üzerinden test env hazırlığı
3. `npm run db:deploy`
4. `npm run db:seed`
5. `npm run typecheck`
6. `npm run lint`
7. `npm run build`
8. `npx playwright install --with-deps chromium firefox webkit`
9. `npx playwright test`
10. `docker compose config`
11. `docker build -t buro-finans-v3-ci .`

## Geçme Kriteri

V3 release adayı yalnızca şu durumda "geçti" sayılır:

- Tüm zorunlu komutlar başarılıdır.
- Docker gate yerelde çalıştırılamadıysa CI/staging ortamında ayrıca başarılıdır.
- `docs/V3_TEST_REPORT.md` günceldir.
- `docs/V3_KNOWN_LIMITATIONS.md` günceldir.
- Yeni V3 özellikleri V1/V2 route ve veri modellerini rename/drop etmeden ilişki tabanlı üst katman olarak eklenmiştir.
