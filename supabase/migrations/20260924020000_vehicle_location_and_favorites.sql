-- Migration: 20260924020000_vehicle_location_and_favorites.sql
-- Description: Allow NULL location for vehicles, upgrade price columns to BIGINT, convert favorites to account-based model with non-destructive backfill, and introduce locked-down atomic price update transaction.

-- ============================================================================
-- 1. VEHICLE LOCATION RELAXATION & NORMALIZATION
-- ============================================================================

-- Drop NOT NULL on location so vehicle listings do not require location
ALTER TABLE listings ALTER COLUMN location DROP NOT NULL;

-- Normalize existing vehicle listings with empty strings or spaces to NULL
UPDATE listings 
SET location = NULL 
WHERE category = 'vehicle' AND (location IS NULL OR location = '' OR trim(location) = '');


-- ============================================================================
-- 2. PRICE TYPE UPGRADE (BIGINT COMPATIBILITY)
-- ============================================================================

-- Ensure prices support full range without integer overflow
ALTER TABLE listings ALTER COLUMN price TYPE BIGINT;
ALTER TABLE listing_price_history ALTER COLUMN old_price TYPE BIGINT;
ALTER TABLE listing_price_history ALTER COLUMN new_price TYPE BIGINT;


-- ============================================================================
-- 3. FAVORITES: ACCOUNT-BASED (user_id) MODEL & SAFE DATA BACKFILL
-- ============================================================================

-- A) Ensure user_id column exists on favorites table referencing users(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'favorites' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE favorites ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- B) Backfill user_id from character_profiles for any legacy favorites where user_id is NULL
UPDATE favorites f
SET user_id = cp.user_id
FROM character_profiles cp
WHERE f.user_id IS NULL AND f.profile_id = cp.id;

-- C) Safe Verification: Abort migration if any unlinked favorites remain (NO SILENT DATA LOSS)
DO $$
DECLARE
    v_unresolved_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_unresolved_count 
    FROM favorites 
    WHERE user_id IS NULL;

    IF v_unresolved_count > 0 THEN
        RAISE EXCEPTION 'Migration aborted: % favorite row(s) have NULL user_id and could not be backfilled from character_profiles. Please inspect them manually before proceeding.', v_unresolved_count;
    END IF;
END $$;

-- D) Set user_id as NOT NULL now that all rows are verified and backfilled
ALTER TABLE favorites ALTER COLUMN user_id SET NOT NULL;

-- E) Make profile_id NULLABLE (retained for backward compatibility, not source of truth)
ALTER TABLE favorites ALTER COLUMN profile_id DROP NOT NULL;

-- F) Drop legacy unique constraints on (profile_id, listing_id)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'favorites'::regclass
          AND contype = 'u'
          AND conname LIKE '%profile_id%'
    ) LOOP
        EXECUTE 'ALTER TABLE favorites DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- Drop legacy unique index if created separately
DROP INDEX IF EXISTS idx_favorites_profile_listing;

-- G) Remove duplicate (user_id, listing_id) pairs before applying unique constraint (keep newest)
DELETE FROM favorites a USING favorites b
WHERE a.id < b.id 
  AND a.user_id = b.user_id 
  AND a.listing_id = b.listing_id;

-- H) Enforce UNIQUE(user_id, listing_id) constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'favorites'::regclass
          AND contype = 'u'
          AND conname = 'favorites_user_id_listing_id_key'
    ) THEN
        ALTER TABLE favorites ADD CONSTRAINT favorites_user_id_listing_id_key UNIQUE(user_id, listing_id);
    END IF;
END $$;

-- Fast index lookups for user favorites and listing favorites
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing_id ON favorites(listing_id);


-- ============================================================================
-- 4. HARDENED ATOMIC / TRANSACTIONAL LISTING PRICE UPDATE (RPC)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_listing_price(
    p_listing_id UUID,
    p_new_price BIGINT,
    p_editor_user_id UUID,
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
    v_existing listings%ROWTYPE;
    v_seller_user_id UUID;
    v_old_price BIGINT;
    v_editor_role TEXT;
    v_is_admin BOOLEAN := FALSE;
    v_fav_record RECORD;
    v_notifications_sent INTEGER := 0;
BEGIN
    -- 1. Row-level lock to prevent race conditions & concurrent updates
    SELECT * INTO v_existing FROM listings WHERE id = p_listing_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'İlan bulunamadı.');
    END IF;

    IF v_existing.status IN ('SOLD', 'REMOVED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Satılmış veya yayından kaldırılmış ilanlar düzenlenemez.');
    END IF;

    -- 2. Resolve seller account user_id from character profile
    SELECT user_id INTO v_seller_user_id FROM character_profiles WHERE id = v_existing.seller_profile_id;

    -- 3. Resolve editor role strictly from database (CLIENT CANNOT SPOOF ADMIN)
    SELECT role INTO v_editor_role FROM users WHERE id = p_editor_user_id;
    v_is_admin := (v_editor_role = 'ADMIN');

    -- 4. Server-side ownership / admin authorization verification
    IF NOT v_is_admin THEN
        IF (p_editor_profile_id IS NULL OR v_existing.seller_profile_id != p_editor_profile_id)
           AND (p_editor_user_id IS NULL OR v_seller_user_id != p_editor_user_id) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Bu ilanı düzenleme yetkiniz yok.', 'status', 403);
        END IF;
    END IF;

    v_old_price := v_existing.price;

    -- 5. Update listings table (ensure vehicles always have NULL location)
    UPDATE listings
    SET 
        price = CASE WHEN p_new_price IS NOT NULL AND p_new_price > 0 THEN p_new_price ELSE price END,
        title = COALESCE(p_title, title),
        description = COALESCE(p_description, description),
        location = CASE WHEN category = 'vehicle' THEN NULL ELSE location END,
        updated_at = NOW()
    WHERE id = p_listing_id;

    -- 6. Atomic Price Change Logic
    IF p_new_price IS NOT NULL AND p_new_price <> v_old_price THEN
        -- Record price change history
        INSERT INTO listing_price_history (listing_id, old_price, new_price, changed_at)
        VALUES (p_listing_id, v_old_price, p_new_price, NOW());

        -- Price drop: Send notification to all favorited users except seller
        IF p_new_price < v_old_price THEN
            FOR v_fav_record IN 
                SELECT DISTINCT user_id 
                FROM favorites 
                WHERE listing_id = p_listing_id 
                  AND user_id IS NOT NULL 
                  AND (v_seller_user_id IS NULL OR user_id <> v_seller_user_id)
            LOOP
                INSERT INTO notifications (
                    user_id,
                    type,
                    title,
                    message,
                    entity_type,
                    entity_id,
                    metadata,
                    created_at
                ) VALUES (
                    v_fav_record.user_id,
                    'LISTING_PRICE_DROP',
                    'Favori İlanınızın Fiyatı Düştü',
                    v_existing.title || ' ilanının fiyatı $' || to_char(v_old_price, 'FM999,999,999') || ' → $' || to_char(p_new_price, 'FM999,999,999') || ' olarak güncellendi.',
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
        'new_price', COALESCE(p_new_price, v_old_price),
        'notifications_sent', v_notifications_sent
    );
END;
$$;

-- ============================================================================
-- 5. FUNCTION PERMISSIONS LOCKDOWN
-- ============================================================================

-- Explicitly revoke public and browser-accessible execution
REVOKE ALL ON FUNCTION update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) FROM authenticated;

-- Grant execution ONLY to trusted service_role (used by server-side backend secret key)
GRANT EXECUTE ON FUNCTION update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) TO service_role;
