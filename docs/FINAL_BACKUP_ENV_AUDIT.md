# Final Yedek ve Ortam Doğrulaması

Tarih: 11 Temmuz 2026 04:10 (Europe/Istanbul)

## Yedekler

| Yedek | Boyut | SHA-256 | Doğrulama |
| --- | ---: | --- | --- |
| `recovery-backups/final-before-20260711-0410.zip` | 1.6 MB | `67111dcf60f1fda6c88ae775b6670a7b45040ad9416bfe9d0f062ade268e0ee6` | `unzip -t`: PASS |
| `recovery-backups/final-database-before-20260711-0410.db` | 7.6 MB | `f09c782bc97dac27763656da79663b7d3a925f2f465973607f8570d009b98454` | SQLite integrity: PASS |

Kaynak `prisma/dev.db` için de `PRAGMA integrity_check` sonucu `ok` olmuştur. Veritabanı yedeği SQLite'ın çevrimiçi `.backup` komutuyla alınmıştır.

Proje arşivi kaynak kodu, Prisma migration'ları, public/storage içerikleri, testler, fixture'lar, operasyon ve CI dosyalarını kapsar. Gerçek `.env` ve secret dosyaları güvenlik amacıyla proje zip'ine eklenmemiştir.

## Kayıt Sayıları

| Kayıt | Aktif veritabanı | Yedek veritabanı |
| --- | ---: | ---: |
| Müvekkil | 72 | 72 |
| Dosya | 90 | 90 |
| Tahsilat | 340 | 340 |
| Gider | 347 | 347 |
| Belge | 542 | 542 |
| Banka hareketi | 772 | 772 |
| Sermaye varlığı | 24 | 24 |
| Hatırlatma | 59 | 59 |
| Kasa hesabı | 14 | 14 |

Önceki rapordaki çekirdek sayımlar birebir korunmuştur. Yeni veya boş veritabanı oluşturulmamıştır.

## Git

- Aktif branch: `deployment-rescue`
- Remote: `https://github.com/dobutabu-bot/dobutabu.git`
- Worktree: dirty; daha önceki V4/V5 geliştirmeleri ve oluşturulan inceleme dosyaları commit edilmemiş durumda.
- Bu doğrulama sırasında branch değiştirilmedi, commit/push yapılmadı ve mevcut değişiklikler geri alınmadı.

## Ortam

| Ayar | Durum |
| --- | --- |
| `DATABASE_URL` | Ayarlı: SQLite `file:./dev.db` |
| Çözümlenen SQLite dosyası | `/Users/bugra/Documents/Codex/2026-07-04/bir-hukuk-b-rosunda-yaln-zca-2/prisma/dev.db` |
| SQLite dosyası mevcut | Evet |
| `DOCUMENT_STORAGE_DIR` | `.env` içinde ayarlı değil; güvenli varsayılan `storage/documents` kullanılıyor |
| `AUTH_SECRET` | `.env` içinde ayarlı değil |
| `SESSION_SECRET` | Ayarlı; değer rapora yazılmadı |
| `APP_URL` | `.env` içinde ayarlı değil |

Secret değerleri, bağlantı metinleri ve özel belge yolları rapora açık değer olarak yazılmamıştır.

## Başlatma Dosyaları

- `START_LOCAL.command`: mevcut ve çalıştırılabilir (`rwxr-xr-x`).
- `STOP_LOCAL.command`: mevcut ve çalıştırılabilir (`rwxr-xr-x`).
- `RUN_FINAL_LOCAL.command`: mevcut; `START_LOCAL.command` tarafından `/bin/zsh` ile çağrılır.
- `package.json` `dev`: `next dev`
- `package.json` `start`: `node scripts/start-production.mjs`

## Sonuç

`PASS`: Aktif veritabanı doğru dosyadır, önceki kayıtları içerir, kaynak/yedek bütünlüğü sağlamdır ve iki yedekteki kayıt sayıları eşleşmektedir.
