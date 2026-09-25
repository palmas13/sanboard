-- ============================================================================
-- SANBOARD PRODUCTION SCHEMA CORRECTION
-- File: 20260925030000_production_schema_correction.sql
--
-- Production schema inspection sonucu hazırlanmıştır.
--
-- Covers:
-- - Character scoped admin role
-- - Character scoped favorites
-- - Character scoped notifications
-- - Corporate owner uniqueness
-- - Phone normalization
-- - Individual / corporate credit separation
-- - Corporate package
-- - Corporate social media array normalization (max 2)
-- - Notification indexes using read_at
-- ============================================================================

BEGIN;


-- ============================================================================
-- 0. PREFLIGHT — CORPORATE OWNER DUPLICATE
-- ============================================================================

DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO duplicate_count
    FROM (
        SELECT owner_profile_id
        FROM public.corporate_profiles
        WHERE owner_profile_id IS NOT NULL
        GROUP BY owner_profile_id
        HAVING COUNT(*) > 1
    ) x;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION
            'Migration durduruldu: aynı karaktere ait birden fazla corporate profile bulundu (% conflict).',
            duplicate_count;
    END IF;
END $$;


-- ============================================================================
-- 1. PREFLIGHT — PHONE NORMALIZATION COLLISION
-- ============================================================================

DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO duplicate_count
    FROM (
        SELECT regexp_replace(phone, '\D', '', 'g') AS normalized_phone
        FROM public.character_profiles
        WHERE phone IS NOT NULL
          AND phone <> ''
        GROUP BY regexp_replace(phone, '\D', '', 'g')
        HAVING COUNT(*) > 1
    ) x;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION
            'Migration durduruldu: telefon normalizasyonu % duplicate oluşturuyor.',
            duplicate_count;
    END IF;
END $$;


-- ============================================================================
-- 2. CHARACTER-SCOPED ADMIN ROLE
-- ============================================================================

ALTER TABLE public.character_profiles
ADD COLUMN IF NOT EXISTS role VARCHAR(16);

UPDATE public.character_profiles
SET role = 'USER'
WHERE role IS NULL;

ALTER TABLE public.character_profiles
ALTER COLUMN role SET DEFAULT 'USER';

ALTER TABLE public.character_profiles
ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_character_profiles_role'
          AND conrelid = 'public.character_profiles'::regclass
    ) THEN
        ALTER TABLE public.character_profiles
        ADD CONSTRAINT chk_character_profiles_role
        CHECK (role IN ('USER', 'ADMIN'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_character_profiles_role
ON public.character_profiles(role);


-- ============================================================================
-- 3. FAVORITES — CHARACTER OWNERSHIP
-- ============================================================================

ALTER TABLE public.favorites
ADD COLUMN IF NOT EXISTS profile_id UUID;

-- FK zaten production'da mevcut olabilir.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'favorites_profile_id_fkey'
          AND conrelid = 'public.favorites'::regclass
    ) THEN
        ALTER TABLE public.favorites
        ADD CONSTRAINT favorites_profile_id_fkey
        FOREIGN KEY (profile_id)
        REFERENCES public.character_profiles(id)
        ON DELETE CASCADE;
    END IF;
END $$;


-- --------------------------------------------------------------------------
-- Güvenli legacy backfill:
-- Eğer legacy favorite user_id'sinin bağlı olduğu account'ta yalnızca TEK karakter
-- varsa profile_id güvenle atanabilir.
--
-- Birden fazla karakter varsa tahmin YAPILMAZ.
-- --------------------------------------------------------------------------

UPDATE public.favorites f
SET profile_id = x.profile_id
FROM (
    SELECT
        cp.user_id,
        MIN(cp.id::text)::uuid AS profile_id
    FROM public.character_profiles cp
    GROUP BY cp.user_id
    HAVING COUNT(*) = 1
) x
WHERE f.profile_id IS NULL
  AND f.user_id = x.user_id;


-- Eski account-level UNIQUE kurallarını kaldır.
ALTER TABLE public.favorites
DROP CONSTRAINT IF EXISTS favorites_user_id_listing_id_key;

ALTER TABLE public.favorites
DROP CONSTRAINT IF EXISTS favorites_user_listing_unique;

ALTER TABLE public.favorites
DROP CONSTRAINT IF EXISTS uq_favorites_user_listing;

DROP INDEX IF EXISTS public.idx_favorites_user_listing;


-- Character-level canonical uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS uq_favorites_profile_listing
ON public.favorites(profile_id, listing_id)
WHERE profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_favorites_profile_id
ON public.favorites(profile_id);


-- user_id legacy alan olarak kalabilir fakat artık zorunlu recipient/owner değildir.
ALTER TABLE public.favorites
ALTER COLUMN user_id DROP NOT NULL;


-- ============================================================================
-- 4. NOTIFICATIONS — CHARACTER-SCOPED RECIPIENT
-- ============================================================================

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS recipient_profile_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'notifications_recipient_profile_id_fkey'
          AND conrelid = 'public.notifications'::regclass
    ) THEN
        ALTER TABLE public.notifications
        ADD CONSTRAINT notifications_recipient_profile_id_fkey
        FOREIGN KEY (recipient_profile_id)
        REFERENCES public.character_profiles(id)
        ON DELETE CASCADE;
    END IF;
