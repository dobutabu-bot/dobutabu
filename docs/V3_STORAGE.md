# V3 Private Belge Storage

Bu uygulamada belge dosyaları `public/` altına yazılmaz. PDF, görsel, CSV ve Excel dosyaları private storage alanında tutulur ve yalnızca auth kontrollü API route'ları üzerinden servis edilir.

## Varsayılan Local Storage

Aktif adapter:

- `LocalDocumentStorage`
- Kod: `src/lib/documents/local-storage.ts`
- Varsayılan kök: `./storage/documents`
- Metadata alanı: `Document.storagePath`
- Saklanan göreli yol formatı: `documents/<uuid>.<ext>`

Dosya adı kullanıcıdan gelen isimle kaydedilmez. Fiziksel dosya adı UUID + uzantı formatındadır:

```text
documents/4f7f82d1-5f1e-4a3d-8d0c-77a7e60a2c9b.pdf
```

Kullanıcının gerçek dosya adı yalnızca metadata olarak `originalFileName` alanında saklanır.

## Production Volume

Production ortamında persistent volume mount önerilir:

```bash
DOCUMENT_STORAGE_DIR=/var/lib/buro-finans/documents
```

Bu değer belge storage kökünü temsil eder. Uygulama dosyaları yine `documents/<uuid>.<ext>` storage path formatıyla saklar; fiziksel karşılığı volume altında tutulur.

## Auth Kontrollü Erişim

Belge içeriği aşağıdaki private route'lar üzerinden verilir:

- `GET /api/documents/:id/download`
- `GET /api/documents/:id/preview`

Bu route'lar:

- Oturum açmamış kullanıcıya `401` döner.
- Belgenin mevcut kullanıcıya ait olduğunu kontrol eder.
- `deletedAt: null` filtresini uygular.
- `Cache-Control: private, no-store` ve `X-Content-Type-Options: nosniff` header'larını döner.
- Filesystem path bilgisini client'a göstermez.

## Path Traversal Koruması

Local adapter şu kontrolleri yapar:

- Absolute path reddedilir.
- `..` traversal reddedilir.
- Alt klasör yazımı reddedilir.
- Sadece UUID + izin verilen uzantı formatı kabul edilir.
- Fiziksel path storage kökü dışına çıkıyorsa işlem reddedilir.

## Adapter Sınırı

Storage arayüzü:

- `DocumentStorageAdapter`
- `S3LikeStorage`

`S3LikeStorage` şu an interface seviyesinde bırakılmıştır. İleride S3, NAS veya object storage'a geçişte API route'ları ve belge metadata modeli değişmeden adapter uygulaması değiştirilebilir.

## Yedekleme

JSON/CSV export belge metadata içerir; fiziksel belge dosyalarını içermez. Tam yedek için:

1. SQLite/PostgreSQL veritabanı yedeği alın.
2. `DOCUMENT_STORAGE_DIR` veya varsayılan `./storage/documents` klasörünü ayrıca yedekleyin.
3. Yedekler kişisel veri, müvekkil bilgisi ve finansal belge içerebilir; şifreli ve güvenli ortamda saklayın.
