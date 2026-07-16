# UI V4 Design System

Tarih: 2026-07-10

Bu dokuman, V4 premium UI calismasinda olusturulan ortak tasarim sistemi katmanini ozetler. Bu asamada yeni is ozelligi eklenmedi; finans, CRUD, soft delete, audit log, ledger ve mutabakat mantigina dokunulmadi.

## Tasarim Ilkesi

Arayuz dili su hedeflere gore standartlastirildi:

- macOS uygulamasi kadar temiz ve rafine
- Apple urun sayfasi kadar ferah, ancak marka/arayuz kopyasi degil
- finans terminali kadar veri odakli
- hukuk burosuna uygun ciddi, guven veren ve sakin
- mobile-first
- yuksek performansli ve tekrar kullanilabilir component mimarisi

## Token Kaynagi

Ana token kaynagi:

- `src/app/globals.css`
- `src/lib/ui/design-tokens.ts`

CSS degiskenleri `--v4-*` ad alaniyla tanimlandi. Eski `--v2-*` degiskenleri geriye donuk uyumluluk icin V4 tokenlarina alias edildi.

Temel token gruplari:

- Renk: background, surface, glass, border, accent, positive, negative, warning, info, disabled
- Layout: sidebar width, header height, max content width, touch target
- Radius: card, compact card, field
- Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48
- Shadow: soft, card, dark terminal
- Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", sans-serif`

## Global UI Siniflari

Mevcut ve yeni ekranlarda kullanilacak ortak siniflar:

- `app-content-shell`
- `surface`
- `surface-dark`
- `premium-card`
- `glass-panel`
- `finance-terminal-panel`
- `digital-drilldown-panel`
- `digital-glass`
- `field`
- `label`
- `icon-button`
- `primary-action`
- `secondary-action`
- `danger-action`
- `tabular-finance`
- `v4-page-header`
- `v4-page-toolbar`
- `v4-filter-grid`
- `v4-chart-card`
- `v4-mobile-record-card`

## Ortak Componentler

Var olan componentler korundu ve V4 token diline uyumlu hale getirildi:

- `AppShell`
- `PremiumCard`
- `GlassPanel`
- `MetricCard`
- `AmountText`
- `TrendBadge`
- `StatusBadge`
- `DataTable`
- `EmptyState`
- `LoadingSkeleton`
- `ConfirmDialog`
- `FormModal`

Yeni eklenen tekrar kullanilabilir componentler:

- `Sidebar`
- `TopBar`
- `MobileNavigation`
- `PageHeader`
- `PageToolbar`
- `SearchField`
- `FilterBar`
- `ErrorState`
- `MobileRecordCard`
- `ChartCard`
- `FinanceMetric`
- `QuickActionButton`
- `ActionMenu`
- `Drawer`
- `Modal`
- `Pagination`
- `DateRangePicker`

## Layout Kararlari

- Desktop sidebar genisligi `16rem` olarak tokenlastirildi.
- Header yuksekligi `var(--v4-header-height)` ile standartlastirildi.
- Ana icerik `app-content-shell` ile `1600px` max width icinde tutuldu.
- Mobil alt navigasyon korunarak ortak `MobileNavigation` componentine baglandi.
- Touch target minimumu `44px` olarak tokenlastirildi.

## Finans Renk Mantigi

Renk anlami tum uygulamada ayni kalmali:

- Pozitif / giris / artis: emerald
- Negatif / cikis / azalis: rose
- Uyari: amber
- Bilgi: mavi
- Notr: slate/gri

Finansal rakamlar `tabular-nums` veya `tabular-finance` ile gosterilmeli.

## Uygulama Kurali

Yeni veya duzenlenen sayfalarda gelisiguzel renk, radius, shadow ve spacing yazmak yerine:

1. Once ortak component kullan.
2. Component yeterli degilse global V4 sinifi kullan.
3. En son care olarak token bazli lokal class kullan.

Bu kural, sayfalar arasinda lacivert/beyaz/yesil/kirmizi uyumunun bozulmamasini ve uygulamanin premium dijital finans paneli hissini korumasini saglar.

## Dogrulama

Bu asamada calistirilan kontroller:

- `npm run typecheck`: PASS
- `npm run lint`: PASS

Build kontrolu Aşama 3 sonunda ayrica calistirilmalidir.
