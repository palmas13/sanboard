# SANBOARD — Dynamic GTA World Account & Character Onboarding Audit

**Audit tarihi:** 26 Eylül 2026
**Kapsam:** Kod, migration/schema ve memory/fake test katmanı
**Yapılmayanlar:** Production DB erişimi/değişikliği, Supabase push, migration çalıştırma/oluşturma, product-code fix, commit/push.

## En kritik 6 cevap

1. **Hiç DB kaydı olmayan yeni GTA World hesabı bugün giriş yapabilir mi?**
   **Koşullu evet / PARTIAL.** Real OAuth aktif, doğru environment değişkenleri mevcut ve GTA World callback `state` desteği `supported` olarak doğrulanmışsa callback yeni `users` ve `character_profiles` satırlarını oluşturmayı deniyor. Ancak OAuth state desteği varsayılan olarak `unverified`; provider state döndürmezse real login bilinçli olarak bloklanıyor. Ayrıca eşzamanlı ilk login yarışında unique constraint duplicate’i önlese de loser request recovery yapmıyor.

2. **İlk login'de `users` satırı otomatik oluşuyor mu?**
   **Evet.** `src/app/api/auth/gtaworld/callback/route.ts` → `syncGtaWorldAccountAndCharacters()` → `users(provider='GTAWORLD', external_user_id=...)` lookup → bulunamazsa insert. Supabase `users.id` DB UUID default’u ile üretiliyor; role `USER`, status `ACTIVE` yazılıyor.

3. **GTA World karakterleri otomatik `character_profiles`'a sync/upsert oluyor mu?**
   **Evet, fakat gerçek atomic upsert değil ve PARTIAL.** `/api/user` payload’ındaki tüm karakterler login callback sırasında loop ile aranıp update/insert ediliyor. DB-level unique external character indexi var. Ancak implementation select-then-insert yapıyor, conflict recovery yok ve isim tabanlı fallback identity riski taşıyor.

4. **Mevcut hesaba sonradan eklenen yeni karakter otomatik tanınıyor mu?**
   **Evet.** Bir sonraki başarılı OAuth login callback’i `/api/user` listesini tekrar sync ettiği için yeni external ID için yeni profile yaratılıyor. `/api/user/characters` kendi başına GTA World’e gitmez; yalnız son login’de DB’ye sync edilmiş profilleri listeler.

5. **Sistem Mavis/Ravi/Zade seed verisine production'da bağımlı mı?**
   **Core OAuth bootstrap seed-independent; fakat production-facing source tamamen seed-independent değil.** Real callback yeni account/profile yaratabilir. Buna karşın session/admin/auth UI kodunda Mavis/Ravi/Zade isimleri ve fixture ID’leriyle özel role/account davranışı vardır. Bu production logic hardcode’ları kaldırılmadan cevap **PARTIAL**’dır.

6. **Bugün gerçek kullanıcılara açsak identity/onboarding tarafında en büyük risk ne?**
   **P0/P1 birleşik risk:** production-facing character-switch/session logic’inde named fixture role override’ları bulunması; bazı feature endpoint’lerinin signed active profile yerine client body/query veya yazılabilir cookie fallback’ine güvenmesi; login callback’in single-character durumda account-level `user.role` ile session imzalaması; onboarding sync’in isim fallback’i ve race recovery eksikliği. Sonuç yanlış role, yanlış karakter scope’u veya bazı endpoint’lerde başka profile ID’siyle işlem riskidir.

---

## 1. Executive summary

Sanboard’da gerçek GTA World OAuth account bootstrap ve character synchronization için çalışan bir temel mevcuttur. Real login akışı GTA World `/api/user` payload’ını alır, `(provider, external_user_id)` ile account arar/oluşturur ve payload’daki karakterleri `external_character_id` üzerinden yerel profile’lara taşır. Yeni account, tekrar login, rename ve GTA World listesinden geçici olarak kaybolan karakteri silmeme davranışları memory testlerinde doğrulanmıştır.

Ancak sistem bütünüyle production-ready değildir:

- OAuth state desteği doğrulanmadan real callback bazı provider davranışlarında bloklanır.
- Sync gerçek DB upsert/RPC değildir; select-then-insert yarışları request failure üretebilir.
- Character sync aynı account içindeki isim eşleşmesini identity fallback’i olarak kullanır.
- Session ve admin route’larında Mavis/Ravi/Zade isim/ID hardcode’ları vardır.
- Single-character callback session role’ü character role yerine `users.role` üzerinden alır.
- `users.status = BANNED` login veya switch sırasında uygulanmaz.
- Bazı feature route’ları canonical signed active profile standardına uyar; bazıları client ID/query/writable cookie fallback’ine izin verir.
- GTA World API TypeScript tipleri external account/character ID’lerini `number` ilan eder. Runtime `String(...)` ile normalize edilse de tip kontratı gelecekteki alphanumeric ID’leri doğru modellememektedir.
- Account başına maksimum üç karakter server/DB seviyesinde uygulanmaz.

### Ana verdict

