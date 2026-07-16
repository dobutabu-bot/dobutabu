# UI V4 Baseline

Tarih: 2026-07-10 19:52 Europe/Istanbul

Bu dokuman, V4 premium UI ve performans calismasina baslamadan once mevcut calisan yapinin guvenli durum kaydidir. Bu asamada yeni ozellik eklenmedi, veritabani sifirlanmadi, migration reset calistirilmadi ve branch degistirilmedi.

## Proje Durumu

- Proje dizini: `/Users/bugra/Documents/Codex/2026-07-04/bir-hukuk-b-rosunda-yaln-zca-2`
- Aktif branch: `deployment-rescue`
- Veritabani: `prisma/dev.db`
- Storage klasoru: `storage`
- Storage dosya sayisi: `541`

## Calisma Agaci Notu

V4 calismasina baslamadan once calisma agacinda daha onceki kurtarma/RC calismalarindan kalan degisiklikler vardi. Bu dosyalara bu asamada dokunulmadi ve geri alinmadi.

Mevcut durumdaki dikkat ceken degisiklikler:

- `.gitignore`
- `fixtures/bank-statements/pdf-fallback-ekstre.pdf`
- `fixtures/generated-pdfs/long-table-quality.pdf`
- `src/app/(app)/settings/deleted-records/page.tsx`
- `src/app/api/deleted-records/[recordType]/[id]/restore/route.ts`
- `src/lib/restore-service.ts`
- `STOP_LOCAL.command`
- `docs/CRUD_*`
- `docs/LOCAL_*`
- `tests/e2e/crud-*`
- `recovery-backups/`

## Guvenli Yedek

Olusturulan yedek:

`recovery-backups/ui-v4-before-20260710-1952.zip`

Yedek boyutu:

`3.7M`

Yedege dahil edildigi dogrulanan kritik dosya:

- `prisma/dev.db`

Yedek disinda birakilan klasorler:

- `node_modules`
- `.next`
- `test-results`
- `playwright-report`
- `recovery-backups`
- `.git`

Not: `recovery-backups` klasoru, yedegin kendi icine veya onceki yedeklere tekrar girmemesi icin arsive dahil edilmedi.

## Veri Sayimlari

V4 UI calismasi oncesi mevcut veri sayimlari:

| Kayit tipi | Sayi |
| --- | ---: |
| Muvekkiller | 54 |
| Dosyalar | 81 |
| Tahsilatlar | 324 |
| Giderler | 341 |
| Belgeler | 536 |
| Banka hareketleri | 768 |
| Sermaye kayitlari | 20 |

## Korunan Kurallar

Bu baseline asamasinda asagidaki kurallar korundu:

- Mevcut veritabani silinmedi.
- Prisma migrate reset calistirilmadi.
- Mevcut kayitlar veya test verileri silinmedi.
- Finans hesaplama mantigina dokunulmadi.
- CRUD, soft delete, restore, audit log ve ledger baglantilari degistirilmedi.
- Banka mutabakat kurallari degistirilmedi.
- GitHub, Railway, Docker veya deploy islemi yapilmadi.
- Branch degistirilmedi.

## Sonuc

Baseline ve recovery yedegi hazir. V4 premium UI/performance calismasina gecmeden once mevcut veri ve dosya yapisi korunmus durumdadir.
