# CI/CD Quality Gates

## Amac

`Quality Gates` workflow'u, main merge ve production deploy oncesinde kod, veri guvenligi, PDF, browser ve build artifact kanitlarini zorunlu tutar. Workflow testleri gevsetmez ve bir alt is basarisizsa final sonucu basarisiz olur.

## Workflow

Dosya:

```text
.github/workflows/quality-gates.yml
```

Tetikleyiciler:

- `main` hedefli pull request
- `main`, `deployment-rescue` ve `hotfix/**` push
- Manuel `workflow_dispatch`

Karar check'i:

```text
Quality Gates / Required quality gate
```

## Isler

| Is | Kanit |
| --- | --- |
| Secret and data scan | Tracked `.env`, database, storage, backup ve gercek token/secret adayi yok |
| Typecheck, lint and build | Prisma Client, TypeScript, ESLint ve production build PASS |
| Unit and integration tests | `npm run test` PASS |
| PDF unit and integration tests | Renderer, route, auth, buyuk veri ve Turkce PDF testleri PASS |
| Playwright browser matrix | Chromium, Firefox ve WebKit release akislari PASS |
| PDF download matrix | Uc desktop motoru, Android Chromium ve iPhone WebKit gercek download/parse PASS |
| Critical route smoke | Ana route'lar masaustu ve mobil motorlarda runtime hatasiz |
| Build artifact | BUILD_ID, kritik route, JS/CSS var; private dosya yok |

Her job yalniz GitHub runner icinde olusturulan gecici SQLite database ve private storage klasorunu kullanir. Local, staging veya production verisine baglanmaz. Fixture seed yalniz bu gecici `APP_ENV=test` ortamindadir.

## Failure kanitlari

Playwright job'u hata verirse `test-results` ve `playwright-report` yedi gunluk artifact olarak yuklenir. Basarili run'larda hassas browser artifact'i tutulmaz. Production build artifact'i uc gun saklanir ve private dosya taramasindan gecer.

## Main branch protection

Repository yoneticisi `main` branch icin:

- Pull request zorunlulugu,
- branch'in guncel olmasi,
- `Quality Gates / Required quality gate` status check zorunlulugu,
- force push ve branch silme yasagi

uygular. GitHub plan veya uygulama yetkisi bu ayari engellerse bu bir test basarisi degildir; `BLOCKED` olarak raporlanir.

## Railway

Railway production servisinde GitHub deploy ayarlarindan `Wait for CI` acik olmalidir. Bu sayede quality gate tamamlanmadan production deploy baslamaz. Railway hesabina/servisine yonetim erisimi yoksa ayar dogrulanmis sayilmaz ve release en fazla `STAGING-PENDING` olabilir.

## Yerel dogrulama

CI dosyasinin kullandigi repository-ici kontroller:

```bash
node scripts/ci-secret-data-scan.mjs
npx prisma generate
npm run typecheck
npm run lint
npm run build
node scripts/verify-build-artifact.mjs
npm run test
node --experimental-strip-types --experimental-transform-types \
  --import ./tests/register-ts-paths.mjs \
  --test tests/pdf-qa.test.ts
```

`ci-prepare-test-env.sh` yalniz GitHub Actions icindir ve local/production database uzerinde calismayi reddeder.
