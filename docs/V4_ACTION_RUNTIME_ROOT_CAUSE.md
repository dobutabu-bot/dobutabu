# V4 Runtime Aksiyon Kök Neden Raporu

## Doğrulanan Hata

- Ekran: `/clients?create=1`
- Aksiyon: gerçek tarayıcıdan `Kaydet`
- Endpoint: `POST /api/clients`
- Sonuç: HTTP `403`
- Response: `{ "message": "İstek reddedildi" }`
- Route handler durumu: istek route handler'a ulaşmadan middleware tarafından kesildi.
- Session durumu: geçerli. Aynı cookie ile private GET sayfaları açıldı ve düzeltme sonrasında POST/PATCH/DELETE/restore çalıştı.

## Kök Neden

Development sunucusu `0.0.0.0` üzerinde dinlerken kullanıcı paneli `http://localhost:3000` üzerinden açıyordu. Middleware mutating isteklerde `Origin` değerini yalnız `request.nextUrl.origin` ve opsiyonel `APP_URL` ile karşılaştırıyordu. Next.js'in sunucu tarafında oluşturduğu origin ile tarayıcıdaki `localhost` origin'i farklı değerlendirildiğinde güvenli, aynı-site istek yanlışlıkla cross-origin kabul edilip 403 ile reddediliyordu.

## Düzeltme

Origin allowlist aşağıdaki güvenilir kaynaklardan deterministik biçimde oluşturuldu:

- `request.nextUrl.origin`
- doğrulanmış `APP_URL` origin'i
- `Host` veya reverse proxy arkasında `X-Forwarded-Host`
- `X-Forwarded-Proto` veya request protokolü

Geçersiz Host değeri allowlist'i genişletmiyor. `Sec-Fetch-Site` kontrolü ve private route session kontrolü korunuyor; auth veya CSRF koruması kaldırılmadı.

Client aksiyonları aynı-origin cookie'yi açıkça taşıyan ortak `apiRequest` helper'ına geçirildi. Güvenli sunucu mesajı yoksa 401/403/404/405/409/422/500 için kullanıcı dostu standart mesaj gösteriliyor.

## Gerçek Tarayıcı Kanıtı

Aynı Chrome oturumu ve aynı kullanıcı cookie'si ile:

- Müvekkil oluşturma: PASS
- Müvekkil düzenleme: PASS
- Müvekkil soft delete: PASS
- Müvekkil restore: PASS
- Avans üç nokta menüsü açma: PASS
- Menüden düzenleme modalı açma: PASS
- Dosya düzenleme/arşivleme/geri alma: PASS
- Tahsilat, gider ve avans düzenleme/silme/geri alma: PASS
- Taslak makbuz silme ve kesilmiş belge iptali: PASS
- Belge metadata düzenleme/silme/geri alma/private preview: PASS
- Hatırlatma düzenleme/tamamlama/açma/silme/geri alma: PASS
- Kasa hesabı ve sermaye varlığı düzenleme/arşivleme/geri alma: PASS
- Mutabakat yoksayma/geri alma: PASS

Test kaydı `RUNTIME-CRUD-TEST-...` önekiyle oluşturuldu; kullanıcı verileri üzerinde toplu değişiklik yapılmadı.

## İkincil Runtime Kök Nedenleri

- Aksiyon menüsü kapandığında children ağacı unmount edildiği için menüden açılan edit/confirm modalı request göndermeden kayboluyordu. Portal menü ilk açılıştan sonra DOM'da kalacak, kapalıyken yalnız görünmez ve erişilemez olacak biçimde düzeltildi.
- Select alanları hydration sonrasında varsayılan değere dönebiliyordu. Form readiness işareti ve kontrollü React Hook Form select senkronizasyonu eklendi.
- Aynı sekmede iki ayrı data-mutation refresh tetikleyicisi form state'ini gecikmeli sıfırlayabiliyordu. AppShell yalnız cross-tab storage mutasyonlarını dinleyecek hale getirildi.
- Yoksayılan banka hareketi listelerden tamamen düşerek geri alınamaz oluyordu. Ayrı yoksayılan hareketler tablosu ve mevcut onaylı undo aksiyonu eklendi.
- Temiz geliştirme koşusunda çok sayıda App Router route'unun ilk derlemesi toplam test süresini altı dakikanın üzerine çıkarıyordu. Assertions değiştirilmeden yalnız testin toplam soğuk derleme bütçesi 600 saniyeye yükseltildi; mutabakat fixture'ı aynı bileşeni kullanan import-scope route'unda doğrulandı.
