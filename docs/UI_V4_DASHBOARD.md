# UI V4 Dashboard

Tarih: 2026-07-10

## Amaç

Dashboard, mevcut V2/V3 veri servisleri korunarak premium dijital finans merkezi kompozisyonuna taşındı. Yeni finans mantığı eklenmedi; mevcut server-side özetler, küçük grafik veri setleri, lazy chart loader ve serialization hattı kullanılmaya devam eder.

## Yapılanlar

- Üst hero kontrollü selamlama, güncel tarih ve “büronuzun finansal görünümü” diliyle güncellendi.
- Hero hızlı aksiyonları V4 kapsamına göre sadeleştirildi:
  - Tahsilat ekle
  - Gider ekle
  - Belge yükle
  - Hatırlatma ekle
- Finans ticker V4 kalemlerine göre düzenlendi:
  - Toplam kasa
  - Bugün giriş
  - Bugün çıkış
  - Bugün net
  - Bu ay net
  - Açık alacak
  - Yaklaşan ödeme
  - Mutabakat farkı
- Ana metrik kartları eklendi:
  - Toplam kasa
  - Bu ay tahsilat
  - Bu ay gider
  - Bu ay net
  - Açık alacak
  - 3 gün içinde gider
  - Eşleşmemiş banka hareketi
  - Net sermaye
- Belgesiz kayıtlar ve akıllı finans uyarıları alt panel olarak daha görünür hale getirildi.

## Performans ve Veri Güvenliği

- Grafikler mevcut `LazyDashboardTerminalCharts` ile lazy load edilmeye devam eder.
- Client componentlere Prisma nesnesi, Decimal, Date veya BigInt doğrudan gönderilmedi.
- Dashboard data halen server-side hazırlanır ve `serializeEntity` sonrası client componentlere aktarılır.
- Pozitif/negatif/nötr finans renkleri mevcut `AmountText`, `PrivacyAmount`, `FinanceTicker` ve V4 tone sınıflarıyla tutarlı tutuldu.
