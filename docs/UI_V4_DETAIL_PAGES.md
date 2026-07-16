# UI V4 Detail Pages

## Amaç

Müvekkil, dosya, tahsilat, gider, belge, banka ekstresi ve sermaye varlığı detay ekranları aynı premium detay sayfası standardına alındı.

## Standart Yapı

- Breadcrumb
- Başlık, açıklama ve status alanı
- Sağ üst aksiyonlar
- Özet metric kartları
- Sekmeler:
  - Genel Bakış
  - Finans
  - Belgeler
  - İşlem Geçmişi
- İlgili kayıtlar
- Empty state
- Tehlikeli işlemlerde confirm dialog

## Kapsanan Ekranlar

- `/clients/[id]`
- `/cases/[id]`
- `/collections/[id]`
- `/expenses/[id]`
- `/documents/[id]`
- `/bank-statements/[id]`
- `/capital/assets/[id]`

## Korunan Davranışlar

- Düzenle, sil, arşivle ve yeniden işleme aksiyonları mevcut API uçları üzerinden çalışmaya devam eder.
- Soft delete, audit log, belge bağlantısı, PDF indirme ve finansal hesaplama mantığı değiştirilmedi.
- Client componentlere function prop veya Prisma/Decimal/Date nesnesi doğrudan geçirilmedi.

## Doğrulama

- `npm run typecheck`
- `npm run lint`
- `npm run build`

