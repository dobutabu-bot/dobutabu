# UI V4 Masraf Avansları

Tarih: 2026-07-10

## Amaç

`/advances` ekranında açık formun ve kontrolsüz uzun kayıt akışının oluşturduğu PDF/print ve okunabilirlik sorunlarını gidermek.

## Yapılan Değişiklikler

- Sayfa başlığı `Masraf Avansları` olarak V4 PageHeader standardına alındı.
- Sayfa içinde sürekli açık duran form kaldırıldı.
- `Avans Hareketi Ekle` aksiyonu sağ drawer / mobil tam ekran drawer akışına taşındı.
- Üst metrik kartları eklendi:
  - Toplam alınan
  - Toplam harcanan
  - Kullanılabilir bakiye
  - Bu ay alınan
  - Bu ay harcanan
  - Belgesiz hareket sayısı
- Filtreler eklendi:
  - Tarih aralığı
  - Müvekkil
  - Dosya
  - Yön
  - Tutar aralığı
  - Belge durumu
  - Sıralama
  - Sayfa boyutu
- Liste 25/50/100 kayıt sayfalama seçeneğiyle sınırlandı.
- Desktop görünüm DataTable standardına bağlandı.
- Mobil görünüm DataTable içindeki kart görünümüyle korunuyor.
- Yön ve tutar gösterimi finans renk standardına bağlandı:
  - Alındı: yeşil, artı yön
  - Harcandı: kırmızı, eksi yön
- Satır aksiyonları üç nokta menüsüne taşındı:
  - Görüntüle
  - Düzenle
  - Sil
  - Belge bağla

## Korunan Davranışlar

- Mevcut `/api/advances` create endpoint’i korundu.
- Alınan avanslar mevcut `Income` / `ADVANCE` kaydı olarak kalır.
- Harcanan avanslar mevcut `Expense` / `isClientExpense` kaydı olarak kalır.
- Düzenleme ve silme mevcut tahsilat/gider endpointleri üzerinden yapılır.
- Yeni duplicate finans kaydı üretme mantığı eklenmedi.
- Soft delete, dashboard, rapor ve ledger davranışları değiştirilmedi.

## Doğrulama

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS

## Runtime Notu

Bu ortamda lokal Next.js dev server başlatma denemesi `listen EPERM: operation not permitted 127.0.0.1:3000` hatasıyla engellendi. Bu nedenle görsel runtime screenshot üretilemedi. Production build başarıyla tamamlandı.

