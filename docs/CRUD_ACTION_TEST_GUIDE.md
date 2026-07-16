# CRUD Action Test Guide

Bu rehber, Codex sandbox port acamadiginda Mac uzerinde manuel/Playwright dogrulama icin kullanilir.

## Hazirlik

Uygulamayi baslat:

```bash
cd "/Users/bugra/Documents/Codex/2026-07-04/bir-hukuk-b-rosunda-yaln-zca-2"
zsh START_LOCAL.command
```

Script hangi portu sectiyse onu kullan. Varsayilan:

```bash
export PLAYWRIGHT_BASE_URL=http://localhost:3000
```

Eger script `3010` yazarsa:

```bash
export PLAYWRIGHT_BASE_URL=http://localhost:3010
```

## Hedefli Playwright Testi

```bash
npx playwright test tests/e2e/crud-actions-recovery.spec.ts --project=chromium-desktop
```

## Mevcut Release Gate CRUD Testi

```bash
npx playwright test tests/e2e/v3-release-gates.spec.ts --grep "core CRUD" --project=chromium-desktop
```

## Manuel Kontrol Listesi

- `/clients`: Müvekkil düzenle, sil/arşivle, `/settings/deleted-records` üzerinden geri al.
- `/cases`: Dosya düzenle, sil/arşivle, geri al.
- `/collections`: Tahsilat düzenle, sil, geri al; bağlı kasa hareketinin güncellendiğini `/cash/ledger` üzerinden kontrol et.
- `/expenses`: Gider düzenle, sil, geri al; bağlı kasa hareketini kontrol et.
- `/receipts`: Taslak belgeyi sil, kesilmiş belgeyi iptal et.
- `/documents`: Belge metadata düzenle, sil, geri al; preview/download auth kontrollü kalmalı.
- `/documents/missing`: Mevcut belge bağla, belge gerekmiyor işaretle.
- `/reconciliation`: Banka hareketini yoksay, geri al, var olan kayıtla eşleştir, eşleşmeyi kaldır.
- `/bank-statements/[id]/analysis`: Banka hareketinden tahsilat/gider/kasa hareketi oluştur, sonra geri al.
- `/cash/accounts`: Kasa hesabı düzenle, sil/arşivle, geri al.
- `/reminders`: Hatırlatma düzenle, tamamla/aç, sil, geri al, gider olarak öde.
- `/capital`: Varlık düzenle, değer güncelle, sil, geri al.

## Beklenen Sonuc

- Silme islemleri hard delete yapmaz; `deletedAt` set edilir.
- Geri alma `deletedAt` alanini temizler.
- Tahsilat/gider update ve restore islemlerinde duplicate `CashLedgerEntry` olusmaz.
- Modal/dialog basari sonrasi kapanir.
- Sayfa `router.refresh()` ile güncellenir.
- Audit log kritik islemler icin kayit yazar.

