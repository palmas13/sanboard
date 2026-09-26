# SANBOARD Temporary Test Character Login

## Neden var?

Bu harness, gerçek GTA World UCP/OAuth contract'ı tamamlanana kadar Sanboard'un canonical kullanıcı, karakter ve business flow'larını test etmek için geçici bir veri kaynağı sağlar. Gerçek GTA World login değildir; fixture karakterleri gerçek hesap veya UCP karakteri olarak sunmaz.

## Architecture

Gerçek yol:

`GTA World UCP -> RealGtaWorldAuthProvider -> ExternalGameAccount -> syncExternalGameAccount() -> character selection -> signed canonical session`

Geçici test yolu:

`/test-giris -> /api/auth/test-login -> MockGtaWorldAuthProvider -> ExternalGameAccount -> syncExternalGameAccount() -> signed character-selection context -> /karakter-sec -> POST /api/auth/session -> signed canonical session`

Test route'u doğrudan session yazmaz. Session içindeki `userId`, `profileId` ve `role` sırasıyla canonical `users.id`, `character_profiles.id` ve profil rolüdür. Favorite, follow, listing, notification, ticket, corporate ve credit kodlarında fixture özel durumu yoktur.

## Environment flag

Yalnız exact `ENABLE_TEST_LOGIN=true` değeri harness'ı açar. Eksik, `false` veya başka değerlerde:

- `/giris` test CTA'sını render etmez.
- `/test-giris` 404 olur.
- `/api/auth/test-login` 404 döner.
- Mock provider gerçek login yolundan çağrılmaz.

`GTA World ile Giriş Yap` her zaman `RealGtaWorldAuthProvider` yoluna gider ve test login'e fallback yapmaz.

## Test character source ve identity namespace

Mavis Pierce, Zade Vexnera ve Ravi Blumon yalnız `MockGtaWorldAuthProvider` fixture'larıdır ve hepsi canonical sync tarafından `USER` rolüyle oluşturulur. İsim veya fixture ID üzerinden authorization yoktur.

Mevcut schema/type contract'ı `users.provider='GTAWORLD'` modelini kullanır. Migration eklemek yerine çakışmaya kapalı reserved external ID prefix'leri kullanılır:

- test account: `test-login:account:*`
- test character: `test-login:character:*`

Route, sync öncesi account ve bütün character ID'lerinin bu namespace içinde olduğunu fail-closed doğrular. Canonical UUID'ler DB tarafından üretilir; external fixture ID'leri actor/session ID olmaz.

## Data isolation

Her fixture character ayrı `character_profiles.id` alır. Downstream state mevcut profile scope'u üzerinden ayrılır. Character A'nın favorite/follow/listing/notification/ticket/corporate/credit satırları Character B tarafından otomatik paylaşılmaz. Client'ın gönderdiği `userId`, `role` veya farklı profile ID authorization kaynağı değildir; signed session/selection context ve server-side ownership kontrolü geçerlidir.

## TEMPORARY TEST DATA CLEANUP

Bu task production DB'de veri silmez ve cleanup SQL'i çalıştırmaz.

Review edilmiş ileriki cleanup işlemi önce `users.external_user_id LIKE 'test-login:account:%'` ve `character_profiles.external_character_id LIKE 'test-login:character:%'` ile aday canonical UUID'leri çıkarmalıdır. Prefix'ler gerçek adapter contract'ından ayrı tutulduğu için real GTA World rows ile karışmaz.

`users -> character_profiles`, favorites, support tickets, corporate profiles/applications ve bazı notification ilişkilerinde cascade vardır. Buna karşın payments, listing credits, listings, reports ve sonradan eklenen bazı foreign key'ler cascade olmayabilir. Bu nedenle doğrudan user silme varsayılmamalıdır. Review edilecek cleanup script'i önce test profile UUID'lerine bağlı non-cascade rows'u envanterlemeli; media/object storage kayıtlarını ayrıca incelemeli; bağımlılık sırasıyla child rows, profiles ve test user row'unu silmelidir. Production'da SQL otomatik uygulanmamalıdır.

## Removal plan

1. Deployment config'te `ENABLE_TEST_LOGIN=false` yap.
2. `src/app/test-giris/`, `src/app/api/auth/test-login/`, `src/app/giris/LoginContent.tsx` içindeki secondary test alanı ve `src/lib/auth/test-login.ts` dosyasını kaldır.
3. `MockGtaWorldAuthProvider` fixture export'unu ve test indicator wiring'ini kaldır.
4. `.env.example`, `tests/temporary-test-login.test.ts` ve package test entry'sini kaldır.
5. Review edilmiş cleanup planıyla namespaced test records ve ilişkili test media/data'yı temizle.

Canonical sync, character picker, `/api/auth/session`, logout ve business logic değişmeden kalır.

## REAL GTA WORLD GO-LIVE CHECKLIST

- `ENABLE_TEST_LOGIN=false`
- Test login disabled ve UI/route erişimi doğrulandı
- Mock credentials/provider access disabled
- Real OAuth endpoint/schema/state/auth contract doğrulandı
- Test records cleanup reviewed
- Production DB cleanup ayrı change/review ile yürütüldü