END $$;


-- Legacy notification güvenli backfill:
-- Yalnızca account'ta TEK character profile varsa eşleme yapılır.
-- Multi-character account notificationları tahmin edilmez.

UPDATE public.notifications n
SET recipient_profile_id = x.profile_id
FROM (
    SELECT
        cp.user_id,
        MIN(cp.id::text)::uuid AS profile_id
    FROM public.character_profiles cp
    GROUP BY cp.user_id
    HAVING COUNT(*) = 1
) x
WHERE n.recipient_profile_id IS NULL
  AND n.user_id = x.user_id;


-- Yeni notification sistemi recipient_profile_id kullanıyor.
-- user_id eski kayıtlar için legacy olarak tutulur fakat artık NOT NULL değildir.

ALTER TABLE public.notifications
ALTER COLUMN user_id DROP NOT NULL;


CREATE INDEX IF NOT EXISTS idx_notifications_recipient_profile_id
ON public.notifications(recipient_profile_id);

CREATE INDEX IF NOT EXISTS idx_notifications_profile_created
ON public.notifications(recipient_profile_id, created_at DESC);

-- Production şemada is_read YOK; read_at kullanılıyor.
CREATE INDEX IF NOT EXISTS idx_notifications_profile_unread
ON public.notifications(recipient_profile_id, created_at DESC)
WHERE read_at IS NULL;


-- ============================================================================
-- 5. ONE CORPORATE STORE PER CHARACTER
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_corporate_profiles_owner_profile_id'
          AND conrelid = 'public.corporate_profiles'::regclass
    ) THEN
        ALTER TABLE public.corporate_profiles
        ADD CONSTRAINT uq_corporate_profiles_owner_profile_id
        UNIQUE (owner_profile_id);
    END IF;
END $$;


-- ============================================================================
-- 6. PHONE NORMALIZATION
-- ============================================================================

UPDATE public.character_profiles
SET phone = NULLIF(regexp_replace(phone, '\D', '', 'g'), '')
WHERE phone IS NOT NULL
  AND phone <> ''
  AND phone ~ '\D';


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_character_profiles_phone_digits'
          AND conrelid = 'public.character_profiles'::regclass
    ) THEN
        ALTER TABLE public.character_profiles
        ADD CONSTRAINT chk_character_profiles_phone_digits
        CHECK (
            phone IS NULL
            OR phone = ''
            OR phone ~ '^[0-9]+$'
        );
    END IF;
END $$;


-- ============================================================================
-- 7. PACKAGES — ADD SELLER TYPE
-- ============================================================================

ALTER TABLE public.packages
ADD COLUMN IF NOT EXISTS seller_type VARCHAR(32);

UPDATE public.packages
SET seller_type = 'INDIVIDUAL'
WHERE seller_type IS NULL;

ALTER TABLE public.packages
ALTER COLUMN seller_type SET DEFAULT 'INDIVIDUAL';

