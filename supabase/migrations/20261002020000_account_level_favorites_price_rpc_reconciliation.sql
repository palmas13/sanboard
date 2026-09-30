-- Migration: 20261002020000_account_level_favorites_price_rpc_reconciliation.sql
-- Forward-only reconciliation for environments where the original migration has already been applied.
-- Description: Allow NULL location for vehicles, keep prices as BIGINT, migrate
-- favorites to account ownership, and provide the canonical atomic price update RPC.

-- ============================================================================
-- 1. VEHICLE LOCATION RELAXATION & NORMALIZATION
-- ============================================================================

ALTER TABLE public.listings ALTER COLUMN location DROP NOT NULL;

UPDATE public.listings
SET location = NULL
WHERE category = 'vehicle'
  AND location IS NOT NULL
  AND btrim(location) = '';

-- ============================================================================
-- 2. PRICE TYPE UPGRADE (BIGINT COMPATIBILITY)
-- ============================================================================

ALTER TABLE public.listings ALTER COLUMN price TYPE BIGINT;
ALTER TABLE public.listing_price_history ALTER COLUMN old_price TYPE BIGINT;
ALTER TABLE public.listing_price_history ALTER COLUMN new_price TYPE BIGINT;

-- ============================================================================
-- 3. FAVORITES: ACCOUNT-LEVEL OWNERSHIP & SAFE LEGACY BACKFILL
-- ============================================================================

ALTER TABLE public.favorites ADD COLUMN IF NOT EXISTS user_id UUID;

DO $$
DECLARE
    v_constraint RECORD;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'public.favorites'::regclass
          AND c.contype = 'f'
          AND array_length(c.conkey, 1) = 1
          AND a.attname = 'user_id'
          AND c.confrelid = 'public.users'::regclass
          AND c.confdeltype = 'c'
    ) THEN
        FOR v_constraint IN
            SELECT DISTINCT c.conname
            FROM pg_constraint c
            JOIN pg_attribute a
              ON a.attrelid = c.conrelid
             AND a.attnum = ANY (c.conkey)
            WHERE c.conrelid = 'public.favorites'::regclass
              AND c.contype = 'f'
              AND array_length(c.conkey, 1) = 1
              AND a.attname = 'user_id'
        LOOP
            EXECUTE format(
                'ALTER TABLE public.favorites DROP CONSTRAINT %I',
                v_constraint.conname
            );
        END LOOP;

        ALTER TABLE public.favorites
        ADD CONSTRAINT favorites_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

UPDATE public.favorites f
SET user_id = cp.user_id
FROM public.character_profiles cp
WHERE f.user_id IS NULL
  AND f.profile_id = cp.id;

DO $$
DECLARE
    v_unresolved_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_unresolved_count
    FROM public.favorites
    WHERE user_id IS NULL;

    IF v_unresolved_count > 0 THEN
        RAISE EXCEPTION
            'Migration aborted: % favorite row(s) have NULL user_id and could not be backfilled from character_profiles. Inspect them manually before proceeding.',
            v_unresolved_count;
    END IF;
END $$;

ALTER TABLE public.favorites ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.favorites ALTER COLUMN profile_id DROP NOT NULL;

-- Remove every legacy UNIQUE constraint whose key is exactly
-- (profile_id, listing_id), regardless of its historical name.
DO $$
DECLARE
    v_constraint RECORD;
BEGIN
    FOR v_constraint IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'public.favorites'::regclass
          AND c.contype = 'u'
          AND ARRAY(
              SELECT a.attname
              FROM unnest(c.conkey) WITH ORDINALITY AS key(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = c.conrelid
               AND a.attnum = key.attnum
              ORDER BY key.ord
          ) = ARRAY['profile_id', 'listing_id']::name[]
    LOOP
        EXECUTE format('ALTER TABLE public.favorites DROP CONSTRAINT %I', v_constraint.conname);
    END LOOP;
END $$;

-- Remove separately-created legacy UNIQUE indexes with the same key. Ordinary
-- compatibility/read indexes are intentionally left intact.
DO $$
DECLARE
    v_index RECORD;
BEGIN
    FOR v_index IN
        SELECT index_class.relname AS index_name
        FROM pg_index i
        JOIN pg_class table_class ON table_class.oid = i.indrelid
        JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
        JOIN pg_class index_class ON index_class.oid = i.indexrelid
        WHERE table_namespace.nspname = 'public'
          AND table_class.relname = 'favorites'
          AND i.indisunique
          AND i.indnkeyatts = 2
          AND ARRAY(
              SELECT a.attname
              FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS key(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = i.indrelid
               AND a.attnum = key.attnum
              WHERE key.ord <= i.indnkeyatts
              ORDER BY key.ord
          ) = ARRAY['profile_id', 'listing_id']::name[]
    LOOP
        EXECUTE format('DROP INDEX public.%I', v_index.index_name);
    END LOOP;
END $$;

-- Only perform destructive cleanup when duplicates actually exist. Keep the
-- newest row by created_at, then use UUID id as a deterministic tie-breaker.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.favorites
        GROUP BY user_id, listing_id
        HAVING COUNT(*) > 1
    ) THEN
        WITH ranked_favorites AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY user_id, listing_id
                       ORDER BY created_at DESC, id DESC
                   ) AS rn
            FROM public.favorites
        )
        DELETE FROM public.favorites f
        USING ranked_favorites ranked
        WHERE f.id = ranked.id
          AND ranked.rn > 1;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conrelid = 'public.favorites'::regclass
          AND c.contype = 'u'
          AND ARRAY(
              SELECT a.attname
              FROM unnest(c.conkey) WITH ORDINALITY AS key(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = c.conrelid
               AND a.attnum = key.attnum
              ORDER BY key.ord
          ) = ARRAY['user_id', 'listing_id']::name[]
    ) THEN
        ALTER TABLE public.favorites
        ADD CONSTRAINT favorites_user_id_listing_id_key UNIQUE (user_id, listing_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing_id ON public.favorites(listing_id);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorites;
CREATE POLICY "Users can view own favorites" ON public.favorites
    FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own favorites" ON public.favorites;
CREATE POLICY "Users can insert own favorites" ON public.favorites
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own favorites" ON public.favorites;
CREATE POLICY "Users can delete own favorites" ON public.favorites
    FOR DELETE USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- 4. HARDENED ATOMIC / TRANSACTIONAL LISTING PRICE UPDATE (RPC)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_listing_price(
    p_listing_id UUID,
    p_new_price BIGINT,
    p_editor_user_id UUID DEFAULT NULL,
    p_editor_profile_id UUID DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing public.listings%ROWTYPE;
    v_seller_user_id UUID;
    v_old_price BIGINT;
    v_applied_price BIGINT;
    v_is_admin BOOLEAN := FALSE;
    v_fav_record RECORD;
    v_notifications_sent INTEGER := 0;
BEGIN
    SELECT * INTO v_existing
    FROM public.listings
    WHERE id = p_listing_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'İlan bulunamadı.');
    END IF;

    IF v_existing.status IN ('SOLD', 'REMOVED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Satılmış veya yayından kaldırılmış ilanlar düzenlenemez.');
    END IF;

    -- NULL means no price change. Non-positive prices fail before any write.
    IF p_new_price IS NOT NULL AND p_new_price <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'İlan fiyatı sıfırdan büyük olmalıdır.');
    END IF;

    SELECT cp.user_id INTO v_seller_user_id
    FROM public.character_profiles cp
    WHERE cp.id = v_existing.seller_profile_id;

    SELECT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = p_editor_user_id
          AND u.role = 'ADMIN'
          AND u.status = 'ACTIVE'
    ) INTO v_is_admin;

    IF NOT v_is_admin
       AND NOT (
           (p_editor_profile_id IS NOT NULL AND p_editor_profile_id = v_existing.seller_profile_id)
           OR
           (p_editor_user_id IS NOT NULL AND v_seller_user_id IS NOT NULL AND p_editor_user_id = v_seller_user_id)
       ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bu ilanı düzenleme yetkiniz yok.', 'status', 403);
    END IF;

    v_old_price := v_existing.price;
    v_applied_price := COALESCE(p_new_price, v_old_price);

    UPDATE public.listings
    SET price = v_applied_price,
        title = COALESCE(p_title, title),
        description = COALESCE(p_description, description),
        location = CASE WHEN category = 'vehicle' THEN NULL ELSE location END,
        updated_at = NOW()
    WHERE id = p_listing_id;

    IF p_new_price IS NOT NULL
       AND p_new_price > 0
       AND p_new_price <> v_old_price THEN
        INSERT INTO public.listing_price_history (listing_id, old_price, new_price, changed_at)
        VALUES (p_listing_id, v_old_price, p_new_price, NOW());

        IF p_new_price < v_old_price THEN
            FOR v_fav_record IN
                SELECT DISTINCT f.user_id
                FROM public.favorites f
                WHERE f.listing_id = p_listing_id
                  AND f.user_id IS NOT NULL
                  AND (v_seller_user_id IS NULL OR f.user_id <> v_seller_user_id)
            LOOP
                INSERT INTO public.notifications (
                    user_id, type, title, message, entity_type, entity_id, metadata, created_at
                ) VALUES (
                    v_fav_record.user_id,
                    'LISTING_PRICE_DROP',
                    'Favori İlanınızın Fiyatı Düştü',
                    v_existing.title || ' ilanının fiyatı $'
                        || to_char(v_old_price, 'FM999,999,999') || ' → $'
                        || to_char(p_new_price, 'FM999,999,999') || ' olarak güncellendi.',
                    'listing',
                    p_listing_id,
                    jsonb_build_object('listingId', p_listing_id, 'oldPrice', v_old_price, 'newPrice', p_new_price),
                    NOW()
                );
                v_notifications_sent := v_notifications_sent + 1;
            END LOOP;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'listing_id', p_listing_id,
        'old_price', v_old_price,
        'new_price', v_applied_price,
        'notifications_sent', v_notifications_sent
    );
END;
$$;

-- ============================================================================
-- 5. FUNCTION PERMISSIONS LOCKDOWN
-- ============================================================================

REVOKE ALL ON FUNCTION public.update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) TO service_role;