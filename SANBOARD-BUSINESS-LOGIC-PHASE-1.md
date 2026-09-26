# SANBOARD — Temel İş Mantığı Sağlamlaştırma / Faz 1

Tarih: 26 Eylül 2026

## 1. Önceden mantık nasıldı?

- Kurumsal başvuru, mağaza moderasyonu ve üyelik alanları veritabanında ayrıydı; ancak bazı ekranlar ve endpoint'ler aynı kararı farklı kontrollerle veriyordu.
- Kurumsal üyelik, ödeme yapılmadan doğrudan bir endpoint çağrısıyla 30 gün aktif edilebiliyordu.
- İlan paketi ödemesinde tekrar gönderilen istekleri tek işleme bağlayan kalıcı idempotency bilgisi yoktu.
- Supabase ödeme tamamlama, kredi üretme ve ilan yayınlama işlemleri ayrı sorgularla ilerliyordu. Arada hata veya eş zamanlı ikinci istek oluşursa yarım işlem riski vardı.
- Süresi dolmuş ilan için gerçek bir “yeniden yayınla” işlemi yoktu. Kullanıcı paket sayfasına gönderiliyordu ve aynı ilan kimliğini koruyan yayınlama akışı bulunmuyordu.
- İlan görünürlüğü birçok yerde doğru filtreleniyordu; fakat ortak bir görünürlük fonksiyonu kullanılmadığı için public profil ve mağaza gibi sayfalarda kuralın ayrışma riski vardı.
- Favori toplamı ve aktif karakterin favori üyeliği API'de ayrı hesaplanıyordu; istemci cache'inde ise ikisi aynı profile bağlı kayıtta tutuluyordu.

## 2. Sorun neydi?

- `APPROVED` başvuru veya mağaza kaydı, bazı fallback'lerde aktif üyelik gibi yorumlanabilirdi.
- Ücretsiz/doğrudan üyelik aktivasyonu iki kez 30 gün veya boost hakkı üretmeye açıktı.
- Aynı ödeme callback'i veya çift tıklama iki payment/credit üretebilirdi.
- Para başarılı olup ilan oluşturma aşaması başarısız olduğunda işlem bütünlüğü garanti değildi.
- Corporate kredi yalnız belirli mağazaya ait olmasına rağmen bütün akışlarda DB seviyesinde zorunlu tutulmuyordu.
- Yeniden yayınlama yeni ilan kimliği üretirse favori, compare bağlantısı ve fiyat geçmişi kopabilirdi.
- `ACTIVE` olup `expires_at` geçmiş kayıtlar her sorguda aynı şekilde ele alınmıyordu.
- Karakter değişiminde kalp üyeliği profile özel olmasına rağmen toplam favori sayısının profile cache'i içinde kalması stale sayı riski oluşturuyordu.

## 3. Yeni mantık nasıl çalışıyor?

### Kurumsal mağaza ve üyelik

- Kurumsal ilan uygunluğu yalnız şu durumda olumlu olur:
  - mağaza onaylı (`APPROVED`),
  - moderasyon durumu `ACTIVE`,
  - mağaza silinmemiş,
  - üyelik `ACTIVE`,
  - üyelik bitiş tarihi geçmemiş,
  - aktif karakter mağaza sahibidir.
- Bilinmeyen veya eksik status değerleri artık güvenli biçimde olumsuz sonuç verir.
- Üyelik süresi dolunca mağaza kaydı silinmez. Public mağaza erişimi moderasyon kuralına göre devam edebilir; yeni kurumsal ilan ve boost engellenir.
- `SUSPENDED` ve `DELETED` mağazaların public görünürlüğü ve ilan görünürlüğü kapalı kalır.
- Eski doğrudan üyelik aktivasyon endpoint'i artık üyeliği değiştirmez; ödeme akışının kullanılmasını zorunlu tutar.

### Ödeme ve kredi

- Checkout signed session ve aktif karakter olmadan çalışmaz. Browser'dan gönderilen `profileId` ödeme sahibi olarak kabul edilmez.
- Her kullanıcı ödeme niyeti bir `Idempotency-Key` taşır.
- Aynı karakter + aynı idempotency key tekrar gönderildiğinde aynı sipariş döner.
- Mock Fleeca aynı sipariş için aynı transaction kimliğini döndürür; tekrar charge simülasyonu üretmez.
- Payment kaydı hangi hakkı üreteceğini saklar:
  - `LISTING_CREDIT`
  - `CORPORATE_SUBSCRIPTION`
- Kurumsal kredi satın alındığı mağazaya bağlanır.
- Supabase migration'ı şu atomik DB fonksiyonlarını ekler:
  - `complete_sanboard_payment`: ödeme ve hakkın yalnız bir kez uygulanması,
  - `create_listing_with_credit`: ilan, detaylar, görseller ve kredi tüketiminin tek transaction olması,
  - `republish_listing_with_credit`: aynı ilanı doğru krediyle tek transaction içinde yeniden yayınlama.
- DB constraint/indexleri aynı payment'tan iki kredi, aynı external transaction'ın iki ödeme ve aynı credit'in iki ilana bağlanmasını engeller.

### Yeniden yayınlama ve görünürlük

- Yeniden yayınlama aynı listing ID üzerinde yapılır.
- `created_at`, fotoğraflar, favoriler ve fiyat geçmişi korunur.
- `published_at` ve `expires_at` yenilenir.
- Bireysel ilan 7 gün, kurumsal ilan 14 gün yeniden yayınlanır.
- Yalnız effective `EXPIRED` ilan yeniden yayınlanabilir.
- `SOLD` ve `REMOVED` ilanlar expiration mantığıyla tekrar `ACTIVE` yapılmaz.
- Ortak görünürlük fonksiyonu şunları birlikte değerlendirir:
  - status,
  - `expires_at`,
  - corporate store moderasyonu,
  - soft delete bilgisi.
- Public feed, public kullanıcı sayfası ve public mağaza sayfası aynı temel görünürlük kuralını kullanır.

### Favoriler

- DB sahipliği `(profile_id, listing_id)` olarak korunur.
- `favorite_count` listing bazlı global aggregate olarak tutulur.
- `is_favorited` profile + listing bazlı özel overlay olarak tutulur.
- FavoriteButton client cache'i iki parçaya ayrıldı:
  - toplam sayı: listing ID,
  - kalp üyeliği: profile ID + listing ID.
- Batch favorite state endpoint'i korunmuştur; kart başına ayrı sorgu eklenmemiştir.
- Yayında olmayan ilana yeni favorite eklenemez; mevcut favorite kaldırılabilir.
- Favorilerim sayfası gerçek toplam favorite sayısını repository batch sonucundan alır.

## 4. Kullanıcı açısından ne değişti?

- Onaylanan kurumsal başvuru artık tek başına ücretli üyelik sağlamaz.
- Kurumsal üyelik ödeme tamamlanmadan aktif olmaz.
- Ödeme butonuna tekrar basılması veya başarılı cevap kaybolduktan sonra tekrar denenmesi aynı işlem için ikinci hak üretmez.
- Süresi dolmuş ilan, mevcut içerik ve favoriler korunarak yeniden yayınlanabilir.
- Yeniden yayınlanan ilan yeni `published_at` ile listelerde tekrar yukarı çıkar.
- Karakter değiştirildiğinde toplam favori sayısı aynı kalabilir, fakat kalp yalnız aktif karakterin gerçek DB ilişkisine göre seçilir.
- Ödeme sayfası artık siparişin gerçek tutarını ve hakkın ilan kredisi mi üyelik mi olduğunu gösterir.

## 5. Hangi dosyalar değişti?

Başlıca değişiklikler:

- `src/lib/dealers/eligibility.ts`
- `src/lib/listings/visibility.ts`
- `src/lib/db/payments.ts`
- `src/lib/db/listings.ts`
- `src/lib/db/repositories/types.ts`
- `src/lib/db/repositories/memory/memory-payment-repo.ts`
- `src/lib/db/repositories/memory/memory-listing-repo.ts`
- `src/lib/db/repositories/supabase/supabase-payment-repo.ts`
- `src/lib/db/repositories/supabase/supabase-listing-repo.ts`
- `src/lib/integrations/fleeca/mock-provider.ts`
- `src/app/api/checkout/route.ts`
- `src/app/api/dealers/subscription/activate/route.ts`
- `src/app/api/user/listings/route.ts`
- `src/app/hesabim/kurumsal/page.tsx`
- `src/app/hesabim/ilanlarim/page.tsx`
- `src/app/ilan-ver/paket/page.tsx`
- `src/app/odeme/[orderId]/page.tsx`
- `src/app/premium/[id]/page.tsx`
- `src/app/user/[id]/page.tsx`
- `src/components/listings/FavoriteButton.tsx`
- `src/types/index.ts`
- `tests/business-logic-phase-1.test.ts`
- mevcut ilgili regression testleri ve `package.json`

## 6. Database değişti mi?

Kod tarafında database sözleşmesi değişti. Production database'e hiçbir migration otomatik uygulanmadı.

Eklenen migration dosyası:

- `supabase/migrations/20260926020000_business_logic_phase_1.sql`

## 7. Migration gerekiyorsa hangisi?

Migration gereklidir. Eklenenler:

- `payments.idempotency_key`
- `payments.corporate_profile_id`
- `payments.entitlement_type`
- `payments.entitlement_applied_at`
- profile + idempotency key unique indexi
- external payment ID unique indexi
- payment başına tek listing credit unique indexi
- kullanılan listing başına tek credit unique indexi
- atomik ödeme tamamlama DB fonksiyonu
- atomik yeni ilan yayınlama DB fonksiyonu
- atomik yeniden yayınlama DB fonksiyonu

Migration production'a uygulanmadan önce staging üzerinde mevcut duplicate payment/credit verileri için preflight kontrolü yapılmalıdır. Unique indexler mevcut kirli veri varsa migration'ı durdurabilir; bu bilinçli ve güvenli davranıştır.

## 8. Test sonucu

- `npx tsc --noEmit`: başarılı, 0 TypeScript error.
- `npm test`: başarılı, 210 test geçti, 0 test failure.
- Yeni Faz 1 regression testleri ödeme tekrarı, üyelik tekrarı, republish identity/favorite koruması, SOLD koruması, corporate credit store izolasyonu ve profile-scoped favorite davranışını kapsar.

## 9. Build sonucu

- `npm run build`: başarılı.
- Next.js 16.3.6 production build tamamlandı.
- 52 static page üretildi; route derleme, TypeScript ve page-data aşamalarında hata oluşmadı.
- `git diff --check`: başarılı; whitespace hatası yok. Windows satır sonu dönüşüm uyarıları hata değildir.

## 10. Hâlâ karar verilmesi gereken bir nokta var mı?

Evet, tek açık ürün kararı kurumsal üyelik ücretidir.

Task içinde üyelik süresi 30 gün olarak tanımlandı ancak üyelik fiyatı belirtilmedi. Mevcut database'de de üyelik için ayrı bir paket/fiyat yoktu. Bu nedenle kod yeni bir ücret uydurmadı.

Production veya staging'de üyelik ödeme akışını açmak için yönetim kararıyla şu paket oluşturulmalıdır:

- code: `CORPORATE_SUBSCRIPTION_30_DAY`
- name: `30 Günlük Kurumsal Üyelik`
- duration_days: `30`
- price: ürün/yönetim tarafından belirlenecek değer
- active: `true`
- seller_type: `CORPORATE`

Paket tanımlanana kadar üyelik butonu güvenli biçimde “paket bulunamadı” hatası verir; ücretsiz üyelik açmaz.

## Git durumu

- Commit yapılmadı.
- Push yapılmadı.
- Production migration uygulanmadı.