ALTER TABLE public.packages
ALTER COLUMN seller_type SET NOT NULL;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_packages_seller_type'
          AND conrelid = 'public.packages'::regclass
    ) THEN
        ALTER TABLE public.packages
        ADD CONSTRAINT chk_packages_seller_type
        CHECK (seller_type IN ('INDIVIDUAL', 'CORPORATE'));
    END IF;
END $$;


-- Mevcut $2000 / 7 günlük package bireyseldir.
UPDATE public.packages
SET
    seller_type = 'INDIVIDUAL',
    price = 2000,
    duration_days = 7,
    active = TRUE
WHERE price = 2000
  AND duration_days = 7;


-- Kurumsal package yoksa ekle.
-- id UUID default'a bırakılır; production packages tablosunda created_at/updated_at yok.

INSERT INTO public.packages (
    code,
    name,
    price,
    duration_days,
    active,
    seller_type
)
SELECT
    'CORPORATE_14_DAY',
    '14 Günlük Kurumsal İlan',
    1750,
    14,
    TRUE,
    'CORPORATE'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.packages
    WHERE code = 'CORPORATE_14_DAY'
);


-- Varsa doğru değerlere çek.
UPDATE public.packages
SET
    name = '14 Günlük Kurumsal İlan',
    price = 1750,
    duration_days = 14,
    active = TRUE,
    seller_type = 'CORPORATE'
WHERE code = 'CORPORATE_14_DAY';


-- ============================================================================
-- 8. LISTING CREDITS — INDIVIDUAL / CORPORATE SEPARATION
-- ============================================================================

ALTER TABLE public.listing_credits
ADD COLUMN IF NOT EXISTS credit_type VARCHAR(32);

ALTER TABLE public.listing_credits
ADD COLUMN IF NOT EXISTS amount INTEGER;


-- Existing legacy credits are standard individual credits.
UPDATE public.listing_credits
SET credit_type = 'INDIVIDUAL'
WHERE credit_type IS NULL;

UPDATE public.listing_credits
SET amount = 2000
WHERE amount IS NULL;


ALTER TABLE public.listing_credits
ALTER COLUMN credit_type SET DEFAULT 'INDIVIDUAL';

ALTER TABLE public.listing_credits
ALTER COLUMN credit_type SET NOT NULL;

ALTER TABLE public.listing_credits
ALTER COLUMN amount SET DEFAULT 2000;

ALTER TABLE public.listing_credits
ALTER COLUMN amount SET NOT NULL;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_listing_credits_credit_type'
          AND conrelid = 'public.listing_credits'::regclass
    ) THEN
        ALTER TABLE public.listing_credits
        ADD CONSTRAINT chk_listing_credits_credit_type
        CHECK (credit_type IN ('INDIVIDUAL', 'CORPORATE'));
    END IF;
END $$;


CREATE INDEX IF NOT EXISTS idx_listing_credits_type_status
ON public.listing_credits(profile_id, credit_type, status);


-- ============================================================================
-- 9. CORPORATE SOCIAL MEDIA
-- Canonical:
-- [
--   {"name":"LifeInvader","url":"https://..."},
--   {"name":"Facebrowser","url":"https://..."}
-- ]
-- Maximum 2.
-- ============================================================================


-- Önce desteklenmeyen yapı var mı kontrol et.
DO $$
DECLARE
    bad_count INTEGER;
    too_many_count INTEGER;
