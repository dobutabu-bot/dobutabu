# CRUD Action Fix Report

Tarih: 2026-07-10

## Durum

Yeni ozellik eklenmedi. Mevcut CRUD/aksiyon altyapisinda gorunen ama eksik baglanan geri alma akislari onarildi.

## Duzeltilen Moduller

- Silinen Belgeler: `documents` restore endpoint ve ayarlar ekrani sekmesi eklendi.
- Silinen Banka Ekstresi Importlari: `bank-imports` restore endpoint ve ayarlar ekrani sekmesi eklendi.
- Silinen Kasa Hesaplari: `cash-accounts` restore endpoint ve ayarlar ekrani sekmesi eklendi.
- Silinen Hatirlatmalar: `reminders` restore endpoint ve ayarlar ekrani sekmesi eklendi.
- Silinen Sermaye/Varlik Hesaplari: `assets` restore endpoint ve ayarlar ekrani sekmesi eklendi.

## Root Cause

V1/V2 kayitlari icin restore akisi mevcuttu; ancak V3 kayit tipleri icin soft-delete servisleri bulunmasina ragmen `/settings/deleted-records` ekranina ve `/api/deleted-records/[recordType]/[id]/restore` route'una baglanmamis durumdaydi. Bu nedenle ilgili kayitlar soft-delete olduktan sonra UI'dan geri alinamiyordu.

## Degisen Dosyalar

- `src/lib/restore-service.ts`
- `src/app/api/deleted-records/[recordType]/[id]/restore/route.ts`
- `src/app/(app)/settings/deleted-records/page.tsx`
- `tests/e2e/crud-actions-recovery.spec.ts`
- `docs/CRUD_ACTION_AUDIT.md`
- `docs/CRUD_ACTION_TEST_GUIDE.md`
- `docs/CRUD_ACTION_FIX_REPORT.md`

Not: Daha onceki yerel kurtarma calismasindan kalan `START_LOCAL.command`, `STOP_LOCAL.command`, `docs/LOCAL_RECOVERY_AUDIT.md`, `docs/LOCAL_WORKING_VERSION.md` ve `recovery-backups/` dosyalari bu CRUD onariminin ana kod degisikligi degildir.

## Test Sonuclari

- `npx prisma generate`: PASS
- `npm run test`: PASS
  - Finansal invariants: PASS
  - Belge guvenligi servis testleri: PASS
  - Banka import QA: PASS
  - Mutabakat guvenligi: PASS
  - PDF renderer: PASS
  - Server gerektiren iki API alt testi, localhost o anda yoksa mevcut test tasarimi geregi skip olabilir.
- `npx playwright test tests/e2e/crud-actions-recovery.spec.ts --project=chromium-desktop`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS

## Manuel Test Komutu

```bash
cd "/Users/bugra/Documents/Codex/2026-07-04/bir-hukuk-b-rosunda-yaln-zca-2"
zsh START_LOCAL.command
export PLAYWRIGHT_BASE_URL=http://localhost:3000
npx playwright test tests/e2e/crud-actions-recovery.spec.ts --project=chromium-desktop
```

Eger `START_LOCAL.command` baska port secerse `PLAYWRIGHT_BASE_URL` de o porta gore degistirilmelidir.

## Kalan Blocker

Codex sandbox bazen manuel `npm run dev` ile port acmayi `listen EPERM` nedeniyle engelleyebiliyor. Playwright bu turda kendi webServer akisi ile test dosyasini calistirabildi ve PASS aldi. Mac uzerinde Finder/Terminal ile `START_LOCAL.command` kullanimi korunmustur.