| Alan | Verdict | Kısa gerekçe |
|---|---|---|
| New account | **PARTIAL** | Auto-create var; OAuth activation/state ve race recovery eksikleri var. |
| New character | **PARTIAL** | Login sırasında auto-create var; atomic upsert yok, isim fallback’i riskli. |
| Character switch | **PARTIAL** | Canonicalization + ownership check var; fixture role hardcode’u ve initial-session role ayrışması var. |
| Character-scoped features | **PARTIAL** | Favorite/follow/republish güçlü; listing/ticket/credit/application gibi yollar tutarsız. |
| Seed-independent | **PARTIAL** | Core sync seed istemez; production source fixture logic içerir. |
| Production scale identity model | **NEEDS WORK** | Doğru canonical schema temeli var; auth boundary ve sync atomikliği tamamlanmalı. |

## 2. Current login flow

### Dosya → fonksiyon → provider → DB zinciri

1. `src/app/api/auth/gtaworld/login/route.ts` — `GET`
   - `USE_MOCK_GTAWORLD_AUTH !== 'false'` ise doğrudan `/karakter-sec` yönlendirmesi yapar; gerçek OAuth/account bootstrap çalışmaz.
   - Real mode’da `getGtaWorldAuthProvider()` çağrılır.
   - `GTAWORLD_CLIENT_ID`, `GTAWORLD_CLIENT_SECRET`, `GTAWORLD_REDIRECT_URI` zorunludur.
   - Random 32-byte OAuth state oluşturulur.
   - `gtaw_oauth_attempt` HttpOnly cookie’sine state, redirect ve timestamp yazılır.
   - Provider authorize URL’sine redirect edilir.

2. `src/lib/integrations/gtaworld/real-provider.ts`
   - Authorize: `GET /oauth/authorize`.
   - Token: `POST /oauth/token`.
   - Account/characters: `GET /api/user` Bearer token.
   - Character list ayrı Sanboard endpoint’inden veya ayrı GTA World character endpoint’inden gelmez; `/api/user` response içindeki `user.character` alanıdır.

3. `src/app/api/auth/gtaworld/callback/route.ts` — `GET`
   - Attempt cookie ve varsa returned state doğrulanır.
   - Provider state döndürmez ve `GTAWORLD_OAUTH_STATE_SUPPORT !== 'supported'` ise login bloklanır.
   - Code token’a çevrilir.
   - `provider.fetchUser(accessToken)` ile account ve character list alınır.
   - `syncGtaWorldAccountAndCharacters(gtawResponse.user)` çağrılır.
   - Bir profile varsa otomatik seçilir; birden fazlaysa `/karakter-sec` açılır.
   - HMAC signed `sanboard_session` oluşturulur.

### External account identity

`gtawResponse.user.id`, `String(gtawUser.id)` ile `users.external_user_id` yapılır. Provider sabit olarak `GTAWORLD` yazılır.

### OAuth activation sonucu

Real OAuth code path mevcuttur; fakat `RealGtaWorldAuthProvider.oauthStateSupport` default `unverified` değerindedir. GTA World state parametresini geri döndürmüyorsa production login ancak explicit `GTAWORLD_OAUTH_STATE_SUPPORT=supported` kararıyla ilerler. Bu nedenle “kod var” ile “bugün her gerçek provider response’unda login olur” aynı değildir.

## 3. Current account creation flow

`src/lib/auth/gtaworld-sync.ts`:

1. `externalUserId = String(gtawUser.id)`.
2. Supabase lookup:
   - table: `users`
   - predicates: `provider = 'GTAWORLD'`, `external_user_id = externalUserId`
   - method: `maybeSingle()`.
3. Bulunursa aynı `users.id` korunur.
4. Bulunmazsa insert:
   - `provider: 'GTAWORLD'`
   - `external_user_id: externalUserId`
   - `role: 'USER'`
   - `status: 'ACTIVE'`
   - timestamps explicit yazılır.
5. `users.id` insert payload’ında verilmez; schema’daki `UUID PRIMARY KEY DEFAULT uuid_generate_v4()` üretir.

### Manual seed gerekli mi?

Hayır. Real OAuth sync başarılıysa account yaratımı için seed veya manuel SQL gerekmez.

### Duplicate/race analizi

Migration `20260924050000_gtaworld_oauth_and_audit.sql`, partial unique index sağlar:

```text
users(provider, external_user_id) WHERE external_user_id IS NOT NULL
```

Bu DB seviyesinde iki kalıcı account satırını engeller. Fakat iki eşzamanlı first login şu akışı yaşayabilir:

1. İki request de lookup’ta satır bulamaz.
2. Birinci insert başarılı olur.
3. İkinci insert unique violation alır.
4. Kod conflict sonrası mevcut satırı tekrar select etmez; ikinci login `auth_failed` olur.

**Sonuç:** duplicate data koruması **protected**, race user experience/retry davranışı **vulnerable/partial**.

### Status

Yeni account her zaman `ACTIVE` yaratılır. Existing `BANNED` account callback veya switch sırasında reddedilmez. `users.status` admin audit dışındaki login boundary’de authoritative değildir.

**New account onboarding verdict: PARTIAL.**

## 4. Current character sync flow

### Source ve zamanlama

- Source: GTA World `GET /api/user`, `user.character`.
- Zamanlama: başarılı OAuth callback sırasında.
- `/api/user/characters`: GTA World’e gitmez; local DB/memory profile’larını listeler.

### Supabase sync

Her character için:

1. `extCharId = String(char.id)`.
2. `canonicalName = firstname + ' ' + lastname`.
3. `character_profiles` lookup:
   - `external_character_id = extCharId`, **veya**
   - aynı `user_id` altında case-insensitive aynı `full_name`.
4. Existing row bulunursa:
   - name güncellenir,
   - external ID güncellenir,
   - `user_id` current authenticated account’a tekrar bağlanır,
   - avatar/phone/SanMail korunur.
5. Bulunmazsa insert:
   - DB default UUID `id`,
   - `user_id = users.id`,
   - `external_character_id`, name,
   - avatar/contact null,
   - `is_dealer=false`,
   - role insert payload’ında yok; schema default `USER` uygulanır.
6. Current payload’da bulunmayan eski local profiles tekrar select edilip result’a eklenir; silinmez/disable edilmez.

### Duplicate ve uniqueness

DB unique index:

```text
character_profiles(external_character_id)
WHERE external_character_id IS NOT NULL
```

Yani uniqueness global kabul edilmiştir; `(user_id, external_character_id)` değildir. Migration comment’i de external GTA World character ID’nin tek Sanboard profile’a map edilmesini amaçlar. Ancak GTA World character IDs’nin global unique olduğuna dair repository içinde upstream contract kanıtı yoktur. **Varsayım: schema’da açık; upstream gerçekliği kanıtlanmadı.**

Sync yine select-then-insert’tür. Concurrent sync’te duplicate kalıcı olmaz fakat loser request conflict recovery yapmadığı için character result eksik veya login request başarısız olabilir.

### İsim fallback riski

Identity’nin authoritative alanı external ID olmalıdır. Mevcut sync, aynı user altındaki `full_name` eşleşmesini fallback identity olarak kullanır. Riskler:

- Aynı account’ta aynı isimli iki farklı external character varsa mevcut row’un external ID’si yeniden bağlanabilir.
- Legacy external ID’siz row backfill amacı anlaşılır olsa da normal production sync ile aynı sorguda çalışması identity boundary’yi zayıflatır.
- Rename, external ID eşleştiği sürece doğru row’u günceller; bu test edilmiştir.

### Sonradan eklenen Character C

Bir sonraki başarılı OAuth callback’te payload’a C eklenirse lookup bulunamaz ve yeni profile insert edilir. A/B yalnız name/external/user/timestamp alanlarında idempotent update alır; Sanboard-owned state korunur. C için child feature row’ları yaratılmaz.

### Character removal

GTA World A/B döndürüp C döndürmezse C:

- DB’den silinmez.
- Disable edilmez.
- `/api/user/characters`, DB’de account’a bağlı tüm profiles’ı döndürdüğü için seçilebilir kalır.
- Historical listings/favorites korunur.

Bu davranış testte bilinçli “non-destructive” olarak doğrulanmıştır; fakat revoked/deleted GTA World karakterinin hâlâ seçilebilir olması için **PRODUCT DECISION REQUIRED**.

### Character limit = 3

Account character limit’i için UI, server veya DB constraint bulunmadı. Sync payload’daki tüm karakterleri loop eder. GTA World dört karakter döndürürse dört profile sync edilir ve picker dört karakter listeler.

**New character verdict: PARTIAL.**

## 5. New account simulation

### Çalıştırılan doğrulama

```text
npx tsx --test tests/gtaworld-oauth-and-isolation.test.ts tests/critical-listing-follow-fixes.test.ts
```

Sonuç: **26 test geçti, 0 failure**.

Mevcut tests şunları doğruluyor:

- Yeni GTA World account memory store’da `USER` olarak yaratılır.
- External account ve character IDs string’e çevrilir.
- Repeat login aynı user/profile identity’lerini korur.
- GTA World role verisi Sanboard ADMIN vermez.
- Existing Sanboard fields korunur.
- External ID aynıyken rename canonical profile’ı korur.
- Current provider payload’ında olmayan profile silinmez.
- UUID-looking external character ID canonical/external resolver’da doğru ele alınır.
- Canonical/external namespace collision fail-safe exception üretir.

### Scenario A — brand new account

`gtaw-user-9001` ve A/B/C için mevcut memory sync mantığı:

- Yeni memory user yaratır.
- Üç profile yaratır.
- Memory canonical ID’leri `char-${externalId}` biçimindedir; bu production UUID modeli değildir.
- Supabase path’inde ID’ler DB UUID default’u ile oluşturulur.

### Scenario B — next login

Memory test idempotency doğrulandı: aynı external account ve character IDs yeni row yaratmaz.

Supabase’te DB unique indexleri duplicate’i engeller; serial login idempotenttir. Concurrent login recovery ayrıca test edilmemiştir ve kodda yoktur.

### Test sınırı

Production DB’ye dokunulmadığı için real Supabase insert/default/FK davranışı live çalıştırılmadı. Supabase sonucu migration ve repository trace’ine dayalıdır.

## 6. New character simulation

### Scenario C — existing account, new C

Kod trace’i ve sync loop’u C’yi yeni row olarak oluşturur. Mevcut test suite bire bir A/B sonra C fixture’ı içermese de repeat/non-destructive/update mekanizması aynı fonksiyonda doğrulanır. Ayrı product test eklenmesi önerilir.

### Scenario D — rename

Mevcut test `77704` external ID’sini koruyup `Dave Miller` → `Dave Miller Jr` rename’ini doğrular. Canonical row aynı kalır; Sanboard avatar/phone/SanMail korunur. Dolayısıyla listings/favorites/follows FK’leri aynı canonical UUID üzerinde kalır.

### Scenario E — UUID-looking external ID

`SupabaseUserRepository.getProfileById()` identifier UUID görünüyorsa **hem** canonical `id` namespace’ini **hem** `external_character_id` namespace’ini sorgular. İki farklı row eşleşirse `selectUnambiguousProfile()` exception üretir. Böylece UUID görünümü external ID’nin business meaning’ini değiştirmez ve collision sessizce yanlış profile seçmez.

### Yeni karakterin ilk state’i

Child row precreation gerekmiyor:

| Feature | İlk state | Zorunlu row? |
|---|---:|---|
| Favorites | 0 | Hayır |
| Corporate follows | 0 | Hayır |
| Notifications | 0 | Hayır |
| Listings | 0 | Hayır |
| Listing credits | 0 | Hayır |
| Tickets | 0 | Hayır |
| Corporate store | yok | Hayır |
| Corporate application | yok | Hayır |
| Admin | `USER` default | Profile role default gerekir; migration sağlar |
| SanMail/phone | null | Stabilization migration null/default sağlar |

Initial login için profile dışında child table insert zorunluluğu yoktur. Null contact fallback’i, remote schema eski kalmışsa empty string ile retry eder.

## 7. Character switch/session

### Picker payload

Real `/api/user/characters`, character `id` alanına canonical `character_profiles.id` koyar ve external ID’yi ayrı `externalCharacterId` alanında döndürür. Picker profile varsa canonical `profile.id` hedefini gönderir.

### Switch endpoint

`POST /api/auth/session`:

1. Body’den `characterId || profileId` alır.
2. Supabase mode’da `getUserRepository().getProfileById()` ile canonical/external resolve eder.
3. Current signed session varsa target profile’ın `user_id` değerini session `userId` ile karşılaştırır.
4. Başarılı resolve sonrası signed session’a `profile?.id` yani canonical profile UUID yazar.
5. Role’ü target profile’dan yeniden hesaplamayı amaçlar.

### Güçlü taraflar

- External ID ile stale session gelse bile canonical profile ID’ye normalize edilir.
- Cross-account switch signed account ownership check’i ile 403 olur.
- Namespace collision fail-safe’dir.
- Character switch’in canonical ID imzaladığı regression testte doğrulanır.

### Kritik problemler

1. **Named role override:** Mavis name/IDs ADMIN, Ravi/Zade USER yapılır. Production business logic test fixture’a bağlıdır.
2. **Unauthenticated selection fallback:** Current session yoksa staging map veya `usr-${characterId}` fallback’i user identity üretebilir. Supabase real mode’da unknown profile engellense de mock/default configuration production deployment’ında tehlikelidir.
3. **Initial single-character login:** callback session role’ünü `selectedProfile.role` yerine `user.role` ile imzalar. Character-scoped admin modeliyle tutarsızdır. Sonraki switch doğru profile role’üne dönebilir; initial session stale/account-scoped olabilir.
4. `resolveOwnedActiveProfile()` role olarak DB profile role’ünü değil session role’ünü döndürür. Ownership canonicalize edilir ama role freshness garanti edilmez.
5. Client `AuthContext` session başarıdan sonra profile fetch başarısızsa synthetic profile yaratabilir. Server signed session canonical kaldığı için server security doğrudan bozulmaz; fakat frontend visible profile ile authoritative DB profile ayrışabilir.

### Mavis ADMIN → Ravi USER

Switch route Ravi target profile role’ünü `USER` olarak imzalar; fixture override da USER’a zorlar. Bu spesifik fixture scenario çalışır. Ancak testlerin önemli bölümü source regex veya ayrı token yaratımıdır; gerçek callback → Mavis select → Ravi HTTP switch → admin denial zincirinin tamamı dynamic, non-fixture profile’larla uçtan uca doğrulanmamıştır.

**Character switch verdict: PARTIAL.**

## 8. Identity namespaces

### Beklenen namespace

- Account canonical: `users.id` UUID.
- Account external: `users.external_user_id` TEXT.
- Character canonical: `character_profiles.id` UUID.
- Character external: `character_profiles.external_character_id` TEXT.

### Format varsayımları

- Sync runtime’da account/character IDs için `String(...)` kullanır; numeric parse yapmaz.
- Profile resolver UUID-looking identifier’ı yalnız canonical kabul etmez; external namespace’i de sorgular.
- `isUuid` yalnız canonical DB query’nin denenip denenmeyeceğini belirler; external query her zaman yapılır.
- Collision iki farklı row’a çıkarsa exception oluşur.

### Eksikler/hardcode’lar

- `GtaWorldApiUser.id` ve `GtaWorldApiCharacter.id` TypeScript’te `number` tanımlıdır. `abc123`, `char_123` veya UUID-looking string upstream contract type-check’te desteklenmez. Runtime JSON ve `String()` çalışabilir, fakat type model yanlış kısıtlıdır.
- `id-mapper.ts` belirli fixture UUID/legacy ID’lerini karşılıklı map eder.
- Memory sync canonical ID’yi `char-${externalId}` üretir; canonical/external separation production modeliyle bire bir değildir.
- Session fallback’i `characterId.startsWith('usr-')` business logic içerir.

### Collision verdict

`selectUnambiguousProfile()` canonical match ve external match farklı profile’lar ise açık diagnostic error üretir. **Fail-safe ve security boundary açısından protected.**

## 9. Database constraints

### `users`

| Alan | Durum |
|---|---|
| PK | `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()` |
| Provider | TEXT NOT NULL DEFAULT `GTAWORLD` |
| External identity | `external_user_id TEXT` |
| Role | USER/ADMIN, default USER |
| Status | ACTIVE/BANNED, default ACTIVE |
| Uniqueness | Unique partial index `(provider, external_user_id)` when non-null |

### `character_profiles`

| Alan | Durum |
|---|---|
| PK | `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()` |
| Parent | `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| External identity | `external_character_id TEXT` |
| External uniqueness | Global unique partial index on `external_character_id` |
| Name | NOT NULL |
| Role | Later migration: USER/ADMIN, default USER, NOT NULL |
| Contact | Later migration: nullable/default null |
| Public ID | Sequence-backed unique NOT NULL after migration |

### Character-scoped FK özeti

- `corporate_profiles.owner_profile_id` → character profile, cascade.
- `corporate_applications.applicant_profile_id` → character profile, cascade.
- `payments.profile_id` → character profile.
- `listing_credits.profile_id` → character profile.
- `listings.seller_profile_id` → character profile.
- `favorites.profile_id` → character profile, cascade.
- `reports.reporter_profile_id` → character profile.
- `support_tickets.profile_id` → character profile, cascade.
- `corporate_followers.follower_profile_id` → character profile, cascade.
- `notifications.recipient_profile_id` → character profile, cascade.

Yeni profile oluşturulduğunda child table row’u zorunlu değildir.

### Index/scale notu

- External account ve external character unique indexes lookup’ları indexler.
- `character_profiles.user_id` için migrationlarda açık dedicated index bulunamadı. FK otomatik index üretmez. `/api/user/characters` ve sync final fetch 30.000 profile ölçeğinde account lookup için index gerektirir.

## 10. Feature identity matrix

| Feature | Actor source | Canonical profile? | Client ID trust | Account leakage | Yeni character |
|---|---|---:|---:|---|---:|
| Favorite mutation | `resolveOwnedActiveProfile()` | Evet | Hayır | Düşük | Evet, boş state |
| Corporate follow mutation | `resolveOwnedActiveProfile()` | Evet | Hayır | Düşük | Evet |
| Create listing | `session.profileId || sellerProfileId` | Session varsa | **Evet, session yoksa** | **Yüksek** | Credit yoksa publish olmaz; identity endpoint partial |
| Republish listing | signed `session.profileId` | Evet | Hayır | Düşük | Credit yoksa beklenen business failure |
| Listing credit purchase | signed `session.profileId` | Evet | Hayır | Düşük | Evet, başlangıç 0 |
| Listing credit read | query `profileId` veya writable cookie | Belirsiz | **Evet** | **Yüksek/read leakage** | Evet ama insecure scope |
| Notifications | signed session veya writable cookie fallback | Genelde | Cookie fallback | Orta | Evet, 0 |
| Support tickets GET/POST | query/body `profileId` | Caller sağlar | **Evet** | **Yüksek** | Teknik olarak evet |
| Corporate application POST | session veya body profile ID | Session varsa | **Evet, session yoksa** | **Yüksek** | Evet |
| Corporate ownership/profile update | signed `session.profileId` | Evet | Update’te hayır | Düşük | Store yok state’i çalışır |
| Corporate subscription | signed session profile | Evet | Hayır | Düşük; ADMIN bypass ayrıca policy | Store yoksa güvenli failure |
| Admin main route | DB profile ownership + role | Supabase’te evet | Bazı writable cookie fallback | Orta; memory fixture bypass | USER deny beklenir |
| Admin audit route | account `users.role/status` | **Hayır, account scoped** | Hayır | Character-role modelle tutarsız | USER deny |
| Listing price/edit | bazı route’larda session, body/cookie fallback | Tutarsız | **Evet bazı yollar** | **Yüksek** | Listing yoksa boş state |

### Notlar

- Repository ownership kontrolleri bazı client-ID risklerini ikinci katmanda azaltabilir; fakat HTTP security boundary client ID’yi actor identity olarak kabul etmemelidir.
- Read endpoints de privacy boundary’dir; yalnız mutation güvenliği yeterli değildir.
- `GET /api/user/profile?profileId=...` ownership kontrolü yapmadan profile döndürür. Public profile endpoint olarak tasarlandıysa ürün kararı/documentation gerekir; active-account bootstrap için kullanılıyorsa leakage riskidir.

**Character-scoped features verdict: PARTIAL.**

## 11. Hardcoded character audit

### A) TEST/SEED/MOCK — kabul edilebilir bağlam

- `supabase/seed.sql`: Mavis/Zade sample rows ve demo listings.
- `tests/**`: Mavis/Ravi/Zade fixtures.
- `src/lib/integrations/gtaworld/mock-provider.ts`: mock characters.
- `src/lib/db/store.ts`: memory demo fixture data; yalnız kesin biçimde non-production store olarak kullanılırsa kabul edilebilir.

### B) PRODUCTION BUSINESS LOGIC — kritik

1. `src/app/api/auth/session/route.ts`
   - `STAGING_CHARACTER_ACCOUNTS` fixture UUID/legacy IDs ile account/role map eder.
   - Known fixture IDs unknown-profile rejection’dan muaf tutulur.
   - `full_name.includes('Mavis')` ADMIN verir.
   - Ravi/Zade adları role zorlar.

2. `src/app/api/admin/route.ts`
   - Memory path’inde Mavis name/ID ADMIN kabul edilir.
   - Belirli account IDs ownership bypass’e katılır.

3. `src/lib/db/id-mapper.ts`
   - Fixture account/profile IDs production utility içinde karşılıklı map edilir.

4. `src/lib/db/repositories/memory/memory-user-repo.ts`
   - Fixture UUID’leri named memory profile’lara map eder.

5. `src/features/auth/AuthContext.tsx`
   - Production client auth context içinde fixture account map’i vardır.

### C) UI demo/default content

- `src/app/profil-olustur/page.tsx`: `charId` yoksa Ravi UUID default; name yoksa `Ravi Blumon` default. Gerçek dynamic flow’da query/state bozulursa yanlış fixture UI gösterir.
- `src/app/odeme/[orderId]/page.tsx`: buyer name fallback `Mavis Pierce`.

### Kritik değerlendirme

`full_name.includes('Mavis')` ile ADMIN üretmek doğrudan production security bug’dır. Gerçek adı Mavis içeren herhangi bir profile role escalation yaşayabilir. Supabase switch route da bu override’ı uyguladığı için yalnız memory/mock sorunu değildir.

## 12. Seed dependency

### Boş database + ilk gerçek GTA World user

**Koşullu evet:** Applied schema/migrations mevcutsa, real OAuth config doğruysa ve state contract doğrulanmışsa ilk user ve characters otomatik yaratılabilir. Mavis/Ravi/Zade row’ları zorunlu değildir.

### Neden yalnız PARTIAL?

- Source fixture maps/role overrides içeriyor.
- Mock mode default davranışı `USE_MOCK_GTAWORLD_AUTH !== 'false'`; environment yanlış/eksikse real OAuth yerine fixture picker açılır.
- Empty DB’nin yalnız base schema değil gerekli later migrations’ı da almış olması gerekir: role, nullable contact, public ID default, unique indexes.
- Default package/credit purchase gibi onboarding sonrası feature’lar seed/package bootstrap’a ayrıca bağlı olabilir; account/profile creation buna bağlı değildir.

**Seed-independent verdict: PARTIAL.**

## 13. Security

| Saldırı / risk | Durum | Gerekçe |
|---|---|---|
| Başka account external character ID ile switch | **Protected** | Signed current account ile resolved profile ownership karşılaştırılır. |
| Client `profileId` injection — favorite/follow | **Protected** | Body/query actor ID yok sayılır; signed active profile canonicalize edilir. |
| Client `profileId` injection — tickets/credits/application/listing fallback | **Vulnerable** | Birden fazla endpoint client ID veya writable cookie kabul eder. |
| External user ID spoof | **Protected in real OAuth** | ID server-side Bearer `/api/user` response’undan gelir. Mock/default deployment config riski ayrıdır. |
| Duplicate account race | **Data protected / request vulnerable** | Unique index duplicate’i önler; retry/reselect yok. |
| Duplicate character race | **Data protected / request vulnerable** | Global unique external ID; conflict recovery yok. |
| Role spoof via client cookie | **Mixed** | Signed session ana kontrol; bazı routes writable role/profile cookie fallback kullanır. |
| ADMIN inheritance | **Vulnerable/unclear** | Single-character callback account role imzalar; named override role üretir; admin audit account-role kullanır. |
| UUID-looking external collision | **Protected** | İki namespace sorgulanır ve ambiguity exception olur. |
| Banned account login/switch | **Vulnerable** | Login boundary’de `users.status` check yok. |
| Removed/revoked GTAW character selection | **Unclear / product decision** | Local profile kalır ve seçilebilir. |

## 14. Scale

### Olumlu

- Account lookup unique indexed `(provider, external_user_id)`.
- External character lookup unique indexed `external_character_id`.
- Sync account başına provider payload kadar çalışır; global full table fetch yapmaz.
- `/api/user/characters` account `user_id` ile filtreler.

### Ciddi problemler

1. **N+1 character sync:** Her character için select + update/insert vardır; ardından tüm account profiles tekrar select edilir. Üç karakterde küçük, fakat limit uygulanmadığı için payload büyürse lineer round-trip artar.
2. **`character_profiles.user_id` index kanıtı yok:** 30.000 character ölçeğinde per-account profile listing/final merge scan riski vardır.
3. **Login başına GTA World `/api/user`:** Bu gerekli sync noktasıdır; `/api/user/characters` tekrar provider çağırmaz. Gereksiz per-request upstream call görülmedi.
4. **Name `ILIKE` OR predicate:** External ID indexed olsa da OR + name predicate query planning ve ambiguity açısından daha zayıftır.
5. **No atomic bulk upsert:** Latency ve race handling ayrı round-trip’lere yayılır.

## 15. P0/P1 issues

### P0

1. **Named Mavis role escalation — `src/app/api/auth/session/route.ts`.** `full_name.includes('Mavis')` target role’ü ADMIN yapar.
2. **Production auth mode yanlış default’a düşebilir.** `USE_MOCK_GTAWORLD_AUTH !== 'false'` nedeniyle explicit false yoksa mock login kullanılır; gerçek yeni users sync edilmez.
3. **Real OAuth state contract activation blocker.** Provider state döndürmüyorsa ve support explicit confirmed değilse gerçek login bloklanır.
4. **Unauthenticated/client-provided actor paths.** Create listing, ticket, application ve bazı listing edit/read yollarında signed active profile zorunlu değildir; başka character scope’una işlem riski vardır.

### P1

1. Character sync’in name fallback ile external identity rebinding yapabilmesi.
2. Concurrent first login/account sync conflict recovery olmaması.
3. Concurrent character insert conflict recovery olmaması.
4. Single-character OAuth callback’in character role yerine account role imzalaması.
5. `users.status=BANNED` login/switch enforcement olmaması.
6. Notification/credits/admin/profile gibi bazı endpoint’lerde writable cookie fallback’i.
7. Support tickets’ın client profile ID’sine tamamen güvenmesi.
8. Removed GTA World character’ın local picker’da seçilebilir kalması; policy yok.
9. Character limit 3’ün server/DB seviyesinde uygulanmaması.
10. Account-role ve character-role modellerinin admin endpoint’lerinde karışması.

### P2

1. GTA World external ID TypeScript types’ın `number` ile sınırlı olması.
2. `character_profiles.user_id` dedicated index eksikliği.
3. Per-character N+1 sync.
4. Frontend synthetic profile fallback’inin visible/server state ayrışması yaratabilmesi.
5. UI default Ravi/Mavis content.

### P3

1. Fixture mapping utility’lerini production modules’dan ayırma.
2. Legacy writable routing cookie’lerini yalnız UX hint haline getirme veya kaldırma.
3. Mock memory canonical ID üretimini production UUID modeline yaklaştırma.

## 16. Final readiness verdict

### A) NEW ACCOUNT READY? — **PARTIAL**

Auto-create ve DB uniqueness vardır. Ancak real OAuth activation/state doğrulaması, banned status enforcement ve concurrent insert recovery tamamlanmamıştır.

### B) NEW CHARACTER READY? — **PARTIAL**

Yeni character sonraki login’de otomatik keşfedilip oluşturulur. Fakat sync atomic değildir, name identity fallback’i vardır ve removed character lifecycle kararsızdır.

### C) CHARACTER SWITCH READY? — **PARTIAL**

Canonical/external resolver, collision fail-safe ve ownership check güçlüdür. Named fixture role override’ları ve initial/session role tutarsızlığı production readiness’i engeller.

### D) CHARACTER-SCOPED FEATURES READY? — **PARTIAL**

Favorite, corporate follow ve republish gibi düzeltilmiş yollar canonical active profile kullanır. Tickets, credits read, applications, listing create/edit ve bazı notification/admin yollarında actor source tutarlı değildir.

### E) SEED-INDEPENDENT? — **PARTIAL**

Core real OAuth account/profile sync seed gerektirmez. Ancak production-facing source fixture IDs/names içerir ve mock mode default’u deployment config’e bağlıdır.

### F) PRODUCTION SCALE IDENTITY MODEL? — **NEEDS WORK**

Schema canonical UUID/FK modeli doğru yöndedir. Auth boundary standardizasyonu, atomic sync/upsert, lifecycle policy ve indexes tamamlanmadan 10.000+ account açılımı önerilmez.

## 17. Recommended implementation plan

> Bu audit kapsamında hiçbir phase uygulanmamıştır.

### PHASE A — Dynamic account bootstrap

**Dosyalar**

- `src/app/api/auth/gtaworld/login/route.ts`
- `src/app/api/auth/gtaworld/callback/route.ts`
- `src/lib/integrations/gtaworld/real-provider.ts`
- `src/lib/auth/gtaworld-sync.ts`
- Yeni/ayrılmış account bootstrap repository/service testleri

**İşler**

- Real/mock mode’u production-safe explicit config yap.
- OAuth state provider contract’ını canlı entegrasyonla doğrula.
- Account lookup/create’i DB atomic upsert veya insert-on-conflict + reselect yap.
- Existing `users.status` enforcement ekle.
- Single-character session role’ünü selected profile role’ünden üret.

**Migration gerekir mi?** Mevcut unique index production’da gerçekten varsa hayır; eksik environment için reconciliation gerekebilir.
**Data migration?** Duplicate preflight yalnız constraint eksikse.
**Risk:** Auth outage/lockout.
**Tests:** zero account, concurrent first login, banned account, provider state supported/unsupported, alphanumeric external user ID.

### PHASE B — Character sync/upsert

**Dosyalar**

- `src/lib/auth/gtaworld-sync.ts`
- GTA World types/provider
- user repository veya yeni character sync repository
- `src/app/api/user/characters/route.ts`

**İşler**

- External ID’yi tek authoritative identity yap.
- Name fallback’i yalnız explicit legacy reconciliation path’ine taşı.
- Atomic/bulk upsert ve conflict recovery kullan.
- Character role default’unu explicit `USER` yaz veya DB default’unu test et.
- Removal/revocation policy için product decision uygula.
- Maximum 3 davranışı product kararı sonrası server/DB’de tanımla.
- External ID types’ını opaque string yap.

**Migration gerekir mi?** Muhtemelen `character_profiles(user_id)` index; limit/status alanı seçilirse ayrıca migration.
**Data migration?** External ID’siz veya name ile yanlış bağlanmış legacy profiles için preflight/reconciliation gerekebilir.
**Risk:** Yanlış merge veya duplicate conflict.
**Tests:** A/B/C first sync, repeat, later C, rename, same-name different IDs, cross-account external collision, concurrent sync, UUID-looking external ID, 4-character payload.

### PHASE C — Canonical session/profile identity

**Dosyalar**

- `src/app/api/auth/session/route.ts`
- `src/lib/auth/active-profile.ts`
- `src/lib/auth/session.ts`
- `src/features/auth/AuthContext.tsx`
- `src/app/karakter-sec/page.tsx`
- `src/lib/db/id-mapper.ts`

**İşler**

- Tüm fixture maps/name overrides kaldır veya mock-only module boundary’ye taşı.
- Switch yalnız existing signed account session ile yapılabilsin.
- Signed session daima canonical `profileId` ve DB-fresh character role taşısın.
- Active profile resolver role’ü DB profile’dan döndürsün.
- Client synthetic profile fallback’ini authoritative state’ten ayır.
- Writable routing cookies authorization için hiçbir yerde kullanılmasın.

**Migration gerekir mi?** Hayır.
**Data migration?** Hayır.
**Risk:** Existing mock/demo flow kırılması.
**Tests:** dynamic ADMIN→USER→ADMIN switches, cross-account switch, stale external-ID session, collision, banned user, no active profile.

### PHASE D — Feature isolation

**Dosyalar**

- `src/app/api/listings/route.ts`
- `src/app/api/user/listings/[id]/route.ts`
- `src/app/api/credits/route.ts`
- `src/app/api/notifications/route.ts`
- `src/app/api/tickets/**`
- `src/app/api/dealers/apply/route.ts`
- `src/app/api/dealers/eligibility/route.ts`
- `src/app/api/admin/**`
- İlgili repositories

**İşler**

- Tüm private routes `resolveOwnedActiveProfile()` veya daha güçlü tek actor resolver kullansın.
- Body/query/cookie profile IDs yalnız resource identifier olabilir; actor olamaz.
- Listing ownership, ticket ownership, credit visibility, application ownership testlerini dynamic profiles ile ekle.
- Admin modeli yalnız character profile role’e bağlansın; account role legacy ise kaldırma planı yap.

**Migration gerekir mi?** Genellikle hayır; eksik FK/unique constraint production reconciliation’a bağlı olabilir.
**Data migration?** Legacy account-scoped notifications/favorites varsa reconciliation gerekebilir.
**Risk:** Legacy clients 401/403 almaya başlayabilir.
**Tests:** client ID injection, sibling character isolation, cross-account reads/mutations, new character empty state.

### PHASE E — Legacy/seed cleanup

**Dosyalar**

- `src/lib/db/store.ts`
- `src/lib/db/id-mapper.ts`
- `src/lib/integrations/gtaworld/mock-provider.ts`
- `src/features/auth/AuthContext.tsx`
- `src/app/profil-olustur/page.tsx`
- `src/app/odeme/[orderId]/page.tsx`
- `supabase/seed.sql`

**İşler**

- Mock fixtures’ı production bundle/business logic’ten ayır.
- UI default named characters’ı neutral state yap.
- Seed’in yalnız explicit local/test workflow’da kullanıldığını enforce/document et.
- Fixture UUID mappings’i test helper’larına taşı.

**Migration gerekir mi?** Hayır; production’da fixture rows silinecekse ayrı, review edilmiş data migration/operational plan gerekir.
**Data migration?** Yalnız gerçek production fixture cleanup kararı verilirse.
**Risk:** Demo/test fixtures’ın bozulması.
**Tests:** empty memory store, no seed, no known names/IDs, production build source scan.

---

## Audit evidence summary

- Initial working tree: temiz; tracked/untracked değişiklik yoktu.
- Product code değiştirilmedi.
- Production DB’ye erişilmedi.
- Migration çalıştırılmadı veya oluşturulmadı.
- Hedefli tests: 26 pass, 0 fail.
- Tek yeni artifact: `SANBOARD-DYNAMIC-IDENTITY-ONBOARDING-AUDIT.md`.