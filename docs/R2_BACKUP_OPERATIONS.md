# Cloudflare R2 Şifreli Yedekleme

## Amaç

Bu operasyon katmanı Railway volume üzerindeki SQLite veritabanı ile private belge storage içeriğini bağımsız bir Cloudflare R2 Standard bucket'a şifreli olarak yedekler. Uygulama iş mantığına, Prisma şemasına ve kullanıcı arayüzüne dokunmaz.

Railway native volume backup/PITR güncel panelde Pro plana özeldir. Hobby hedefinde felaket kurtarma güvencesi bu bağımsız R2 yedeği ve düzenli restore provasıyla sağlanır. SQLite için PITR uygulanabilir değildir.

## Güvenlik Modeli

- Canlı SQLite dosyası doğrudan kopyalanmaz. `VACUUM INTO` tutarlı snapshot üretir.
- Snapshot üzerinde `PRAGMA integrity_check` çalışır.
- Private belge klasörü için göreli yol, boyut ve SHA-256 manifesti oluşturulur.
- `/data/backups`, cache ve geçici dosyalar arşive alınmaz.
- Arşiv AES-256-GCM ile uygulama tarafında şifrelenir.
- R2 yalnız şifreli `.bfbackup` nesnesi görür.
- R2 erişim bilgileri yalnız Railway variables içinde tutulur.
- Internal endpoint yalnız zaman damgalı HMAC isteğini kabul eder.
- Endpoint teknik stack, secret, filesystem yolu veya kullanıcı verisi döndürmez.
- Restore provası `/data` ve aktif document storage içine yazmayı reddeder.

## Railway Variables

Gerçek değerler hiçbir zaman Git'e eklenmez:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_BACKUP_ENCRYPTION_KEY
BACKUP_HMAC_SECRET
R2_BACKUP_PREFIX=buro-finans
```

`R2_BACKUP_ENCRYPTION_KEY`, kriptografik olarak güvenli 32 byte anahtarın base64 karşılığıdır. `BACKUP_HMAC_SECRET` en az 32 karakter olmalıdır. Bu iki anahtar backup nesnelerinden ayrı saklanmalıdır; kayıpları yedeği kullanılamaz hale getirir.

## GitHub Actions Secrets

GitHub yalnız endpoint adresini ve HMAC tetikleme secretını taşır. R2 credential veya encryption key GitHub'a verilmez:

```text
PRODUCTION_BACKUP_URL
PRODUCTION_BACKUP_HMAC_SECRET
```

Workflow her gün `00:15 UTC` saatinde çalışır. Repository checkout veya dependency kurulumu yapmadığı için private repository dakikalarını düşük tutar. Üç kontrollü deneme sonunda doğrulanmış başarılı response alamazsa job FAIL olur.

## Retention

- Günlük: son 7 nesne
- Haftalık: son 5 nesne
- Aylık: son 12 nesne
- Baseline: otomatik retention dışında

Cleanup yalnız yeni yedek R2'ye yüklendikten, geri indirildikten, AES-GCM doğrulamasından, SQLite integrity kontrolünden, kayıt sayımı ve belge manifesti karşılaştırmasından geçtikten sonra çalışır.

## Manuel Baseline

GitHub Actions içindeki `Production R2 Backup` workflow'u `workflow_dispatch` ile `baseline` modunda çalıştırılır. Baseline çağrısı aynı doğrulanmış şifreli içeriği günlük, haftalık, aylık ve baseline sınıflarına yazar.

## İzole Restore Provası

Restore komutu yalnız boş ve production volume dışında bir hedefe yazabilir:

```bash
npm run backup:r2:restore -- --output /tmp/buro-finans-restore-drill
```

Prova:

1. Son günlük nesneyi R2'den indirir.
2. Metadata checksumunu doğrular.
3. AES-256-GCM ile decrypt eder.
4. Arşiv yollarını traversal açısından doğrular.
5. İzole dizine çıkarır.
6. `PRAGMA integrity_check = ok` sonucunu doğrular.
7. Tüm tablo kayıt sayılarını karşılaştırır.
8. Belge manifesti, dosya sayısı, boyut ve SHA-256 değerlerini karşılaştırır.

Production restore bu komutun otomatik bir parçası değildir. Gerçek restore işlemi incident runbook, güncel production backup ve açık operasyon onayı gerektirir.

## İzleme

- Başarılı workflow sonucu backup ve restore doğrulamasının birlikte geçtiğini gösterir.
- Workflow FAIL olursa plan düşürme veya production değişikliği yapılmaz.
- HMAC anahtarı, encryption key veya R2 credential rotate edilirse Railway ve GitHub HMAC secretı kontrollü biçimde birlikte güncellenir.
- R2 erişim anahtarına yalnız seçili bucket için object read/write yetkisi verilir.

## Bilinen Sınırlar

- SQLite PITR desteklenmez: `NOT_APPLICABLE_SQLITE`.
- İlk haftalık ve aylık geçmiş zaman içinde birikir; baseline ilk doğrulanmış nesneyi her üç retention katmanına yerleştirir.
- Railway native backup Hobby planda kullanılamıyorsa `NATIVE BACKUPS: UNAVAILABLE` raporlanır; bu durum R2 doğrulamasını ortadan kaldırmaz.
