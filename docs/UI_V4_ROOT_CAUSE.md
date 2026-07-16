# UI V4 Root Cause

Tarih: 2026-07-10

Bu dokuman Aşama 2 kapsaminda stil sisteminin neden bazi ciktilarda varsayilan HTML gibi gorundugunu incelemek icin hazirlandi. Bu asamada finans, CRUD, soft delete, audit log, ledger, banka mutabakati veya veritabani mantigina dokunulmadi.

## Kisa Sonuc

Kok neden, normal ekran CSS pipeline'inin tamamen kapali olmasi degil. Normal Next.js/Tailwind pipeline calisiyor:

- `src/app/layout.tsx` icinde `./globals.css` import ediliyor.
- `src/app/globals.css` mevcut ve Tailwind direktifleri dogru.
- Production build CSS dosyasi uretiyor.
- Build HTML'i `/_next/static/css/...css` stylesheet linkini iceriyor.
- Derlenmis CSS icinde `app-sidebar`, `surface-dark`, `primary-action`, `md:hidden`, `lg:hidden` gibi kritik class'lar var.

Asil sorun, print/PDF cikti hatti icin hic global print stylesheet olmamasiydi. Bu nedenle browser print/PDF akisi, ekrana gore tasarlanmis navigasyon, header, form, mobil kart, desktop tablo ve uzun liste katmanlarini kontrolsuz bicimde ayni dokumana tasiyabiliyordu. Bu da kullanicinin gozlemledigi varsayilan link gorunumu, sikisan formlar, cok sayfali liste yigini ve mobil/desktop gorunum karmaşasini tetikliyordu.

Ek risk: Tailwind `content` glob'lari `src/app` ve `src/components` klasorlerini kapsiyordu, fakat `src/lib` klasorunu kapsamiyordu. Bugun `src/lib` icinde agir JSX class uretimi sinirli olsa da V3/V4 servis ve config katmanlarinda UI metadata'si buyudukce Tailwind class uretiminde eksiklere yol acabilecek bir pipeline acigiydi.

## Kontrol Maddeleri

| Kontrol | Sonuc | Not |
| --- | --- | --- |
| `src/app/layout.tsx` globals import ediyor mu? | PASS | `import "./globals.css";` mevcut. |
| `globals.css` mevcut mu? | PASS | `src/app/globals.css` mevcut. |
| Tailwind direktifleri dogru mu? | PASS | `@tailwind base; components; utilities;` mevcut. |
| Tailwind config dogru mu? | PARTIAL -> FIXED | `src/lib` eksikti, eklendi. |
| PostCSS config dogru mu? | PASS | `tailwindcss` ve `autoprefixer` mevcut. |
| CSS Modules/global CSS cakismasi var mi? | PASS | Stil kaybina neden olacak cakisma tespit edilmedi. |
| Yanlis print CSS tum stilleri sifirliyor mu? | PASS | Yanlis print CSS yoktu; sorun print CSS'in hic olmamasiydi. |
| `@media print` normal ekranda etkili mi? | PASS | Onceden yoktu; eklenen kurallar sadece `@media print` altinda. |
| Service worker eski CSS/JS gosteriyor mu? | PASS | Dev modda registration/cache temizleniyor. Production'da static assetler stale-while-revalidate. |
| Development modunda eski service worker unregister ediliyor mu? | PASS | `PwaRegister` dev modda unregister + cache delete yapiyor. |
| Hydration sonrasi className degisiyor mu? | PASS / WATCH | AppShell aktif path'i mount sonrasi uyguluyor; menu listesi sabit `NAV_ITEMS` uzerinden geliyor. Stil pipeline kok nedeni degil. |
| AppShell'in iki surumu ayni anda mi? | PASS | Aktif kaynakta tek `src/components/app-shell.tsx` var. |
| Mobile/desktop hidden class'lari uretiliyor mu? | PASS | Derlenmis CSS'te `md:hidden` ve `lg:hidden` var. Print icin ayrica kontrol eklendi. |
| PDF normal browser print cikti mi? | LIKELY | Gozlenen sorunlar browser print/PDF semptomlariyla uyumlu. Server-side PDF renderer ayri bir hatti kullaniyor. |
| Build sirasinda CSS dosyasi olusuyor mu? | PASS | `.next/static/css/92395c49989f2844.css` olustu. |
| Browser network'te CSS 200 donuyor mu? | BLOCKED | `localhost:3000` bu ortamda cevap vermedigi icin runtime network kontrolu yapilamadi. Build HTML stylesheet linkini iceriyor. |
| Console'da CSS/hydration/module error var mi? | BLOCKED | Canli local server yok; runtime console kontrolu sonraki gorsel kabul asamasinda yapilmali. |

## Yapilan Duzeltmeler

### Tailwind content kapsami

`tailwind.config.ts` icine `src/lib` eklendi:

```ts
"./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
```

Bu degisiklik, UI ile ilgili class kaynaklari ileride `src/lib` altindan geldiklerinde production CSS'ten dusmemeleri icin yapildi.

### Print/PDF stylesheet hatti

`src/app/globals.css` icine kontrollu `@media print` blogu eklendi.

Bu blok:

- App sidebar, header, nav, form ve aksiyon butonlarini print'te gizler.
- Desktop tabloyu print'te tek kaynak olarak kullanir.
- Mobil kart + desktop tablo birlikte basma riskini azaltir.
- Linkleri mavi/mor varsayilan browser gorunumunden cikarir.
- Tablo minimum genisliklerini print icin sifirlar.
- Sticky aksiyon sutunlarini print'te statik hale getirir.
- Uzun metinlerde `overflow-wrap:anywhere` uygular.
- Kart/panel renklerini print icin temiz beyaz/yuksek okunurluk formatina alir.

## Build Kaniti

Son build sonucu:

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS

Derlenmis CSS dogrulama sonucu:

```json
{
  "cssFile": "92395c49989f2844.css",
  "bytes": 77591,
  "hasPrintMedia": true,
  "hasAppSidebar": true,
  "hasSurfaceDark": true,
  "hasPrimaryAction": true,
  "hasMdHidden": true,
  "hasLgPlReset": true
}
```

## Kalan Runtime Dogrulama

Bu ortamda `http://localhost:3000` cevap vermedigi icin browser network ve console kontrolleri yapilamadi.

Runtime kabul icin sonraki asamada calisan lokal server ile sunlar dogrulanmali:

- CSS request'i `200` donuyor mu?
- Console'da hydration/module/style error var mi?
- `/advances` print preview artik kontrolsuz 55 sayfalik HTML yigini uretiyor mu?
- Mobile/desktop tablo-kart cift render print'te kesildi mi?
- Normal ekran gorunumu print CSS'ten etkilenmedi mi?

## Karar

Stil pipeline'i normal ekran icin calisiyor. Kok sorun print/PDF hattinda eksik global print CSS ve Tailwind content kapsami acigiydi. Iki nokta da kod seviyesinde duzeltildi; gorsel runtime kaniti sonraki asamada calisan browser uzerinden uretilmeli.