BEGIN

    -- Array olan kayıtlarda 2'den fazla öğe var mı?
    -- CASE kullanıyoruz çünkü PostgreSQL AND koşullarını
    -- garanti edilen sırayla değerlendirmez.
    SELECT COUNT(*)
    INTO too_many_count
    FROM public.corporate_profiles
    WHERE CASE
        WHEN social_media IS NULL THEN FALSE
        WHEN jsonb_typeof(social_media) = 'array'
            THEN jsonb_array_length(social_media) > 2
        ELSE FALSE
    END;

    IF too_many_count > 0 THEN
        RAISE EXCEPTION
            'Migration durduruldu: % corporate profile üzerinde 2''den fazla social media kaydı bulundu.',
            too_many_count;
    END IF;


    -- Legacy objectlerde 2'den fazla dolu string bağlantı var mı?
    SELECT COUNT(*)
    INTO too_many_count
    FROM public.corporate_profiles cp
    WHERE CASE
        WHEN cp.social_media IS NULL THEN FALSE

        WHEN jsonb_typeof(cp.social_media) <> 'object' THEN FALSE

        -- canonical eski tek kayıt {name,url} ayrı işlenecek
        WHEN cp.social_media ? 'name'
         AND cp.social_media ? 'url'
        THEN FALSE

        ELSE (
            SELECT COUNT(*)
            FROM jsonb_each(cp.social_media) AS e(key, value)
            WHERE jsonb_typeof(e.value) = 'string'
              AND btrim(e.value #>> '{}') <> ''
        ) > 2
    END;

    IF too_many_count > 0 THEN
        RAISE EXCEPTION
            'Migration durduruldu: % legacy corporate social_media kaydında 2''den fazla bağlantı var. Manuel seçim gerekli.',
            too_many_count;
    END IF;


    -- Array veya object dışı desteklenmeyen JSON tipi var mı?
    SELECT COUNT(*)
    INTO bad_count
    FROM public.corporate_profiles
    WHERE social_media IS NOT NULL
      AND jsonb_typeof(social_media) NOT IN ('array', 'object');

    IF bad_count > 0 THEN
        RAISE EXCEPTION
            'Migration durduruldu: % desteklenmeyen social_media JSON tipi bulundu.',
            bad_count;
    END IF;

END $$;


-- NULL → []
UPDATE public.corporate_profiles
SET social_media = '[]'::jsonb
WHERE social_media IS NULL;


-- {} → []
UPDATE public.corporate_profiles
SET social_media = '[]'::jsonb
WHERE jsonb_typeof(social_media) = 'object'
  AND social_media = '{}'::jsonb;


-- Legacy canonical single:
-- {"name":"LifeInvader","url":"https://..."}
-- →
-- [{"name":"LifeInvader","url":"https://..."}]

UPDATE public.corporate_profiles
SET social_media =
    CASE
        WHEN btrim(COALESCE(social_media->>'name', '')) = ''
          OR btrim(COALESCE(social_media->>'url', '')) = ''
        THEN '[]'::jsonb

        ELSE jsonb_build_array(
            jsonb_build_object(
                'name', btrim(social_media->>'name'),
                'url', btrim(social_media->>'url')
            )
        )
    END
WHERE jsonb_typeof(social_media) = 'object'
  AND social_media ? 'name'
  AND social_media ? 'url';


-- Legacy fixed-key object:
-- {"Facebrowser":"url","Twitter":"url"}
-- →
-- [
--   {"name":"Facebrowser","url":"url"},
--   {"name":"Twitter","url":"url"}
-- ]

UPDATE public.corporate_profiles cp
SET social_media = COALESCE((
    SELECT jsonb_agg(
        jsonb_build_object(
            'name', e.key,
            'url', btrim(e.value #>> '{}')
        )
        ORDER BY e.key
    )
    FROM jsonb_each(cp.social_media) e(key, value)
    WHERE jsonb_typeof(e.value) = 'string'
      AND btrim(e.value #>> '{}') <> ''
), '[]'::jsonb)
WHERE jsonb_typeof(cp.social_media) = 'object';


-- Artık default array.
ALTER TABLE public.corporate_profiles
ALTER COLUMN social_media SET DEFAULT '[]'::jsonb;


-- Mevcut değerler NULL değil.
UPDATE public.corporate_profiles
SET social_media = '[]'::jsonb
WHERE social_media IS NULL;


DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_corporate_profiles_social_media'
          AND conrelid = 'public.corporate_profiles'::regclass
    ) THEN
        ALTER TABLE public.corporate_profiles
        ADD CONSTRAINT chk_corporate_profiles_social_media
        CHECK (
    CASE
        WHEN social_media IS NULL THEN TRUE
        WHEN jsonb_typeof(social_media) = 'array'
            THEN jsonb_array_length(social_media) <= 2
        ELSE FALSE
    END
);
    END IF;
END $$;


-- ============================================================================
-- 10. CORPORATE FOLLOWERS INDEX
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_corporate_followers_store_follower
ON public.corporate_followers(corporate_profile_id, follower_profile_id);


COMMIT;