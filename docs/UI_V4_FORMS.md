# UI V4 Ortak Premium Form Standardı

Tarih: 2026-07-10

## Amaç

Uygulamadaki CRUD, modal, drawer ve belge yükleme formlarını tek ve tutarlı bir premium form standardına almak.

## Eklenen Ortak Bileşenler

`src/components/premium-form.tsx` içinde:

- `FormSection`
- `FormField`
- `Label`
- `HelperText`
- `ErrorText`
- `Select`
- `Combobox`
- `CurrencyInput`
- `DateInput`
- `Textarea`
- `Switch`
- `SubmitBar`

## Uygulanan Davranışlar

- Etiketler inputların üstünde gösterilir.
- Zorunlu alan göstergesi desteklenir.
- Hata mesajları alan altında anlaşılır biçimde gösterilir.
- Tutar alanları ortak `CurrencyInput` ile TRY odaklı, tabular sayı görünümüyle gösterilir.
- Mobilde alanlar minimum 44 px dokunmatik hedef standardına uyumludur.
- Submit sırasında ikinci tıklama kilidi korunur.
- Hata durumunda form state korunur.
- Başarı sonrası toast ve modal/drawer kapanma davranışı korunur.
- Modal ve drawer formlarında `Vazgeç` butonu eklendi.

## Güncellenen Form Katmanları

- `EntityForm` ortak premium form bileşenlerine geçirildi.
- `RecordCreateButton`, `RecordCreateDrawerButton` ve `RecordEditButton` cancel davranışıyla bağlandı.
- `DocumentUploadForm` metadata ve bağlantı alanlarında ortak form primitives kullanacak şekilde güncellendi.

## Korunan Davranışlar

- Mevcut API endpointleri değiştirilmedi.
- Zod validation şemaları değiştirilmedi.
- CRUD, soft delete, ledger ve audit log akışları değiştirilmedi.
- Form submit payload yapısı korunur.

## Doğrulama

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS

