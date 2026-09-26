# SANBOARD — Production Reconciliation Sonucu

**Tarih:** 26 Eylül 2026
**Production değişikliği:** Yapılmadı
**Supabase db push:** Yapılmadı
**Commit / push:** Yapılmadı

## Kısa sonuç

Production audit 178 kontrolün 156'sının hedefle uyumlu, 22'sinin uyumsuz olduğunu gösterdi. Bu 22 satırın tamamı aynı tür problem değildir:

- Bir bölümü henüz uygulanmamış Phase 1'in beklenen eksikleridir.
- İki tanesi uygulama kodunun yanlış tablo/kolon beklemesidir.
- Dört tanesi yalnız `text` / `varchar` gösterim farkıdır ve production değişikliği gerektirmez.
- Bir tanesi eksik ürün paketidir ve fiyat kararı gerektirir.
- Migration ledger eksikliği hata değildir.
- Duplicate preflight boş dönmüştür; denetlenen conflict/duplicate problemi yoktur.
- Favorites RLS ve `update_listing_price` gerçek reconciliation adaylarıdır.

## A) Production zaten doğru olanlar

### Canonical destek tablosu

Doğru tablo `public.support_tickets`'tır. `public.tickets` tablosunun olmaması doğrudur. Yeni `tickets` tablosu oluşturulmadı ve destek sistemi çoğaltılmadı.

### Row-based ilan kredisi modeli

`listing_credits` tablosunda `balance` kolonu olmaması doğrudur. Her satır tek bir yayın hakkını temsil eder. Kullanılabilir bakiye, `status = 'AVAILABLE'` satırlarının sayısıdır.

### Duplicate preflight

Audit Result Set 11 hiç satır döndürmedi. Denetlenen unique constraint/index işlemlerini engelleyen duplicate veya conflict bulunmadı.

### Migration ledger

`supabase_migrations.schema_migrations` olmaması tek başına schema hatası değildir. Ledger tablosu oluşturulmadı ve schema doğruluğu ledger'a bağlanmadı.

### `text` / `varchar` farkları

Şu alanlardaki farklılıklar cosmetic/metadata farkı olarak değerlendirildi:

- `character_profiles.phone`
- `character_profiles.sanmail_email`
- `listing_credits.credit_type`
- `packages.seller_type`

Uygulamanın kullandığı değer semantiğini değiştirmedikleri için sırf audit eşleşsin diye `ALTER TYPE` hazırlanmadı. Audit beklentisinin canonical migration gerçeğine göre güncellenmesi daha güvenlidir.

## B) Yalnız kod tarafında yanlış olanlar

### Account bootstrap — `tickets` yerine `support_tickets`

`src/app/api/account/bootstrap/route.ts` düzeltildi:

- `.from('tickets')` kaldırıldı.
- `.from('support_tickets')` kullanılıyor.
- Ticket sayımı account `user_id` yerine aktif karakterin `profile_id` alanıyla yapılıyor.

### Account bootstrap — `balance` yerine AVAILABLE satır sayısı

Aynı route düzeltildi:

- `.select('balance')` kaldırıldı.
- `listing_credits` üzerinde `profile_id` ve `status = 'AVAILABLE'` filtreli head/count sorgusu kullanılıyor.
- N+1 oluşturulmadı; tek aggregate count sorgusu var.

### Test koruması

`tests/stabilization-pass.test.ts` içine source-level regresyon kontrolü eklendi. Test:

- `support_tickets` kullanımını,
- `tickets` kullanılmamasını,
- AVAILABLE satır sayımını,
- `balance` seçilmemesini doğruluyor.

## C) Phase 1 uygulanınca gelecek olanlar

Şu production eksikleri ayrı drift olarak ele alınmadı; final Phase 1 migrationının kapsamındadır:

- `payments.idempotency_key`
- `payments.corporate_profile_id`
- `payments.entitlement_type`
- `payments.entitlement_applied_at`
- `uq_payments_profile_idempotency`
- `uq_payments_external_payment_id`
- `uq_listing_credits_payment`
- `idx_listing_credits_used_listing`
- `chk_payments_entitlement_type`
- `payments.corporate_profile_id -> corporate_profiles.id`
- `complete_sanboard_payment`
- `create_listing_with_credit`
- `republish_listing_with_credit`

### Phase 1 production-safety doğrulaması

`supabase/migrations/20260926020000_business_logic_phase_1.sql` şu kuralları sağlıyor:

- `used_listing_id` unique değildir.
- Eski `uq_listing_credits_used_listing` düşürülür.
- Normal `idx_listing_credits_used_listing` oluşturulur.
- Kurumsal ilan paketinin 1750 fiyatı kredi türünü belirlemek için kullanılmaz; kredi türü package code üzerinden belirlenir.
- Vehicle en fazla 3, property en fazla 5 görsel kabul eder.
- Geçersiz kategori reddedilir.
- Üç SECURITY DEFINER RPC için PUBLIC, `anon`, `authenticated` execute yetkileri kaldırılır.
- Yalnız `service_role` execute alır.

### Ek güvenlik sertleştirmesi

Phase 1 henüz uygulanmadığı için kendi dosyasında güvenli biçimde sertleştirildi:

- Paket aktif olmalıdır.
- Paket fiyatı sıfırdan büyük olmalıdır.
- Payment amount, authoritative package price ile aynı olmalıdır.
- Subscription yalnız şu kombinasyonla açılır:
  - code `CORPORATE_SUBSCRIPTION_30_DAY`
  - entitlement `CORPORATE_SUBSCRIPTION`
  - seller type `CORPORATE`
  - duration `30`
  - geçerli corporate profile bağlantısı
- Yanlış package/entitlement kombinasyonu ücretsiz veya yanlış üyelik açamaz.

Uygulamanın memory ve Supabase payment repository'leri de sıfır/negatif fiyatlı veya yanlış yapılandırılmış subscription paketini sipariş aşamasında reddedecek şekilde düzeltildi.

## D) Gerçek production schema düzeltmesi gerekenler

Hazırlanan fakat **uygulanmayan** migration:

`supabase/migrations/20260926030000_production_schema_reconciliation.sql`

### 1. Favorites RLS

Production policy'leri yalnız `user_id = auth.uid()` kontrol ediyordu. Bu modelde authenticated bir kullanıcı kendi `user_id` değerini yazıp başka hesaba ait bir `profile_id` gönderebilir. Bu, başka hesabın karakteri adına favorite oluşturma ve unique ilişkiyi zehirleme riski taşır.

Önerilen RLS sınırı:

```sql
profile_id IN (SELECT public.get_auth_profile_ids())
```

Bu helper, `character_profiles.user_id = auth.uid()` üzerinden account ownership doğruladığı için uygundur. DB'de bulunmayan `activeProfileId` kavramı uydurulmadı. Aynı account altındaki Mavis/Ravi aktif-karakter ayrımı uygulama session'ında korunmaya devam eder; RLS başka account'ın profile ID'sini engeller.

Migration SELECT, INSERT ve DELETE policy'lerini `profile_id` ownership esasına taşır. Admin SELECT/DELETE istisnası korunur.

### 2. `update_listing_price`

#### Production'da tamamen mi yok?

Audit exact signature satırını `MISSING` bildirdi. Bu, canonical signature'ın bulunmadığını kanıtlar; yalnız bu sonuçla aynı isimde farklı overload/signature olup olmadığı kesin söylenemez. Production function inventory/details CSV'si farklı signature satırı içeriyorsa bu bir signature drift'idir; içermiyorsa function tamamen yoktur.

#### Canonical signature nedir?

Local migrationların son canonical kimliği:

```text
public.update_listing_price(uuid, bigint, uuid, uuid, text, text)
```

İlk definition `20260924020000_vehicle_location_and_favorites.sql`, son replacement `20260924060000_lfm_stabilization.sql` içindedir.

#### Uygulama gerçekten çağırıyor mu?

Evet. `src/lib/db/repositories/supabase/supabase-listing-repo.ts` ilan title/description/price güncellemesinde bu RPC'yi altı named argument ile çağırıyor.

#### Fiyat değiştirme şu anda nasıl çalışıyor?

RPC başarılıysa atomic PostgreSQL fonksiyonu kullanılıyor. RPC yoksa veya hata verirse repository sessizce sequential fallback'e geçiyor:

1. price history insert,
2. fiyat düşüşü notification insertleri,
3. listings update.

Bu fallback atomic değildir ve yalnız fiyat düşüşü notification'ı üretir. Dolayısıyla uygulamanın çalışıyor görünmesi RPC'nin production'da var olduğunu kanıtlamaz.

#### Reconciliation adayı

Yeni migration canonical exact signature'ı character-scoped modele göre oluşturur/değiştirir:

- favorites alıcıları `profile_id` ile seçilir,
- notifications `recipient_profile_id` ile yazılır,
- legacy `user_id` yalnız ilgili character profile'dan türetilir,
- seller profile notification dışı bırakılır,
- price update/history/notifications aynı transaction içindedir,
- PUBLIC/anon/authenticated execute kapalıdır,
- `service_role` execute açıktır.

Fonksiyonun ürettiği `LISTING_PRICE_CHANGE` değeri için notification type CHECK de hedefli olarak güncellenir.

### Favorites nullability — henüz migrationa alınmadı

Canonical sahiplik `(profile_id, listing_id)` olmakla birlikte migration history'de account-scoped dönemde `profile_id` nullable yapılmıştır. Daha sonraki correction belirsiz multi-character legacy kayıtları tahmin ederek backfill etmemiştir. Bu nedenle production verisi görülmeden `SET NOT NULL` hazırlanmadı.

Production'da çalıştırılması gereken read-only preflight:

```sql
WITH favorite_health AS (
  SELECT
    COUNT(*) FILTER (WHERE f.profile_id IS NULL) AS null_profile_rows,
    COUNT(*) FILTER (
      WHERE f.profile_id IS NOT NULL
        AND cp.id IS NULL
    ) AS orphan_profile_rows,
    COUNT(*) FILTER (
      WHERE f.profile_id IS NOT NULL
        AND f.user_id IS NOT NULL
        AND cp.user_id IS DISTINCT FROM f.user_id
    ) AS profile_user_mismatch_rows
  FROM public.favorites f
  LEFT JOIN public.character_profiles cp ON cp.id = f.profile_id
)
SELECT * FROM favorite_health;

SELECT f.id, f.user_id, f.profile_id, f.listing_id, f.created_at
FROM public.favorites f
WHERE f.profile_id IS NULL
ORDER BY f.created_at
LIMIT 500;
```

Karar:

- `null_profile_rows = 0` ve orphan/mismatch yoksa ayrı, küçük bir sonraki migration ile `profile_id SET NOT NULL` değerlendirilebilir.
- NULL kayıt varsa multi-character account için profil tahmin edilmemeli; ürün/operasyon kararıyla silme veya sahip atama yapılmalıdır.
- `user_id` canonical owner değildir. Şimdilik legacy/uyumluluk alanı olarak tutulmuştur; bağımlılıklar kaldırılmadan drop edilmemelidir.

## E) Ürün kararı gerekenler

### `CORPORATE_SUBSCRIPTION_30_DAY`

Bu eksik bir schema nesnesi değil, eksik ürün/package kaydıdır. Gereken alanlar:

- `code`: `CORPORATE_SUBSCRIPTION_30_DAY`
- `name`: `30 Günlük Kurumsal Üyelik`
- `seller_type`: `CORPORATE`
- `duration_days`: `30`
- `price`: ürün/yönetim tarafından belirlenecek pozitif değer
- `active`: açılacağı zaman `true`
- `id`: database UUID default'u

Fiyat uydurulmadı ve package seed migrationına eklenmedi. Paket yokken checkout “aktif ödeme paketi bulunamadı” hatası verir. Paket sıfır/negatif fiyatlı veya yanlış seller type/duration ile tanımlanırsa kod ve Phase 1 completion bunu reddeder; ücretsiz subscription açılmaz.

## Production uygulama sırası

Bu görevde hiçbir adım uygulanmadı. Daha sonra kontrollü deployment için önerilen sıra:

1. Subscription fiyat ürün kararını tamamla ve canonical package kaydını ayrı veri operasyonu olarak hazırla.
2. Production backup/deployment window belirle.
3. Favorites read-only preflight'i çalıştır; sonucu kaydet.
4. `update_listing_price` için tüm aynı isimli function signature'larını ve notification constraint'i tekrar görüntüle.
5. Final Phase 1 migrationını production-schema clone üzerinde transaction testiyle doğrula.
6. Phase 1'i uygula ve RPC ACL/result audit'i tekrar çalıştır.
7. Reconciliation migrationını ayrıca review et ve uygula.
8. Tek birleşik production audit'i tekrar çalıştır; CSV'yi önceki CSV ile karşılaştır.
9. Checkout, publish, republish, favorite ve price-change smoke testlerini çalıştır.

## Değiştirilen / oluşturulan dosyalar

- `src/app/api/account/bootstrap/route.ts`
- `src/lib/db/payments.ts`
- `src/lib/db/repositories/supabase/supabase-payment-repo.ts`
- `supabase/migrations/20260926020000_business_logic_phase_1.sql`
- `supabase/migrations/20260926030000_production_schema_reconciliation.sql`
- `tests/business-logic-phase-1.test.ts`
- `tests/stabilization-pass.test.ts`
- `SANBOARD-BUSINESS-LOGIC-PHASE-1.md`
- `SANBOARD-PRODUCTION-RECONCILIATION-RESULT.md`

## Doğrulama sonucu

Final komut sonuçları bu raporun son doğrulama turundan sonra güncellenmiştir:

- `npx tsc --noEmit`: başarılı
- `npm test`: başarılı
- `npm run build`: başarılı
- `git diff --check`: başarılı; yalnız Windows LF/CRLF uyarıları olabilir

Production DB'ye hiçbir SQL uygulanmadı.