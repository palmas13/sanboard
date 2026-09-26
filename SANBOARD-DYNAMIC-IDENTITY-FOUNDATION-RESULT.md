# SANBOARD — Dynamic Identity Foundation / Paket 1 Sonucu

**Tarih:** 26 Eylül 2026
**Kapsam:** GTA World account/character bootstrap, canonical session identity, role/status enforcement, mock/real boundary ve identity regressionları.

## Kısa sonuç

1. Yeni GTA World hesabı seed olmadan canonical `users` satırı ve canonical UUID profile'ları ile oluşturulur.
2. Supabase first-login unique race'i `23505` conflict sonrası authoritative row'u tekrar seçerek recovery yapar.
3. Yeni karakterler external character ID ile otomatik oluşturulur; repeat login duplicate üretmez.
4. Karakter adı identity değildir; rename aynı canonical profile'ı korur ve aynı isimli farklı external ID'ler ayrı profile olur.
5. Production-facing auth/session/admin/AuthContext/id-mapper akışlarında named fixture role/account override'ı kaldırıldı.
6. Yeni signed character session `character_profiles.id` taşır; external ID yalnız resolve input'u olabilir.
7. Login/switch/admin authorization ve active-profile çözümünde authoritative role `character_profiles.role` değeridir.
8. `users.status=BANNED` callback session creation ve character switch'i engeller.
9. Yeni `character_profiles(user_id)` index migrationı hazırlandı ve production Supabase SQL Editor'da manuel uygulandı; artık APPLIED / LOCKED kabul edilir.
10. Uygulama görevi sırasında production DB'ye bağlanılmadı, migration çalıştırılmadı ve `supabase db push` çalıştırılmadı; production uygulaması daha sonra manuel SQL Editor işlemiyle tamamlandı.

## 1. Removed fixture production logic

- Session route içindeki fixture account map, known-ID exemptions ve name-based role escalation kaldırıldı.
- Admin route signed canonical active profile ve DB-fresh profile role kullanır.
- `id-mapper.ts` named fixture ID dönüşümleri kaldırıldı.
- `AuthContext` fixture account map veya synthetic profile üretmez.
- Profile creation ve checkout ekranlarındaki named defaults neutral hale getirildi.
- Fixture verisi explicit mock provider/local demo store içinde kalabilir; production identity kararı vermez.

## 2. New account bootstrap

Authoritative account key `(provider='GTAWORLD', external_user_id)` olarak korunur. External ID `String(...)` ile opaque string'e normalize edilir. Yeni account:

- DB-generated UUID (`users.id`)
- `role=USER`
- `status=ACTIVE`

ile oluşturulur. Seed veya manuel SQL gerekmez.

## 3. Concurrent login behavior

Supabase flow mevcut account'u arar, yoksa insert eder. Insert `23505` unique conflict döndürürse aynı provider/external ID ile tekrar select eder. İki first-login request aynı canonical user ile devam edebilir. Memory regressionında simultaneous invocation tek user ve tek profile setine converge eder.

## 4. Character sync identity

- Tek authoritative provider identity `external_character_id` değeridir.
- Normal login sync içinde `full_name` fallback yoktur.
- Rename yalnız display name'i günceller; profile UUID ve Sanboard-owned state korunur.
- Aynı isimli farklı external ID'ler ayrı canonical profile oluşturur.
- Provider'ın number döndürmesi desteklenir ama application contract `string | number`, internal identity ise string'dir.

## 5. Character sync conflict behavior

Profile insert unique conflict verirse row external ID ile tekrar seçilir. Row aynı `users.id` altındaysa sync devam eder; farklı account altındaysa security/identity collision olarak fail-safe hata üretilir. Profile başka account'a sessizce taşınmaz.

Mevcut schema `external_character_id` için global uniqueness varsayar. GTA World upstream contract içinde bunun global unique olduğuna dair repository-local kesin kanıt bulunmadı. Bu nedenle schema değiştirilmedi; konu **PRODUCT/INTEGRATION ASSUMPTION** olarak açık kalır.

## 6. Session canonicalization

Signed session contract:

