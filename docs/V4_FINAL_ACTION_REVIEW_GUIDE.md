# V4 Final Aksiyon İnceleme Rehberi

## Tek Komut

Proje klasöründe Finder'dan `RUN_FINAL_ACTION_REVIEW.command` dosyasını açın veya Terminal'de çalıştırın:

```bash
zsh RUN_FINAL_ACTION_REVIEW.command
```

Komut sırasıyla eski proje sunucusunu güvenli kapatır, `.next` cache'ini temizler, Prisma/typecheck/lint/build kontrollerini çalıştırır, temiz dev sunucusunu başlatır, health check bekler ve gerçek Chromium aksiyon testini çalıştırır.

## Kanıtlar

- Ekran görüntüleri: `artifacts/final-action-runtime/`
- Sunucu logu: `artifacts/final-action-runtime/local-server.log`
- Playwright HTML raporu: `playwright-report/index.html`
- Otomatik hata kanıtları: `test-results/final-action-runtime-*`

## Veri Güvenliği

Test kayıtları `RUNTIME-CRUD-TEST-...` önekiyle oluşturulur. Normal listelerden soft delete edilir; mevcut müvekkil ve finans kayıtları topluca değiştirilmez. Veritabanı reset/migrate reset çalıştırılmaz.

## Yerel Link

Başlatıcı tarafından seçilen güncel link `LOCAL_REVIEW_LINK.txt` dosyasına yazılır. Varsayılan adres:

`http://localhost:3000/dashboard`

Port doluysa başlatıcı `3010` veya `3020-3025` aralığından güvenli bir port seçer.

Son doğrulanan inceleme linki `LOCAL_REVIEW_LINK.txt`, aynı Wi-Fi telefon linki `LOCAL_REVIEW_PHONE_LINK.txt` dosyasındadır. Son kabul raporu `docs/V4_FINAL_ACTION_UI_STABILITY.md` dosyasına yazılmıştır.
