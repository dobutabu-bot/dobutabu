# V3-RC1 Backup ve Restore Provası

Tarih: 7 Temmuz 2026  
Sürüm: V3-RC1 / `3.0.0-rc.1`  
Amaç: Gerçek müvekkil ve finans verisi alınmadan önce database, private belge storage, export ve restore akışlarının veri kaybı riskini azaltacak şekilde doğrulanması.

## Kapsam

Bu prova aşağıdaki alanları kontrol etti:

- SQLite/V3 backup paketi üretimi
- PostgreSQL backup script ön koşulu
- Private document storage backup stratejisi
- JSON/CSV export endpointleri
- Restore dry-run
- Temiz geçici veritabanına restore sayım doğrulaması
- Document metadata ile fiziksel dosya eşleşmesi
- Eksik fiziksel belge dosyasında sistem davranışı
- Audit log, banka import, mutabakat linkleri ve sermaye değerleme geçmişi sayım kontrolü

## Çalıştırılan Backup Komutları

```bash
npm run backup:v3
```

Sonuç: PASS

Oluşan paket:

```text
backups/buro-finans-v3-2026-07-07_23-41-30/
```

Paket içeriği:

```text
README.txt
database.sqlite
database.sqlite.sha256
document-storage-manifest.tsv
document-files.tar.gz
document-files.tar.gz.sha256
```

Paket boyutu:

```text
4.5M
```

Belge storage manifest satır sayısı:

```text
212
```

## PostgreSQL Backup Script Kontrolü

Komut:

```bash
DRY_RUN=1 DATABASE_URL=postgresql://example.invalid/db npm run backup:v3
```

Sonuç: WARN

Çıktı:

```text
PostgreSQL yedegi icin pg_dump komutu gerekli.
```

Değerlendirme:

- Script PostgreSQL URL tipini algılıyor.
- Bu lokal ortamda `pg_dump` kurulu olmadığı için PostgreSQL backup provası tamamlanamadı.
- Production PostgreSQL kullanılacaksa `postgresql-client` / `pg_dump` zorunlu operasyon bağımlılığıdır.

Production gereği:

```bash
pg_dump --version
npm run backup:v3
```

## Restore Komutu

```bash
npm run restore:v3:dry-run -- backups/buro-finans-v3-2026-07-07_23-41-30
```

Sonuç: PASS

Çıktı özeti:

```text
OK database.sqlite bulundu.
OK document-storage-manifest.tsv bulundu.
OK document-files.tar.gz bulundu.
OK document-files.tar.gz okunabilir.
database.sqlite: OK
document-files.tar.gz: OK
Dry-run tamamlandi.
```

Not: Bu dry-run production verisine yazmaz. Gerçek restore için `docs/OPERATIONS.md` içindeki SQLite veya PostgreSQL restore adımları bakım penceresinde uygulanmalıdır.

## Temiz Veritabanı Restore Sayım Kontrolü

Backup içindeki `database.sqlite`, geçici temiz bir SQLite dosyası olarak açıldı ve kayıt sayıları doğrulandı.

Sonuç: PASS

| Alan | Restore sonrası sayı |
|---|---:|
| Müvekkil | 54 |
| Tahsilat | 287 |
| Gider | 324 |
| Belge metadata | 247 |
| Audit log | 714 |
| Banka import | 39 |
| Banka hareketi | 661 |
| Mutabakat/eşleşme linkli banka hareketi | 161 |
| Sermaye varlığı | 20 |
| Sermaye değerleme | 240 |

Değerlendirme:

- Audit log restore sonrası korunuyor.
- Banka import ve mutabakat linkleri restore sonrası korunuyor.
- Sermaye değerleme geçmişi restore sonrası korunuyor.

## JSON/CSV Export Kontrolü

Auth kontrollü endpointler test edildi.

| Export | Sonuç | Detay |
|---|---|---|
| JSON backup | PASS | `200 application/json`, 3.263.589 byte |
| Müvekkiller CSV | PASS | `200 text/csv`, 10.707 byte |

Komut mantığı:

```bash
/api/backup
/api/export?resource=clients&format=csv&includeDeleted=1
```

Değerlendirme:

- JSON export çalışıyor.
- CSV export çalışıyor.
- Exportlar auth gerektiriyor.
- Fiziksel belge dosyaları JSON/CSV içine gömülmüyor; `document-files.tar.gz` ayrıca saklanmalıdır.

## Belge Storage Stratejisi

Sonuç: PASS / WARN

Backup script şu dosyaları ayrı üretir:

- `document-storage-manifest.tsv`: Dosya adı, boyut ve SHA-256 listesi
- `document-files.tar.gz`: Private belge storage fiziksel dosyaları
- `document-files.tar.gz.sha256`: Arşiv checksum doğrulaması

Bu strateji doğrudur çünkü belge dosyaları database içinde tutulmaz.

Risk:

- Backup yalnızca database dosyasıyla yapılırsa belge metadata geri döner, fakat fiziksel PDF/JPG/CSV/XLSX dosyaları geri dönmez.
- Production’da database backup ve private document storage backup birlikte, aynı zaman penceresinde alınmalıdır.

## Document Metadata ve Fiziksel Dosya Eşleşmesi

Kontrol sonucu:

