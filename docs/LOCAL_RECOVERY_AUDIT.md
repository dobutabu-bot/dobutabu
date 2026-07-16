# Local Recovery Audit

Tarih: 2026-07-10

## Kapsam

Bu dokuman, Railway/GitHub/Docker islemleri yapilmadan yalnizca yerel calisan surumu kurtarmak icin yapilan kontrolleri kaydeder.

## Mevcut Durum

- Aktif branch: `deployment-rescue`
- Son commit: `2959fc2 deploy: prepare V3-RC2 Railway SQLite deployment`
- Uygulama: Next.js + Prisma + SQLite
- Aktif veritabani: `prisma/dev.db`
- Belge storage: `storage/documents`

## Korunan Veriler

Kurtarma oncesinde veriler silinmeden yedeklendi.

- Proje yedegi: `recovery-backups/buro-finans-before-recovery-20260710-1909.zip`
- Veritabani yedegi: `recovery-backups/buro-finans-database-before-recovery-20260710-1909.db`

Not: Ilk hedeflenen ust klasor macOS sandbox izni nedeniyle yazilabilir degildi. Bu nedenle yedekler proje icindeki `recovery-backups/` klasorune alindi.

## Veri Sayimlari

Prisma Client ile aktif SQLite veritabani uzerinden dogrulanan kayit sayilari:

- Client: 54
- CaseFile: 81
- Income: 324
- Expense: 341
- InvoiceOrReceipt: 122
- CashAccount: 10
- CashLedgerEntry: 586
- Document: 536
- BankStatementRow: 768
- AssetAccount: 20

## Yapilan Minimum Duzeltmeler

- `START_LOCAL.command` yerel acilis icin guclendirildi.
- `STOP_LOCAL.command` eklendi.
- Iki dosya da macOS Finder'dan cift tiklanabilir hale getirildi.
- Prisma Client tekrar uretildi.

## Kalite Kontrolleri

- `npx prisma generate`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS

## Git Notu

Bu kurtarma fazinda yeni ozellik eklenmedi ve deployment/GitHub push islemi yapilmadi. `.env`, secret, SQLite veritabani, `storage/` ve `backups/` gibi hassas/yerel dosyalar commit kapsamina alinmamalidir.

## Kalan Dogrulama

Yerel dev server baslatilip asagidaki endpointler HTTP ile dogrulanmalidir:

- `/api/health`
- `/login`
- `/dashboard`

