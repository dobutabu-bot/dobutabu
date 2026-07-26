# Düşük Maliyetli Production Kapısı

Railway Hobby geçişi ancak aşağıdaki satırların tamamı PASS olduktan sonra yapılabilir:

- Production kaynağının güncel main commit ile eşitliği
- Şifreli R2 baseline backup
- R2'den geri indirme
- AES-256-GCM authentication
- SQLite `PRAGMA integrity_check = ok`
- Tüm tablo kayıt sayımlarının eşitliği
- Belge manifesti ve fiziksel dosya checksum eşitliği
- İzole restore provası
- GitHub günlük schedule ve manuel workflow
- Production health, login, dashboard, PDF ve belge preview
- Restart sonrası SQLite ve belge persistence
- Domain, variables, volume ve tek replica korunumu

Bu kapı tamamlanmadan Hobby plan satın alma/onay adımı başlatılmaz. Railway native backup paneli Pro-only görünüyorsa native backup `UNAVAILABLE` olarak kaydedilir; Pro plana otomatik geçiş yapılmaz.

## Hedef Maliyet

Hobby minimum kullanım bedeli aylık yaklaşık `$5` seviyesidir. Gerçek fatura CPU, RAM, egress ve volume tüketiminin dahil krediyi aşmasına göre değişebilir. `$7` e-posta uyarısı ve `$10` hard limit yalnız Railway Hobby planı etkinleştirildikten ve panel desteği doğrulandıktan sonra ayarlanır.
