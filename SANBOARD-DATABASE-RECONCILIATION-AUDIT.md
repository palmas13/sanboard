# SANBOARD — Production Database Reconciliation Audit

**Audit tarihi:** 26 Eylül 2026
**Kapsam:** Local SQL dosyaları, Git geçmişi ve uygulamanın Supabase şema beklentileri
**Production değişikliği:** Yapılmadı

## En önemli sonuç

Production şemasının tamamı görülmeden eski migration dosyalarının uygulanmış olduğunu söylemek mümkün değildir. Bu rapor yalnız doğrulanmış bilgileri kesin kabul eder.

Kesin bilinenler:

- `20260925040000_corporate_store_moderation.sql` değişiklikleri production'da doğrulandı.
- `20260926000000_performance_indexes.sql` içindeki beş index production'da doğrulandı.
- Production'da `favorites_profile_id_listing_id_key` gerçek `UNIQUE(profile_id, listing_id)` constraint'i var; eski `uq_favorites_profile_listing` partial index'i yok.
- `20260926020000_business_logic_phase_1.sql` production'a uygulanmadı.

**Kritik durum:** Mevcut uygulama kodu, uygulanmamış Phase 1 migration'ındaki dört `payments` kolonu ile üç RPC'yi kullanıyor. Supabase production modu açıksa ödeme ve republish akışları şema ile kod arasında uyumsuz olabilir.

> **Uyarı: Eski SQL dosyaları SQL Editor'da körlemesine tekrar çalıştırılmamalı.** Bazıları veri günceller, duplicate siler, constraint/index değiştirir, fonksiyonları yeniden tanımlar veya daha sonraki migrationlarla ters düşer.

## Üretilen read-only audit

`supabase/scripts/production_schema_audit.sql` yalnız `SELECT` ve `WITH` sorguları içerir. Production SQL Editor'da tek script olarak çalıştırılıp bütün sonuç setleri dışa aktarılmalıdır.

Sonuç kolonları:

- `object_type`: tablo, kolon, index, constraint, function, policy vb.
- `object_name`: kontrol edilen nesne
- `expected_state`: local migration/kodun beklediği durum
- `actual_state`: production catalog'un bildirdiği durum
- `matches_expected`: beklenen durumla eşleşme

## Sınıflandırma

- **A — Production'da kesin mevcut:** Kullanıcı tarafından production'da doğrulanmış nesneler.
- **B — Hiç uygulanmamış olma ihtimali yüksek:** Kesin uygulanmadığı bilinen veya Git/deployment kanıtı bulunmayan yeni çalışma.
- **C — Kısmen uygulanmış/local dosyası sonradan değişmiş olabilir:** Aynı dosyanın Git'te sonradan değiştirilmesi veya production correction'ın önceki modelin yalnız bir bölümünü değiştirmesi.
- **D — Başka migration tarafından karşılanmış/obsolete:** Daha sonraki migrationın bilerek değiştirdiği eski model.
- **E — Production görülmeden karar verilemez:** Deployment kaydı yok; catalog audit gerekir.

## Git geçmişi özeti

- Tracked 15 SQL dosyası vardır: 14 migration ve `supabase/seed.sql`.
- `20260923000000_init_sanboard.sql` ve `seed.sql`, ilk commitlerinden sonra `8e77cf735024fb07d65d85dedf1cfd2004f854b0` commit'inde değiştirilmiştir.
- Başlangıç migration'ında:
  - `listings.location`: `NOT NULL` iken nullable yapılmıştır.
  - `favorites.profile_id`: `NOT NULL` iken nullable yapılmıştır.
- `seed.sql` dosyasına yalnız local/manual kullanım uyarıları eklenmiştir.
- Diğer tracked migrationlarda, eklendikten sonra Git history içinde içerik değişikliği bulunmamıştır.
- `20260926020000_business_logic_phase_1.sql` untracked'dır; Git geçmişinde commit'i yoktur.

---

## Migration dosyaları

### DOSYA: `20260923000000_init_sanboard.sql`

**NE YAPIYOR:** Temel şemayı kurar: users, character profiles, corporate profiles/applications, packages, payments, credits, listings ve detay/görsel/favorite/report/ticket/audit tabloları. Temel FK, CHECK, unique constraint, index ve ilk public listing policy'sini ekler.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Evet. `location` ve `favorites.profile_id` nullability'si sonradan değiştirildi.

**PRODUCTION DURUMU:** **C/E.** Uygulamanın çalışması temel tabloların önemli bölümünün mevcut olduğunu düşündürür; fakat production'ın dosyanın ilk mi son mu halini aldığı bilinmiyor.

**KONTROL GEREKİYOR MU:** Evet. Tablolar, kolon tip/nullability, FK/CHECK ve temel indexler catalog'dan kontrol edilmeli.

**RİSK:** Çok yüksek. Baştan çalıştırılması mevcut şemayı güvenilir biçimde “güncellemez”; `IF NOT EXISTS` mevcut kolon tanımlarını düzeltmez.

**SONRAKİ İŞLEM:** Audit çıktısına göre ayrı reconciliation migration hazırlanmalı. **SQL Editor'da körlemesine tekrar çalıştırılmamalı.**

### DOSYA: `20260924000000_notifications_and_roles.sql`

**NE YAPIYOR:** Favorites'a `user_id` ekler ve uniqueness'i account seviyesine taşır; `listing_price_history` ve `notifications` tablolarını oluşturur; mevcut favorites verisini backfill eder.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Hayır.

**PRODUCTION DURUMU:** **D/E.** Favorites account-unique modeli daha sonra character/profile modeline geri çevrilmiştir. Price history ve notifications varlığı ayrıca doğrulanmalı.

**KONTROL GEREKİYOR MU:** Evet.

**RİSK:** Yeniden çalıştırılırsa production'da doğrulanmış profile unique constraint'ini düşürüp eski account unique constraint'ini geri getirebilir.

**SONRAKİ İŞLEM:** Yalnız tablo/kolon varlığını audit et. **Kesinlikle körlemesine çalıştırılmamalı.**

### DOSYA: `20260924010000_complete_rls_and_security.sql`

**NE YAPIYOR:** `is_admin()` ve `get_auth_profile_ids()` SECURITY DEFINER fonksiyonlarını oluşturur; ana tablolarda RLS açar ve users/profiles/listings/payments/credits/favorites/notifications/tickets/reports için çok sayıda policy tanımlar.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Hayır.

**PRODUCTION DURUMU:** **E.** Production policy/fonksiyon catalog'u görülmeden bilinemez.

**KONTROL GEREKİYOR MU:** Evet; özellikle policy tanımları, RLS bayrağı ve helper function güvenliği.

**RİSK:** Eski policies `favorites.user_id`, `notifications.user_id` ve `users.role` modeline dayanabilir; daha sonraki character-scoped modele tam uymayabilir.

**SONRAKİ İŞLEM:** `pg_policies`, `pg_class.relrowsecurity` ve function definition çıktısını incele. **Körlemesine tekrar çalıştırılmamalı.**

### DOSYA: `20260924020000_vehicle_location_and_favorites.sql`

**NE YAPIYOR:** Vehicle location'ı nullable yapar; fiyat kolonlarını BIGINT'e çevirir; favorites'ı account-scoped modele geçirir, unresolved kayıt varsa abort eder, duplicate temizler; `update_listing_price` RPC'sini ve service-role izinlerini ekler.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Hayır.

**PRODUCTION DURUMU:** **D/E.** Location/BIGINT/RPC parçaları güncel olabilir; favorites account modeli daha sonra obsolete olmuştur.

**KONTROL GEREKİYOR MU:** Evet.

**RİSK:** Veri backfill'i, duplicate temizliği ve obsolete unique model içerir.

**SONRAKİ İŞLEM:** Parça parça audit et; bütün dosyayı tekrar çalıştırma. **Körlemesine çalıştırılmamalı.**

### DOSYA: `20260924030000_avatar_path_and_webp_media.sql`

**NE YAPIYOR:** `character_profiles.avatar_path` kolonunu ekler, `avatar_url` üzerinden R2 path backfill'i yapar ve kolon comment'i ekler.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Hayır.

**PRODUCTION DURUMU:** **E.** Kod `avatar_path` kullanıyor; production catalog kontrolü gerekli.

**KONTROL GEREKİYOR MU:** Evet.

**RİSK:** Backfill mevcut URL değerlerini dönüştürür; tekrar çalıştırmak yerine kolon/veri örnekleri kontrol edilmeli.

**SONRAKİ İŞLEM:** Kolon ve null/non-null veri sayılarını audit et.

### DOSYA: `20260924040000_corporate_public_id_and_indexes.sql`

**NE YAPIYOR:** Corporate `public_id` sequence/kolon/default/unique/not-null yapısını, `logo_path` ve `banner_path` kolonlarını kurar; path/public ID backfill'i ve çeşitli marketplace indexleri ekler.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Hayır.

**PRODUCTION DURUMU:** **E.** Kod public ID ve path alanlarını bekliyor; uygulanma kanıtı yok.

**KONTROL GEREKİYOR MU:** Evet.

**RİSK:** Deterministic olmayan tarihsel public ID ataması ve sequence `setval` işlemi içerir.

**SONRAKİ İŞLEM:** Sequence, default, unique constraint ve duplicate/null public ID kontrolü yap. **Körlemesine tekrar çalıştırılmamalı.**

### DOSYA: `20260924050000_gtaworld_oauth_and_audit.sql`

**NE YAPIYOR:** GTA World external user/character kimlikleri için partial unique indexler; `audit_logs` tablosu, indexleri, RLS ve service/admin policies oluşturur.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Hayır.

**PRODUCTION DURUMU:** **E.** Auth sync ve audit repository bu nesneleri bekliyor.

**KONTROL GEREKİYOR MU:** Evet.

**RİSK:** Unique indexler mevcut duplicate external ID varsa oluşturulamaz. Audit tablosu yoksa güvenlik kayıtları kaybolabilir/hata verebilir.

**SONRAKİ İŞLEM:** Index, tablo, RLS ve policy kontrolü yap.

### DOSYA: `20260924060000_lfm_stabilization.sql`

**NE YAPIYOR:** Contact alanlarını nullable yapar; `listings.seller_type` kolonunu backfill/default/not-null/CHECK ile ekler; vehicle detay kolonlarını ekler; `update_listing_price` RPC'sini her fiyat değişimini bildirecek şekilde yeniden tanımlar; index ekler.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Hayır.

**PRODUCTION DURUMU:** **C/E.** Önceki RPC'yi değiştirir ve sonraki kod seller_type/vehicle alanlarını kullanır. Production definition bilinmiyor.

**KONTROL GEREKİYOR MU:** Evet, özellikle RPC body ve notification CHECK uyumu.

**RİSK:** RPC `LISTING_PRICE_CHANGE` üretebilir; notification type CHECK bu değeri kabul etmiyorsa fiyat artışı transaction'ı hata verebilir.

**SONRAKİ İŞLEM:** `pg_get_functiondef`, notification CHECK ve kolonları audit et. **Körlemesine tekrar çalıştırılmamalı.**

### DOSYA: `20260924070000_public_ids_and_media_cleanup.sql`

**NE YAPIYOR:** Character `public_id` sequence/backfill/default/unique/not-null yapısını kurar; `media_cleanup_jobs` tablosunu, sıkı service-role erişimini, RLS policy ve indexleri oluşturur.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Hayır.

**PRODUCTION DURUMU:** **E.** Public profile routing ve media lifecycle kodu bu alan/tabloyu bekliyor.

**KONTROL GEREKİYOR MU:** Evet.

**RİSK:** Public ID backfill ve sequence ilerletme veri değiştirir. Cleanup tablosu yoksa başarısız R2 silmeleri güvenilir biçimde kuyruğa alınamaz.

**SONRAKİ İŞLEM:** Sequence, kolon, constraint, tablo grants/RLS/policy kontrolü yap. **Körlemesine tekrar çalıştırılmamalı.**

### DOSYA: `20260925000000_corporate_and_individual_separation.sql`

**NE YAPIYOR:** Case-insensitive SanMail ve phone unique indexleri; rejection reason; corporate subscription/expiry/boost/social media alanları; listing boost alanları/indexi; `corporate_followers` tablosu ve policies ekler.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Hayır.

**PRODUCTION DURUMU:** **C/E.** Corporate moderation'ın production'da olması bazı öncül corporate kolonların bulunma ihtimalini artırır ama bunu kanıtlamaz. Social media daha sonra normalize edilir.

**KONTROL GEREKİYOR MU:** Evet.

**RİSK:** Unique indexler normalization farklılıklarında hata verebilir. Followers `FOR ALL USING (true)` policy'si geniş yetkilidir.

**SONRAKİ İŞLEM:** Kolon/index/table/policy ve duplicate değerleri audit et.

### DOSYA: `20260925030000_production_schema_correction.sql`

**NE YAPIYOR:** Character role; favorites ve notifications character ownership; corporate owner uniqueness; phone normalization; package `seller_type`; individual/corporate credit ayrımı; corporate package; social media array normalizasyonu ve max-2 CHECK; notification index düzeltmeleri. Çok sayıda preflight ve data migration içerir.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Hayır.

**PRODUCTION DURUMU:** **C/E.** Favorites'ın son unique constraint'i ayrı hotfix ile production'da doğrulandı. Diğer correction parçalarının tamamının uygulanıp uygulanmadığı bilinmiyor.

**KONTROL GEREKİYOR MU:** Evet, yüksek öncelikli.

**RİSK:** Data normalization, backfill, constraint değişimi ve duplicate preflight içerir. Kısmi uygulanmış production'a tekrar verilmesi güvenli kabul edilemez.

**SONRAKİ İŞLEM:** Audit sonucuna göre yalnız eksik parçaları içeren yeni reconciliation migration yazılmalı. **SQL Editor'da körlemesine tekrar çalıştırılmamalı.**

### DOSYA: `20260925040000_corporate_store_moderation.sql`

**NE YAPIYOR:** Corporate moderation/soft-delete audit kolonları ve CHECK'i; aktif mağaza sahibi için partial unique index; `listing_credits.corporate_profile_id` FK kolonu ve lookup indexlerini ekler. Eski unconditional owner unique constraint'ini kaldırır.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Hayır.

**PRODUCTION DURUMU:** **A — production'da doğrulandı.**

**KONTROL GEREKİYOR MU:** Yine de audit script doğrulama satırları içeriyor; local ile production drift'i görülmeli.

**RİSK:** Tekrar çalıştırılması duplicate preflight ve constraint/index davranışı nedeniyle gereksiz risk yaratır.

**SONRAKİ İŞLEM:** Sadece read-only doğrula. **Tekrar çalıştırılmamalı.**

### DOSYA: `20260926000000_performance_indexes.sql`

**NE YAPIYOR:** Public category feed, individual dashboard, corporate inventory, subscription/moderation resolver ve support ticket ekranı için beş partial/composite index ekler.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Hayır.

**PRODUCTION DURUMU:** **A — beş index production'da doğrulandı.**

**KONTROL GEREKİYOR MU:** Definition drift'i için audit script ile kontrol edilebilir.

**RİSK:** Düşük; fakat zaten uygulanmış dosyayı tekrar çalıştırmak deployment kaydını düzeltmez.

**SONRAKİ İŞLEM:** Yeniden uygulama yok; yalnız catalog doğrulaması.

### DOSYA: `20260926010000_favorites_profile_unique_constraint.sql`

**NE YAPIYOR:** Aynı `(profile_id, listing_id)` kayıtlarından düşük UUID'li olanları siler; eski partial index'i kaldırır; gerçek unique constraint'i kurar.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Hayır.

**PRODUCTION DURUMU:** **A — sonuç durumu production'da doğrulandı.** Constraint var, eski partial index yok.

**KONTROL GEREKİYOR MU:** Audit sonucu aynı durumu tekrar doğrulayabilir.

**RİSK:** Dosya `DELETE` içerir. Tekrar çalıştırılması gereksiz veri silme riski taşır.

**SONRAKİ İŞLEM:** **SQL Editor'da kesinlikle tekrar çalıştırılmamalı.**

### DOSYA: `20260926020000_business_logic_phase_1.sql`

**NE YAPIYOR:** Payment idempotency/entitlement kolonları ve unique indexleri; listing credit payment uniqueness ve used-listing lookup indexi; payment completion, atomic create ve republish RPC'leri; RPC service-role izinleri; kategori/fotoğraf/credit kontrolleri ekler.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Git'e hiç eklenmemiştir. Önceki inceleme sırasında local dosya güvenlik düzeltmeleri almıştır; Git üzerinden tarihsel sürüm karşılaştırması yapılamaz.

**PRODUCTION DURUMU:** **B — kesin uygulanmadı.**

**KONTROL GEREKİYOR MU:** Evet. Audit'te bu nesnelerin beklenen şekilde yok olması kontrol edilir; beklenmedik biçimde varsa manuel/partial uygulama araştırılmalıdır.

**RİSK:** **P0.** Mevcut production uygulama kodu bu migration'daki kolon ve RPC'leri çağırıyor.

**SONRAKİ İŞLEM:** Bu görevde uygulanmayacak. Audit ve duplicate preflight sonrası ayrı deployment/reconciliation kararı verilmeli. SQL Editor'da henüz körlemesine çalıştırılmamalı.

### DOSYA: `supabase/seed.sql`

**NE YAPIYOR:** Local geliştirme için package, kullanıcı, karakter, corporate store, listing/detail/image, favorite, price history, notification ve ticket örnek verileri ekler.

**LOCAL'DE SONRADAN DEĞİŞMİŞ Mİ:** Evet; local/manual kullanım güvenlik uyarıları eklenmiştir.

**PRODUCTION DURUMU:** Migration değildir; production'a uygulanmış kabul edilmemelidir.

**KONTROL GEREKİYOR MU:** Hayır; production reconciliation için yalnız package code referansı olarak incelendi.

**RİSK:** Çok yüksek. Demo veri ekler ve eski conflict target/model beklentileri taşıyabilir.

**SONRAKİ İŞLEM:** **Production SQL Editor'da asla çalıştırılmamalı.**

---

## Aynı nesneyi değiştiren migrationlar

- **Favorites:** init → notifications/account uniqueness → vehicle/account backfill → production correction/profile ownership → favorites hotfix/real constraint.
- **Notifications:** notifications table → RLS policies → price RPC writes → production correction recipient profile normalization.
- **`update_listing_price`:** `20260924020000` oluşturur; `20260924060000` body'yi değiştirir.
- **Listing location/price:** init tanımı daha sonra `20260924020000` ile nullable/BIGINT yapılır.
- **Corporate profiles:** public ID/media paths → subscription/boost/social → production normalization → moderation/soft delete.
- **Corporate owner uniqueness:** `20260925030000` unconditional constraint → `20260925040000` partial unique index.
- **Listing credits:** init → credit type/amount → corporate profile binding → Phase 1 payment/used-listing indexleri.
- **Public IDs:** corporate ve character için ayrı migrationlar sequence/backfill yapar.

## Kod ile production şeması arasındaki riskler

### P0 — Phase 1 payment kolonları production'da yok

Kod şunları select/insert ediyor:

- `payments.idempotency_key`
- `payments.corporate_profile_id`
- `payments.entitlement_type`
- `payments.entitlement_applied_at`

Kaynak: `src/lib/db/repositories/supabase/supabase-payment-repo.ts` ve checkout route. Phase 1 uygulanmadığı için yeni checkout oluşturma production'da PostgREST kolon hatası verebilir.

### P0 — `complete_sanboard_payment` production'da yok

Başarılı provider ödemesinden sonra kod bu RPC'yi çağırıyor. RPC yoksa provider başarılı olsa bile DB payment/credit/subscription tamamlanmayabilir.

### P0 — `republish_listing_with_credit` production'da yok

Republish repository doğrudan RPC çağırıyor; güvenli fallback yok. Production republish başarısız olur.

### P1 — `create_listing_with_credit` production'da yok

Kod önce RPC'yi çağırıyor; isim bulunamadığında legacy multi-step fallback'e geçebiliyor. Bu fallback atomik değildir ve transaction yarıda kalabilir.

### P1 — Account bootstrap yanlış tablo/kolon bekliyor

- `src/app/api/account/bootstrap/route.ts` `.from('tickets')` kullanıyor; local şema `support_tickets` oluşturuyor.
- Aynı route `listing_credits.balance` select ediyor; local migrationlarda `balance` kolonu yok, kredi modeli satır başına bir credit.

Bu iki beklenti Phase 1'den bağımsız production runtime hatası riski taşır.

### P1 — Notification CHECK ile RPC tipi uyumsuz olabilir

Son `update_listing_price` RPC'si `LISTING_PRICE_CHANGE` üretiyor. İlk notifications CHECK listesinde bu değer yoktur. Production constraint definition mutlaka kontrol edilmelidir.

### P1 — RLS ownership drift'i olabilir

Eski policies favorites/notifications için `user_id` kullanırken son veri modeli profile-scoped alanları kullanıyor. Production policy definitions audit edilmelidir.

## Production'da yapılacak kontroller

1. `supabase/scripts/production_schema_audit.sql` dosyasını SQL Editor'da çalıştır.
2. Her sonuç setini CSV/JSON olarak kaydet.
3. Öncelikle `matches_expected = false` satırlarını incele.
4. Phase 1 nesneleri beklenmedik biçimde varsa kimin/ne zaman manuel uyguladığını araştır.
5. `migration_ledger` sonucunu local dosya adlarıyla karşılaştır; ledger tek başına schema doğrusu değildir.
6. Duplicate preflight sonucu boş değilse hiçbir unique constraint migrationı hazırlama.
7. Function sonuçlarında `actual_definition` ve execute yetkilerini kontrol et.
8. Policies sonucunda favorites/notifications ownership kolonlarını kontrol et.
9. Trigger sonucunda çıkan her satırı manuel değerlendir; local SQL hiçbir application trigger tanımlamıyor.
10. Audit sonucu alınmadan hiçbir eski migrationı yeniden çalıştırma.

## Sonraki aşama

Audit çıktısından sonra, yalnız production'da eksik veya farklı olduğu kanıtlanan nesneleri düzelten **yeni ve ayrı** bir reconciliation migration hazırlanmalıdır. Eski migration dosyaları değiştirilmemeli ve tekrar oynatılmamalıdır.
