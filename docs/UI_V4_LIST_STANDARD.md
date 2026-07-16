# UI V4 Liste Standardı

Tarih: 2026-07-10

## Amaç

Liste ekranlarında kayıtların tek sayfaya yığılmasını engellemek, desktop ve mobil görünümü aynı standartta tutmak, tabloları kontrollü yatay scroll içinde göstermek ve premium V4 uygulama kabuğuyla uyumlu bir liste deneyimi sağlamak.

## Uygulanan Ortak Standart

- PageHeader / açıklama / birincil aksiyon düzeni güçlendirildi.
- MetricCard özetleri kullanılan sayfalarda korundu veya eklendi.
- DataTable bileşeni sticky header, kontrollü scroll container, mobil kart görünümü ve uzun metin kırılımı için güçlendirildi.
- Pagination bileşeni toplam kayıt, aktif sayfa ve kayıt aralığı gösterecek şekilde genişletildi.
- Ortak `src/lib/pagination.ts` helper dosyası eklendi.
- Varsayılan liste boyutu 20 veya 25 kayıt olacak şekilde uygulandı.

## Güncellenen Ekranlar

- `/clients`
- `/cases`
- `/collections`
- `/expenses`
- `/advances`
- `/receipts`
- `/documents`
- `/bank-statements`
- `/cash/ledger`
- `/reminders`
- `/capital/assets`
- `/activity` (işlem geçmişi)
- `/settings/deleted-records`

## Notlar

- `/audit-logs` için mevcut uygulama rotası `/activity` olarak kullanılıyor; yeni route eklenmedi.
- `/capital/assets` ekranında özet grafik ve toplamlar tüm aktif varlıklardan hesaplanır, görünür varlık kartları sayfalı render edilir.
- `/settings/deleted-records` ekranında sekme sayıları tüm silinen kayıtlardan hesaplanır, aktif sekmedeki görünür kayıtlar sayfalı render edilir.
- `/advances` ekranı tahsilat ve gider kaynaklarını birleştirdiği için mevcut iş mantığı korunarak birleşik sonuç sayfalı render edilir.

## Doğrulama

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS

