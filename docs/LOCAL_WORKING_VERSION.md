# Local Working Version

Tarih: 2026-07-10

## Durum

Yerel kurtarma calismasi tamamlandi; proje dosyalari, bagimlilikler, Prisma Client, veritabani ve build zinciri saglam gorunuyor.

Bu Codex oturumu icinden dev server baslatma asamasi macOS/sandbox port izni nedeniyle engellendi:

```text
Error: listen EPERM: operation not permitted 0.0.0.0:3000
Error: listen EPERM: operation not permitted 127.0.0.1:3010
```

Bu nedenle bu oturumda `http://localhost:3000` HTTP olarak dogrulanamadi. Uygulamanin kullanici macOS oturumunda calismasi icin proje kokundeki `START_LOCAL.command` dosyasi hazirlandi.

## Calistirma

1. Finder'da proje klasorunu ac:

```text
/Users/bugra/Documents/Codex/2026-07-04/bir-hukuk-b-rosunda-yaln-zca-2
```

2. `START_LOCAL.command` dosyasina cift tikla.

3. Terminal penceresi acilinca uygulama hazir olana kadar bekle.

4. Script tarayiciyi otomatik acmaya calisir. Acmazsa Terminal'de yazan linki kullan.

Varsayilan link:

```text
http://localhost:3000/login
```

Eger 3000 doluysa script su portlardan ilk bos olani secer:

```text
3000, 3001, 3002, 3003, 3004, 3005, 3010
```

## Durdurma

`STOP_LOCAL.command` dosyasina cift tikla veya uygulamayi baslatan Terminal penceresinde `Control+C` kullan.

## Kontroller

Asagidaki komutlar bu kurtarma sirasinda basariyla calisti:

```text
npx prisma generate
npm run typecheck
npm run lint
npm run build
```

`npm run health:check` bu oturumda FAIL verdi; sebep health endpoint hatasi degil, dev server'in Codex sandbox icinde port acamamasidir.

## Yedekler

- Proje yedegi: `recovery-backups/buro-finans-before-recovery-20260710-1909.zip`
- Veritabani yedegi: `recovery-backups/buro-finans-database-before-recovery-20260710-1909.db`

## Hassas Veri Notu

`.env`, SQLite veritabani, belge storage ve backup dosyalari Git'e eklenmemelidir.

