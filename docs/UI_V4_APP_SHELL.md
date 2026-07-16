# UI V4 AppShell Düzenlemesi

Tarih: 2026-07-10

## Amaç

Uygulama kabuğu, tek satırlık ham link görünümünden çıkarılıp desktop ve mobilde tutarlı çalışan premium bir finans uygulaması düzenine alındı. Bu çalışma yalnızca navigasyon ve kabuk düzenini etkiler; finans hesapları, CRUD, soft delete, audit log, ledger ve mutabakat mantığı değiştirilmedi.

## Yapılanlar

- Menü yapısı tek kaynaklı `NAV_GROUPS` modeliyle gruplandı.
- Desktop sidebar; marka alanı, mantıksal menü grupları, aktif route vurgusu, Ayarlar ve Çıkış alanı olarak düzenlendi.
- Mobil drawer; aynı menü gruplarını kart düzeninde gösterir hale getirildi.
- Topbar; sayfa başlığı, global arama, gizlilik modu, bildirim merkezi ve kullanıcı menüsü olarak sadeleştirildi.
- Mobil alt navigasyon kritik 5 route için korundu: Dashboard, Dijital Kasa, Tahsilatlar, Giderler, Raporlar.
- Sidebar, drawer ve nav item içeriklerinde `min-w-0`, `truncate`, kontrollü scroll ve minimum 44px dokunmatik hedef yaklaşımı korundu.

## Menü Grupları

- ANA: Dashboard
- DOSYA YÖNETİMİ: Müvekkiller, Dosyalar, Belgeler
- FİNANS: Tahsilatlar, Giderler, Avanslar, Makbuz/Fatura, Dijital Kasa
- AKILLI FİNANS: Banka Ekstreleri, Mutabakat, Sermaye, Raporlar
- YÖNETİM: Hatırlatmalar, İşlem Geçmişi, Ayarlar

## Korunanlar

- AppShell ilk render deterministik kalır; aktif route vurgusu hydration sonrası uygulanır.
- Client componentlere function prop, Prisma nesnesi, Decimal, Date veya BigInt geçirilmedi.
- Menü verisi component içinde koşullu üretilmez; `src/lib/navigation.ts` üzerinden gelir.
- Mobilde safe-area ve alt navigasyon davranışı korunur.
