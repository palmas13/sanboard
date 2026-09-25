# Sanboard Performance Optimization Report

Tarih: 26 Eylül 2026

## En büyük 10 bottleneck ve yapılan fix

1. **Root layout auth/DB bloklaması** — `src/app/layout.tsx`: session + user + profile beklemesi kaldırıldı; public shell artık auth DB round-trip'ine bağlı değil.
2. **Session tekrarları** — `src/lib/auth/session.ts`: `getServerSession` React `cache()` ile request-scoped deduplicate edildi. Cross-user/global data cache yok.
3. **Navbar notification yükü** — dropdown açılmadan yalnız count getiriliyor; polling 20 sn'den 60 sn'ye çıktı; tam liste açılışta lazy yükleniyor.
4. **Limitsiz public listing feed** — Supabase public feed maksimum 60 kayıtla sınırlandı. Bir request'in favorite/history batch kapsamı da aynı üst sınıra indi.
5. **Geniş corporate relation** — public kart sorgusunda `corporate_profiles (*)` yerine yalnız moderasyon görünürlük kolonları seçiliyor.
6. **Sessiz route geçişleri** — `src/app/loading.tsx` ve `src/app/hesabim/loading.tsx` eklendi; full-page spinner yerine stabil skeleton shell kullanılıyor.
7. **Deprecated middleware** — `src/middleware.ts`, `src/proxy.ts` convention'ına taşındı; korumalı girişte client-writable profile cookie değil signed session zorunlu.
8. **R2/CDN cache metadata'sı** — yeni UUID-key medya upload'larına `Cache-Control: public, max-age=31536000, immutable` eklendi.
9. **Eksik DB erişim indexleri** — public category/newest, personal dashboard, corporate inventory/state ve ticket updated yolları için ayrı migration oluşturuldu.
10. **Notification payload/select** — tam `select('*')` kaldırıldı; kullanılan kolonlar ve maksimum 50 kayıt seçiliyor.

## Query count azaltımı

- Public route root render: session doğrulama + user query + profile query olmak üzere **3 auth işi kaldırıldı**.
- Navbar notification başlangıcı: **2 DB query (list + count) → 1 count query**.
- Notification polling sıklığı: dakikada yaklaşık **3 poll → 1 poll**.
- Public listing feed DB round-trip sayısı aynı (base + parallel history/favorites), fakat her batch en fazla 60 listing ID ile sınırlandı ve corporate payload daraltıldı.
- Admin `1 + A + 3D` N+1 paterni tespit edildi; tam admin endpoint ayrıştırması bu pass'te risk nedeniyle uygulanmadı.

## Parallel hale getirilen / mevcut paralelliği korunan sorgular

- Root user/profile sorguları tamamen public critical path'ten çıkarıldı.
- Public listing history/favorite batch sorguları mevcut `Promise.all` yapısıyla korundu.
- Account bootstrap profile/listings/favorite/credit/corporate/ticket metrikleri mevcut `Promise.all` yapısıyla korundu.
- Listing detail favorite count/state/history mevcut `Promise.all` yapısıyla korunuyor.

## Public cache stratejisi

Public base veriler route-level `revalidate` politikalarını kullanmaya devam ediyor. Root cookie bağımlılığı kaldırıldığı için public cache/ISR'ın global engeli kaldırıldı ve ana sayfa build çıktısında 30 saniye ISR ile static oldu. `/arac` ve `/mulk` URL `searchParams`, dynamic detail/profile route'ları ise params ve kişisel overlay kullandığı için bu pass sonunda hâlâ on-demand render ediliyor. Tam Cache Components/Partial Prefetching migration'ı, Next.js 16.3.6 yerel dokümantasyonu route-by-route doğrulama istediği için körlemesine açılmadı.

### Cache'e alınmayan user-specific veri

- Signed session ve active character
- Character profile/account
- `is_favorited`
- Notifications ve unread state
- Owner/admin controls
- Corporate eligibility/ownership
- Store follow state

## Client bundle ve hydration

- Root'ta server-side auth DB bootstrap kaldırıldı; ancak global `AuthProvider`, `CompareProvider` ve client Navbar hâlâ hydrate olur.
- Admin page ve dashboard alt sayfalarının çoğu büyük client component olmaya devam ediyor.
- Yeni UI/state library eklenmedi.
- Lucide named imports kullanılıyor; barrel importunun mevcut bundler tree-shaking'i build ile doğrulandı, özel icon library değişikliği yapılmadı.

## Navigation / prefetch

- Kritik navbar/dashboard linkleri zaten `next/link` kullanıyor ve default production prefetch'ten yararlanıyor.
- Dynamic route'ların prefetch edilebilir shell alması için loading boundaries eklendi.
- Yüzlerce listing detail linkine zorunlu `prefetch={true}` eklenmedi; bu, kart başına server prefetch maliyeti yaratırdı.

## Suspense / loading

- Global route skeleton ve account content skeleton eklendi.
- Header/root layout transition boyunca korunur; yeni segment içeriği kart/stat placeholder'larıyla anında feedback verir.
- Listing detail similar feed'i için granular streaming önerildi; tam public/personal detail ayrımı daha büyük refactor olduğu için bu pass'te tamamlanmadı.

## DB index değişiklikleri

Migration: `supabase/migrations/20260926000000_performance_indexes.sql`

Eklenen öneriler:

- `idx_listings_public_category_published`
- `idx_listings_profile_status_published`
- `idx_listings_corporate_status_published`
- `idx_corporate_profiles_subscription_moderation`
- `idx_support_tickets_profile_updated`

Favorites, notifications ve corporate followers için mevcut indexler bulundu; duplicate oluşturulmadı. Migration production'a otomatik uygulanmadı.

## CDN / image cache

- Canonical domain `https://cdn.sanboard.xyz` korunuyor.
- `workers.dev` public output geri getirilmedi.
- Yeni upload'larda immutable one-year cache metadata'sı var.
- R2 delete lifecycle ve UUID key üretimi değiştirilmedi.
- Ham `<img>` kullanımının `next/image`/Worker transform stratejisine geçirilmesi sonraki pass'e bırakıldı.

## Önce / sonra ölçümleri

### Önce

- Test: 185 pass, yaklaşık 11.94 sn.
- Build: yaklaşık 21.85 sn.
- Route çıktısı: tüm page route'ları dynamic.
- Root public render auth maliyeti: session + 2 DB query.
- Navbar notification mount: list + count, 20 sn polling.

### Sonra

- Test: **185/185 pass**, 0 failure, yaklaşık **5.41 sn** koşu süresi.
- Build: **başarılı**, 0 TypeScript error, 0 build error, yaklaşık **21.02 sn**.
- Middleware deprecation warning kaldırıldı; build `ƒ Proxy (Middleware)` gösteriyor.
- `/`: **static ISR**, revalidate 30 sn.
- Client-only `/hesabim` alt shell route'larının çoğu ve `/yonetim`: static prerender.
- `/arac`, `/mulk`, `/ilan/[id]`, `/premium/[id]`, `/user/[id]`: hâlâ dynamic; nedenleri yukarıdaki public cache ve kalan işler bölümlerinde kayıtlı.
- Public root critical path: session + user + profile işi **3 → 0**.
- Navbar notification mount: full rows + count **→ yalnız count**; tam liste kullanıcı dropdown'u açınca yükleniyor.
- Build süresi belirgin değişmedi; ana kazanım route sınıflandırması, request kritik yolu ve runtime DB/payload azaltımıdır.

## Hâlâ optimize edilebilir ama bu pass'te dokunulmadı

- Admin endpoint'i tab/domain bazlı pagination ve batched aggregate yapısına bölmek.
- Public favorite counts için DB aggregate view/RPC; bütün favorite satırlarını Node'a taşımamak.
- Home için ayrı `latest vehicles`, `latest properties`, `popular` limitli repository sorguları.
- Listing detail public base ve personalized overlay'i ayrı Suspense/private resolver'lara bölmek.
- Premium store follow state'i public vitrinden ayırmak.
- Dashboard'u server shell + character-keyed shared bootstrap provider mimarisine geçirmek.
- Büyük client pages/forms/modals için route-local dynamic import ve component splitting.
- Görseller için Worker resize varyantları veya `next/image` ile ölçülü migration.
- Cache Components + Partial Prefetching'i route bazlı validation ile ayrı çalışma olarak geçirmek.

## Önerilen commit mesajı

`perf: Sanboard sayfa geçişlerini ve veri yükleme performansını iyileştir`