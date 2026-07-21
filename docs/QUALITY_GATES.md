# Quality Gates

Bu dokuman, Buro Finans Paneli icin merge, staging ve production release kararinin asgari kanitlarini tanimlar. Testleri gecirmek amaciyla urun davranisi veya test beklentileri gevsetilmez.

## 1. Degisiklik Oncesi

- Calisma agaci ve aktif branch kaydedilir.
- Kullaniciya ait ilgisiz degisiklikler revert edilmez.
- Database, storage, `.env`, backup ve runtime loglari Git kapsaminda olmaz.
- Veri modelini veya production verisini etkileyen calismada once database ve document-storage backup'i dogrulanir.
- Rollback birimi commit, tag veya geri alinabilir migration olarak belirlenir.

## 2. Kod Kalitesi

Her kod degisikliginde:

```bash
npx prisma generate
npm run typecheck
npm run lint
npm run build
npm run test
```

Prisma, TypeScript, ESLint, production build ve unit/integration testlerinden biri fail ise merge/deploy yoktur.

## 3. GitHub Actions zorunlu kapisi

`.github/workflows/quality-gates.yml` su bagimsiz kanitlari uretir:

- Secret ve private data taramasi
- Prisma generate, typecheck, lint ve production build
- Tam unit/integration paketi
- PDF unit/integration paketi
- Chromium, Firefox ve WebKit Playwright matrisi
- Desktop ve mobil gercek PDF download/parse matrisi
- Masaustu ve mobil kritik route smoke matrisi
- `.next` artifact route, JS/CSS ve private dosya kontrolu

Butun isler basarili oldugunda yalnizca `Quality Gates / Required quality gate` sonucu basarili olur. Matrix alt islerinden biri fail, cancel veya skip olursa final kapi da fail olur.

## 4. Hedefli testler

| Alan | Zorunlu kanit |
| --- | --- |
| Finans/ledger | Create-update-delete, duplicate ledger, transfer ve Decimal invariant |
| Belge | Auth, private preview/download, soft delete, storage ve MIME/size |
| PDF | Route auth, MIME, filename, `%PDF-`, minimum boyut, parser ve gercek browser download |
| UI | Gercek browser aksiyonu, console/network error, responsive ve 44px touch target |
| Banka/mutabakat | Deterministic rule, ambiguity, user confirmation ve undo |
| Sermaye | Debt, valuation history, net worth ve duplicate CashAccount korumasi |

Playwright testi gercek kullanici akisinda butona tiklamalidir. Yalniz API cagrisi UI kaniti sayilmaz.

## 5. PDF release kapisi

Her PDF route'u icin auth, `application/pdf`, guvenli attachment dosya adi, `%PDF-` imzasi, anlamli boyut, parse edilebilir en az bir sayfa, Turkce karakter, Chromium/Firefox/WebKit download event'i ve mobil profil kaniti gerekir. HTML/JSON hata cevabi PDF kabul edilmez.

## 6. Staging ve production

Staging'de `prisma migrate deploy`, `/api/health`, authenticated smoke, PDF matrisi, backup/restore dry-run ve document volume persistence PASS olmalidir. Ortam yoksa sonuc `BLOCKED` veya `STAGING-PENDING` olur.

Production oncesi:

- `main` branch protection aktiftir.
- `Quality Gates / Required quality gate` zorunludur.
- Railway `Wait for CI` aciktir.
- Backup ve immutable rollback commit/tag hazirdir.

Production sonrasinda HTTPS health, login, kritik route, PDF matrisi, console/network, veri sayimlari ve restart persistence yeniden dogrulanir.

## 7. Karar durumlari

- `GO`: Tum zorunlu testler ve staging/production kanitlari PASS.
- `STAGING-PENDING`: Kod/testler PASS, staging kaniti BLOCKED.
- `NO-GO`: Kritik test, finansal dogruluk, private belge, PDF, health veya veri butunlugu fail.
- `BLOCKED`: Uygulama hatasi olmayan ortam/yetki eksikligi.

## 8. GitHub ve Railway ayarlari

GitHub `main` icin pull request, branch guncelligi, `Quality Gates / Required quality gate`, force-push ve branch silme korumalari uygulanir. Railway production servisinde `Wait for CI` acilir. Bu repository-dis ayarlar yetki veya plan nedeniyle dogrulanamiyorsa test devre disi birakilmaz ve durum `BLOCKED` raporlanir.