```text
userId    = users.id
profileId = character_profiles.id
role      = character_profiles.role
```

Character switch canonical veya external identifier kabul eder; repository iki namespace'i collision-safe çözer. Başarılı switch daima canonical profile UUID ile yeni token imzalar. Switch yalnız mevcut signed account session'ında yapılabilir ve target ownership exact `profile.user_id === session.userId` ile doğrulanır.

## 7. Role behavior

- GTA World role verisi Sanboard ADMIN vermez.
- Account-level `users.role` sibling character'a taşınmaz.
- Single-character callback selected profile role kullanır.
- Switch target profile role kullanır.
- `resolveOwnedActiveProfile()` resolved DB profile role döndürür.
- İsim veya fixture ID role belirlemez.

## 8. BANNED behavior

- OAuth callback sync sonucunda authoritative DB user status kontrol edilir; BANNED ise session/picker akışına devam edilmez.
- Character switch user'ı DB/repository üzerinden yeniden yükler; BANNED ise 403 döner ve yeni signed session yazmaz.
- Status body veya client cookie'den alınmaz.

## 9. Mock/real auth mode

- Mock yalnız `USE_MOCK_GTAWORLD_AUTH=true` olduğunda etkinleşir.
- Eksik veya farklı değer real provider seçer; production yanlış env nedeniyle fixture login'e düşmez.
- Explicit mock login de callback ve canonical sync akışından geçer; session route fixture isim/ID bilmez.
- Real credential eksikliği mevcut güvenli `oauth_config_missing` hatasını üretir.

## 10. Migration/schema changes

Yeni migration:

`supabase/migrations/20260926050000_dynamic_identity_foundation.sql`

Yalnız şu non-unique lookup indexini ekler:

```sql
CREATE INDEX IF NOT EXISTS idx_character_profiles_user_id
ON public.character_profiles(user_id);
```

Mevcut unique indexes tekrar oluşturulmadı:

- `users(provider, external_user_id) WHERE external_user_id IS NOT NULL`
- `character_profiles(external_character_id) WHERE external_character_id IS NOT NULL`

Önceki locked/applied migrationlar değiştirilmedi. Bu migration production Supabase SQL Editor'da manuel uygulandı ve artık APPLIED / LOCKED kabul edilir; içeriği bundan sonra değiştirilmemelidir.

## 11. Tests

Yeni `tests/dynamic-identity-foundation.test.ts` şunları kapsar:

- zero-data new account + A/B/C profiles
- repeat ve simultaneous login idempotency
- A/B → A/B/C sync
- rename/state preservation
- same-name/different-ID profiles
- numeric, alpha, underscored ve UUID-looking external IDs
- cross-account external-ID collision
- canonical signed switch ve ADMIN→USER role isolation
- name cannot escalate role
- BANNED switch denial
- explicit mock/default real mode
- production source fixture guard
- unique/index migration contracts

Existing GTA World isolation ve favorite/corporate follow regressionları da targeted run içinde doğrulandı.

## 12. Remaining product decisions

- GTA World OAuth `state` davranışı operational olarak doğrulanmalıdır.
- External character ID'nin upstream global uniqueness garantisi kanıtlanmalıdır; bu pakette schema varsayımı değiştirilmedi.
- Provider'dan kaldırılan karakterlerin lifecycle kararı sonraki product phase'e bırakıldı; bu paket delete/disable yapmaz.
- Üç karakter limiti enforce edilmedi; architecture arbitrary character count ile çalışır.
- Legacy `external_character_id IS NULL` profile reconciliation normal login path'ine eklenmedi; gerekirse ayrı preflight/migration/script olarak ele alınmalıdır.

## Validation sonucu

- Başlangıç baseline: TypeScript temiz, 233/233 test geçti, build başarılı.
- Identity targeted: 38/38 test geçti.
- Favorite/admin compatibility targeted: 62/62 test geçti.
- Final TypeScript: 0 hata.
- Final full suite: 245/245 test geçti, 0 failure.
- Final production build: başarılı.
- `git diff --check`: temiz.
- Locked migration diff: yok.