# Demo Data Dry Run

Tarih: 12.07.2026  
Durum: **DRY-RUN VE KONTROLLÜ TEMİZLİK TAMAMLANDI**

## Kapsam

Yalnız aşağıdaki kesin marker değerleri kullanıldı:

- `V3RC1-REALISTIC`
- `FINAL-RUNTIME-TEST`
- `RUNTIME-CRUD-TEST`

Tek başına `Test` kelimesi silme kriteri değildir. Admin kullanıcı, uygulama ayarları ve sistem kategorileri kapsam dışındadır.

## Kesin Demo Hedefleri

| Model | Kayıt |
|---|---:|
| Müvekkil | 78 |
| Dosya | 99 |
| Kasa hesabı | 19 |
| Tahsilat | 284 |
| Gider | 315 |
| Makbuz/Fatura | 150 |
| Belge | 95 |
| Banka import | 14 |
| Banka hareketi | 611 |
| Kasa hareketi | 591 |
| Varlık | 31 |
| Varlık değerleme | 251 |
| Varlık hareketi | 251 |
| Hatırlatma | 62 |
| Belge etiketi | 8 |
| Kullanıcı kategorisi | 8 |
| İşlem kuralı | 8 |

Marker taşıyan banka kolon eşleme, kasa transferi ve sermaye import kaydı bulunmadı.

## Belirsiz Kayıtlar

Aşağıdaki kayıtlar yalnız `Test` kelimesi içeriyor, üç kesin marker’dan hiçbirini taşımıyor. **Silinmeyecekler.**

| Model | Belirsiz kayıt |
|---|---:|
| Müvekkil | 1 |
| Tahsilat | 2 |
| Gider | 2 |
| Belge | 12 |
| Kasa hesabı | 1 |
| Banka import | 6 |

Dosya, makbuz/fatura, hatırlatma ve sermaye varlığı modellerinde yalnız `Test` kelimesi taşıyan ek belirsiz kayıt bulunmadı.

## Temizlik Yöntemi

- Ana kayıtlar mevcut soft-delete mimarisine uygun olarak tek Prisma transaction içinde `deletedAt` ile kapatılacak.
- Kasa ve sermaye kayıtları ayrıca pasif yapılacak; dosyalar arşiv durumuna alınacak.
- Marker audit kayıtları transaction içinde kaldırılacak.
- Admin kullanıcı, `AppSetting` kayıtları ve `isSystem=true` kategoriler korunacak.
- Gerçek/non-demo kayıtlar hiçbir toplu sorgunun hedefi olmayacak.
- Temizlik sonunda aktif kasa hesabı kalmayan kullanıcı için `Ana Kasa / TRY / 0 / default` oluşturulacak.

## Fiziksel Belgeler

95 demo belge arasından yalnız **1** dosya hem kesin marker taşıyor hem de müvekkil, dosya, finans kaydı, banka importu veya sermaye kaydı tarafından referans edilmiyor:

- `v3rc1-realistic-043.png`

Diğer fiziksel belge dosyaları referanslı oldukları için silinmeyecek. Veritabanındaki belge kayıtları soft-delete edilecek.

## Güvenlik Kapısı

Gerçek temizlikten önce aktif SQLite veritabanının tarih-saatli tam yedeği alındı:

- `recovery-backups/demo-cleanup-before-20260712-004641.db`
- Boyut: `9.678.848` bayt
- SHA-256: `390e1211e640f7cb011a830f086e2544afb995c55d2c437e744b949fd6a54766`
- SQLite bütünlük kontrolü: `ok`

## Uygulama Sonucu

- Kesin marker taşıyan hedeflerin tamamı tek Prisma transaction içinde soft-delete/pasif duruma alındı.
- Aktif kesin-marker sayısı müvekkil, dosya, tahsilat, gider, belge, banka hareketi, varlık, hatırlatma ve kasa hesabında `0` olarak doğrulandı.
- Yalnız `Test` kelimesi taşıyan belirsiz kayıtların sayıları dry-run ile aynı kaldı; hiçbirine dokunulmadı.
- Kullanıcı sayısı `1`, ayar sayısı `5` olarak korundu.
- Temizlik sonunda aktif demo olmayan kasa kalmadığı için `Ana Kasa / CASH / TRY / 0 / default` oluşturuldu.
- Referanssız fiziksel demo belge adayı storage alanında zaten bulunmadığından sonuç `missing` oldu; başka fiziksel dosya silinmedi.
