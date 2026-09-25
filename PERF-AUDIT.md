# Sanboard Performance Audit

Tarih: 26 Eylül 2026

## Baseline

- `npm test`: 185/185 başarılı, yaklaşık 11.94 sn.
- `npm run build`: başarılı, TypeScript hatası yok, yaklaşık 21.85 sn.
- İlk build çıktısında bütün uygulama route'ları dynamic görünüyordu.
- `loading.tsx` sınırı yoktu.

## Öncelikli bulgular

| # | Dosya | Mevcut davranış | Neden yavaş | Tahmini etki | Önerilen düzeltme |
|---|---|---|---|---|---|
| 1 | `src/app/layout.tsx` | Her request/navigation için session cookie okunuyor; kullanıcı ve profil için iki DB sorgusu bekleniyordu. | Root layout cookie bağımlılığı tüm public ağacı dynamic yapıyor ve navbar gelmeden DB round-trip bekletiyor. | Çok yüksek | Public root shell'i auth DB bootstrap'ından ayır; auth'u client bootstrap veya korumalı segmentte çöz. |
| 2 | `src/features/auth/AuthContext.tsx` | Initial profile yoksa `/api/user/profile`, ardından `/api/user/characters` çağrılıyor. Initial profile varsa yine characters çağrılıyor. | Root server bootstrap ile birlikte profil verisi iki ayrı katmanda taşınıyor; ilk paint auth zincirine bağlı. | Yüksek | Root'u bloklamayan tek client bootstrap kullan; character listesini secondary data olarak yükle. |
| 3 | `src/lib/auth/session.ts`, çeşitli route handler'lar | Aynı request akışında `getServerSession` tekrar çağrılabiliyor; admin route'unda erişim ve actor çözümü ayrı çağrılar yapıyor. | Tekrarlı cookie parse/HMAC doğrulaması ve bazı fallback profile sorguları. | Orta | React `cache()` ile request-scoped deduplication; global/user-crossing cache kullanma. |
| 4 | `src/app/page.tsx`, `src/app/arac/page.tsx`, `src/app/mulk/page.tsx`, `supabase-listing-repo.ts` | Public sorgu tüm eşleşen aktif ilanları, tüm favorite satırlarını ve tüm price-history satırlarını çekiyor. Home tüm sonucu bellekte bölüyor/sıralıyor. | Dataset büyüdükçe response, DB transferi ve Node hesaplama doğrusal büyür. | Çok yüksek | Limit/pagination, sınırlı select, DB aggregate/RPC için sonraki adım; public sorguyu maksimum 60 kayıtla sınırla. |
| 5 | `supabase-listing-repo.ts#getPublicListings` | Corporate relation `*` seçiyordu. | Kart görünümü yalnız moderation state isterken logo/banner/iletişim/subscription vb. kolonlar taşınıyor. | Orta-yüksek | Yalnız `moderation_status, deleted_at` seç. |
| 6 | `src/app/ilan/[id]/page.tsx`, `getListingById` | Cookie/session, geniş listing relation, favorite count/state ve price history aynı detail request'inde; ardından similar listing sorguları serial başlıyor. | Public base data ile personalized overlay aynı render yolunda; similar feed ana içeriği bekletiyor. | Yüksek | Base/personal overlay'i ayrı boundary'lere ayır; similar alanı Suspense ile stream et. Bu pass'te loading shell eklendi; tam ayrım sonraki pass. |
| 7 | `src/app/premium/[id]/page.tsx` | Public mağaza verisi ile `isFollowing` cookie/profile overlay'i aynı sayfada çözülüyor. | Tek kişisel boolean tüm public vitrini dynamic hale getiriyor. | Yüksek | Public store/listings base'ini cache'le; follow state'i client/private overlay olarak getir. |
| 8 | `src/components/notifications/NotificationDropdown.tsx`, `/api/notifications` | Navbar mount olduğunda tam notification listesi + count çekiliyor ve 20 sn poll ediliyordu. | Bütün site boyunca ikincil UI için düzenli DB ve JSON yükü. | Yüksek | Navbar için yalnız unread count, 60 sn polling; tam listeyi dropdown açılınca ve maksimum 50 kayıt çek. |
| 9 | `src/app/hesabim/layout.tsx`, dashboard client pages | Ortak layout client component; auth beklerken full-page spinner; eligibility ayrı fetch; alt sayfalar kendi API fetch'lerini başlatıyor. | Dashboard shell hydration ve waterfall sonrası görünür; sub-route geçişlerinde ortak veriler yeniden istenir. | Yüksek | Segment skeleton; ileride server shell + character-keyed bootstrap provider. Character switch invalidation korunmalı. |
| 10 | `src/app/api/admin/route.ts`, `src/app/yonetim/page.tsx` | Tüm admin domainleri tek request'te tam dataset olarak geliyor. Application başına 1, dealer başına 3 ek sorgu var. | `1 + A + 3D` N+1 ve limitsiz payload; 84 KB civarı monolitik client page. | Çok yüksek | Domain/tab bazlı paginated endpoint, batched joins/aggregates, lazy tab bundles. Risk nedeniyle bu pass'te tam refactor yapılmadı. |
| 11 | `ListingCard.tsx` ve medya kullanan ekranlar | Ham `<img>` kullanımı yaygın; intrinsic width/height ve Next image optimizasyonu yok. | Görsel boyutlandırma/CDN varyantları ve layout stability tarayıcıya bırakılıyor. | Orta | CDN Worker transform politikası netleştirildikten sonra `next/image` veya explicit dimensions/srcset. |
| 12 | `src/lib/storage/r2-provider.ts` | UUID key var fakat upload metadata'sında uzun cache header yoktu. | CDN/object response doğru policy üretmiyorsa tekrar doğrulama/indirme olabilir. | Orta-yüksek | Yeni objelere `public, max-age=31536000, immutable`. Worker'ın origin metadata'yı koruduğu ayrıca doğrulanmalı. |
| 13 | `src/middleware.ts` | Deprecated convention; profile cookie session yerine korumalı route girişine yetebiliyordu. | Warning ve client-writable cookie'ye dayalı zayıf erken gate. | Güvenlik/yapısal | `src/proxy.ts` convention ve yalnız signed HttpOnly session cookie gate. |
| 14 | Route segmentleri | Hiç `loading.tsx` yoktu. | Dynamic route prefetch'i shell üretemiyor; tıklama sonrası sessiz bekleme. | Yüksek UX | Root ve account segment skeleton'ları; layout shift yaratmayan kart/stat placeholders. |
| 15 | Migration/indexler | Favorites, notifications, followers için önemli indexler mevcut; feed newest sort, corporate state ve ticket updated yolları eksik. | Sıralama ve scoped listelerde büyüyen table scan/sort riski. | Orta-yüksek | Yalnız eksik composite/partial indexler için ayrı migration. |

## Doğrulanan olumlu noktalar

- Listing card başına ayrı favorite API isteği yok; count verisi page-level batch query ile geliyor.
- Public listing favorite count ve price history sorguları birbirinden bağımsız olarak `Promise.all` ile çalışıyor.
- Account bootstrap ana metrikleri paralel getiriyor.
- Fonts `next/font` ile self-host ediliyor; external blocking font isteği yok.
- Canonical media URL resolver `https://cdn.sanboard.xyz` kullanıyor; legacy R2/Worker URL'lerini canonical domaine çeviriyor.
- UUID object key üretimi avatar/listing/logo/banner için mevcut.

## Cache güvenlik sınırı

Global/public cache içine alınmaması gerekenler: session, `activeProfileId`, user/profile, `is_favorited`, notifications, admin role, corporate eligibility ownership sonucu ve follow state. Bu audit hiçbir user-scoped sonucu cross-request global veri cache'ine önermemektedir.