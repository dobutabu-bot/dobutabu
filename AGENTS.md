# Buro Finans Paneli Proje Sozlesmesi

Bu dosya repository kokunde ve alt dizinlerinde yapilan tum Codex calismalari icin zorunludur. Daha dar kapsamli bir `AGENTS.md` bu kurallari gevsetemez.

## Proje Koruma

- Veritabani resetlenmez. `prisma migrate reset` calistirilmaz.
- Development, staging veya production ortaminda otomatik seed calistirilmaz.
- Mevcut Prisma migration gecmisi silinmez, yeniden adlandirilmaz veya yeniden yazilmaz. Yeni schema degisikligi ileri yonlu ve veri koruyan migration ile yapilir.
- Kullanici verisi, audit log, private document storage, backup ve volume icerigi silinmez.
- `.env*`, secret, token, cookie, SQLite `.db` dosyalari, storage, belgeler, backup, runtime log ve hassas export Git'e eklenmez.
- Production `main` uzerinde dogrudan feature gelistirilmez. Feature/hotfix ayri branch, kalite kapisi ve kontrollu birlestirme akisi kullanir.
- Production verisini etkileyen islemden once dogrulanmis database ve document-storage backup'i ile geri donus plani hazirlanir.

## Kod Sinirlari

- Server Component'ten Client Component'e function/callback prop gecirilmez; serializable config ve route/action kontratlari kullanilir.
- `Date`, Prisma `Decimal`, `BigInt` veya Prisma entity nesnesi Client Component'e dogrudan gonderilmez. Ortak serialization yardimcilariyla string/number/plain object uretilir.
- Client Component icinden Prisma cagrisi yapilmaz. Database erisimi server service, route handler veya server action sinirinda kalir.
- Ortak servis mevcutken duplicate is mantigi yazilmaz. Ozellikle cash, ledger, reconciliation, bank analysis, document storage, PDF ve serialization servisleri tek kaynak olarak korunur.
- Tahsilat, gider, transfer, adjustment ve bankadan kayit olusturma gibi finans guncellemeleri database transaction'i icinde Income/Expense ile `CashLedgerEntry` butunlugunu korur.
- Soft delete, restore, audit log ve `deletedAt: null` filtreleri korunur.
- Banka importu, mutabakat ve sermaye onerileri kullanici onayi olmadan kalici finans kaydi olusturmaz.
- Auth, CSRF/origin, private storage ve hassas response kontrolleri test gecirmek icin kaldirilmaz veya gevsetilmez.

## PDF Standardi

- Butun rapor PDF'leri ortak `src/lib/pdf` servisi ve ortak layout componentleriyle server-side uretilir.
- PDF route auth kontrolunu route seviyesinde yapar; kullaniciya ait sorgular authenticated user kimligiyle sinirlanir.
- Response `application/pdf`, guvenli tarihli `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` ve `Cache-Control: private, no-store` tasir.
- Her PDF buffer'i donmeden once `%PDF-` imzasi ve anlamli minimum boyut ile dogrulanir. Bos, HTML hata sayfasi veya corrupt dosya `.pdf` olarak sunulmaz.
- Turkce karakterler icin okunabilir Unicode TTF regular/bold font zorunludur.
- Her PDF route'u otomatik test matrisine eklenir. Test sadece HTTP 200 ile yetinmez; MIME, dosya adi, imza, boyut, parse ve gercek browser download olayini dogrular.
- Chromium, Firefox ve WebKit/Safari download testleri zorunludur. Ilgili mobil profilde indirme davranisi da dogrulanir.
- Yeni PDF endpoint'i ortak servis, auth ve test matrisi olmadan merge edilmez.

## Her Degisiklikten Sonra

```bash
npx prisma generate
npm run typecheck
npm run lint
npm run build
npm run test
```

- Degisen davranis icin ilgili hedefli Playwright testi ayrica calistirilir.
- UI degisikliginde gercek Chromium render'i, console/network hatalari, responsive tasma ve dokunmatik hedefler kontrol edilir.
- Finans degisikliginde ledger ve Decimal invariant testleri calistirilir.
- Belge/PDF degisikliginde private access ve browser download matrisi calistirilir.
- Testler skip, timeout artisi veya beklenti gevsetmesiyle yapay olarak gecirilmez.

## Release Kapisi

- Kritik unit, integration, finansal dogruluk, private document, PDF veya Playwright testi fail ise deploy yoktur.
- GitHub `Quality Gates / Required quality gate` sonucu basarili olmadan `main` merge edilmez ve Railway production deploy baslatilmaz.
- Workflow veya testler branch protection'i gecmek icin skip edilmez, `continue-on-error` kullanmaz ve sahte basari uretmez.
- Main branch protection, pull request ve zorunlu `Required quality gate` status check'i ile korunur. Yetki veya plan siniri varsa durum raporlanir; koruma taklit edilmez.
- Railway production servisi GitHub CI tamamlanmadan deploy etmeyecek `Wait for CI` politikasi ile calisir. Bu ayar dogrulanamiyorsa release `STAGING-PENDING`/`BLOCKED` kalir.
- Gercek browser kaniti olmadan UI veya download icin PASS verilmez.
- Production health, authenticated smoke, database/storage kontrolu ve veri sayimi tamamlanmadan `LIVE` denmez.
- Dogrulanmis backup, immutable rollback commit/tag ve uygulanabilir rollback proseduru olmadan release yapilmaz.
- Staging kaniti ortam eksikligi nedeniyle uretilmediyse durum `BLOCKED`/`STAGING-PENDING` olur; production `GO` verilmez.
- Production sonrasinda health, console/network, kritik route, PDF matrisi, veri sayimlari ve persistence yeniden dogrulanir.

Detayli uygulama kurallari:

- `docs/QUALITY_GATES.md`
- `docs/CI_CD_QUALITY_GATES.md`
- `docs/PDF_ARCHITECTURE.md`
- `docs/PDF_TROUBLESHOOTING.md`
- `docs/PRODUCTION_INCIDENT_RUNBOOK.md`