| Kontrol | Sonuç |
|---|---:|
| Aktif document metadata | 80 |
| Eksik aktif fiziksel belge dosyası | 80 |
| Backup manifest fiziksel dosya sayısı | 212 |

Sonuç: WARN

Değerlendirme:

- Mevcut V3 test veri setinde metadata-only belge kayıtları bulunuyor.
- Bu kayıtlar gerçek dosya upload akışından gelmediği için fiziksel dosya karşılığı yok.
- Backup script fiziksel storage içinde bulunan dosyaları doğru şekilde yedekliyor.
- Production öncesi gerçek belgeler yalnızca güvenli upload akışıyla alınmalı veya metadata-only demo kayıtları temizlenmelidir.

## Eksik Fiziksel Dosya Davranışı

İlk testte eksik fiziksel dosya preview endpoint’i `500` döndürüyordu.

Bu prova sırasında düzeltildi:

- `/api/documents/[id]/preview`
- `/api/documents/[id]/download`

Yeni davranış:

```text
404
{"message":"Belge dosyası storage alanında bulunamadı. Yedek/restore veya storage eşleşmesini kontrol edin."}
```

Sonuç: PASS

Değerlendirme:

- Eksik dosya artık uygulamayı çökertmiyor.
- Kullanıcıya storage/restore uyumsuzluğunu anlatan güvenli mesaj dönüyor.
- Fiziksel path veya secret sızdırılmıyor.

## Test Maddeleri Sonuçları

| # | Kontrol | Sonuç | Not |
|---:|---|---|---|
| 1 | PostgreSQL backup script çalışıyor mu? | WARN | Script hazır; lokal ortamda `pg_dump` eksik. Production’da kurulmalı. |
| 2 | Belge storage backup stratejisi var mı? | PASS | Manifest + tar.gz + checksum var. |
| 3 | JSON/CSV export çalışıyor mu? | PASS | Auth ile JSON ve CSV 200 döndü. |
| 4 | Restore script temiz veritabanına geri yükleme yapabiliyor mu? | PASS | Dry-run geçti; backup DB geçici temiz DB olarak açıldı. |
| 5 | Restore sonrası kayıt sayıları tutuyor mu? | PASS | Kritik tablo sayıları korundu. |
| 6 | Document metadata ile fiziksel dosyalar eşleşiyor mu? | WARN | Demo metadata kayıtlarında eksik fiziksel dosya var. |
| 7 | Eksik dosya varsa sistem çökmeden uyarı veriyor mu? | PASS | Preview/download 404 güvenli mesaj döndürüyor. |
| 8 | Audit log restore sonrası duruyor mu? | PASS | 714 audit log korundu. |
| 9 | Banka import ve mutabakat linkleri restore sonrası korunuyor mu? | PASS | 39 import, 661 row, 161 eşleşme/link korundu. |
| 10 | Sermaye değerleme geçmişi restore sonrası korunuyor mu? | PASS | 20 varlık, 240 değerleme korundu. |

## Bilinen Riskler

1. PostgreSQL production backup için `pg_dump` zorunludur.
2. PostgreSQL restore için `pg_restore --list` ve staging restore provası ayrıca yapılmalıdır.
3. JSON/CSV export fiziksel belge dosyalarını içermez.
4. Metadata-only demo belge kayıtları production öncesi temizlenmeli veya gerçek dosyalarıyla eşleştirilmelidir.
5. Backup klasörü uygulama container yaşam döngüsünden bağımsız, şifreli ve erişimi kısıtlı alanda tutulmalıdır.
6. Restore gerçek production verisini değiştireceği için bakım penceresinde ve önce snapshot alınarak yapılmalıdır.

## Production’da Yapılması Gerekenler

1. PostgreSQL kullanılacaksa:

```bash
pg_dump --version
pg_restore --version
npm run backup:v3
pg_restore --list backups/buro-finans-v3-YYYY-MM-DD_HH-MM-SS/database.pgcustom
```

2. SQLite/VPS kullanılacaksa:

```bash
npm run backup:v3
npm run restore:v3:dry-run -- backups/buro-finans-v3-YYYY-MM-DD_HH-MM-SS
```

3. Backup çıktıları şifreli diskte veya güvenli object storage alanında saklanmalı.

4. Database ve private belge storage aynı zaman penceresinde yedeklenmeli.

5. Haftalık restore dry-run ve aylık staging restore provası yapılmalı.

6. Production deploy öncesi Sistem Durumu ekranında şu alanlar kontrol edilmeli:

- Database bağlantısı
- Storage erişimi
- Son migration
- Son backup zamanı
- Eşleşmemiş banka hareketleri
- Belgesiz finans kayıtları
- PWA manifest/service worker durumu

## Sonuç

V3-RC1 backup ve restore provası genel olarak başarılıdır.

Release öncesi zorunlu aksiyonlar:

- Production ortamına `pg_dump`/`pg_restore` kurulmalı veya managed database snapshot stratejisi netleştirilmeli.
- Metadata-only demo belge kayıtları gerçek storage dosyalarıyla eşleştirilmeli ya da production veri setinden temizlenmeli.
- İlk gerçek veri alınmadan önce `npm run backup:v3` ve `npm run restore:v3:dry-run` tekrar çalıştırılmalıdır.
