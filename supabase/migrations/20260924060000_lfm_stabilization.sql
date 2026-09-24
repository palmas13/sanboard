-- ==============================================================================
-- Migration: 20260924060000_lfm_stabilization.sql
-- Description:
-- 1. Relax character_profiles phone and sanmail_email NOT NULL constraints (optional IC contact data).
-- 2. Add seller_type ('INDIVIDUAL' | 'CORPORATE') to listings with backfill and validation.
-- 3. Add new vehicle fields to vehicle_details (lock, alarm, anti-theft, engine health, suspension, fuel type, factory price).
-- 4. Update update_listing_price RPC to notify on any price change (not only price drop) and handle bidirectional notices.
-- 5. Add notifications and seller_type performance indexes.
-- ==============================================================================

-- 1. CHARACTER PROFILES CONTACT FIELDS (OPTIONAL & NO FAKE DEFAULTS)
ALTER TABLE public.character_profiles ALTER COLUMN sanmail_email DROP NOT NULL;
ALTER TABLE public.character_profiles ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.character_profiles ALTER COLUMN sanmail_email SET DEFAULT NULL;
ALTER TABLE public.character_profiles ALTER COLUMN phone SET DEFAULT NULL;

-- 2. SELLER TYPE COLUMN ON LISTINGS (INDIVIDUAL VS CORPORATE SEPARATION)
-- seller_type yoksa önce DEFAULT vermeden ekle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'listings'
          AND column_name = 'seller_type'
    ) THEN
        ALTER TABLE public.listings
        ADD COLUMN seller_type TEXT
        CHECK (seller_type IN ('INDIVIDUAL', 'CORPORATE'));
    END IF;
END $$;

-- Mevcut ilanları gerçek durumlarına göre doldur
UPDATE public.listings
SET seller_type = CASE
    WHEN corporate_profile_id IS NOT NULL THEN 'CORPORATE'
    ELSE 'INDIVIDUAL'
END
WHERE seller_type IS NULL;

-- Bundan SONRA yeni ilanlar için default koy
ALTER TABLE public.listings
ALTER COLUMN seller_type SET DEFAULT 'INDIVIDUAL';

ALTER TABLE public.listings
ALTER COLUMN seller_type SET NOT NULL;

-- 3. VEHICLE DETAILS: NEW SPECIFICATION FIELDS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'vehicle_details' AND column_name = 'lock_level'
    ) THEN
        ALTER TABLE public.vehicle_details ADD COLUMN lock_level INTEGER CHECK (lock_level >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'vehicle_details' AND column_name = 'alarm_level'
    ) THEN
        ALTER TABLE public.vehicle_details ADD COLUMN alarm_level INTEGER CHECK (alarm_level >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'vehicle_details' AND column_name = 'anti_theft_level'
    ) THEN
        ALTER TABLE public.vehicle_details ADD COLUMN anti_theft_level INTEGER CHECK (anti_theft_level >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'vehicle_details' AND column_name = 'engine_health'
    ) THEN
        ALTER TABLE public.vehicle_details ADD COLUMN engine_health INTEGER CHECK (engine_health BETWEEN 0 AND 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'vehicle_details' AND column_name = 'suspension'
    ) THEN
        ALTER TABLE public.vehicle_details ADD COLUMN suspension TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'vehicle_details' AND column_name = 'fuel_type'
    ) THEN
        ALTER TABLE public.vehicle_details ADD COLUMN fuel_type TEXT CHECK (fuel_type IN ('BENZIN', 'DIZEL', 'ELEKTRIK'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'vehicle_details' AND column_name = 'factory_price'
    ) THEN
        ALTER TABLE public.vehicle_details ADD COLUMN factory_price BIGINT CHECK (factory_price >= 0);
    END IF;
END $$;

-- 4. HARDENED ATOMIC PRICE UPDATE FUNCTION (NOTIFIES ON ALL PRICE CHANGES)
CREATE OR REPLACE FUNCTION update_listing_price(
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
SET search_path = public
AS $$
DECLARE
    v_existing RECORD;
    v_old_price BIGINT;
    v_seller_user_id UUID;
    v_editor_role TEXT;
    v_is_admin BOOLEAN := FALSE;
    v_notifications_sent INTEGER := 0;
    v_fav_record RECORD;
BEGIN
    -- 1. Fetch and lock existing listing
    SELECT * INTO v_existing 
    FROM listings 
    WHERE id = p_listing_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'İlan bulunamadı.');
    END IF;

    IF v_existing.status IN ('SOLD', 'REMOVED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Satılmış veya yayından kaldırılmış ilanlar düzenlenemez.');
    END IF;

    -- 2. Resolve seller account user_id from character profile
    SELECT user_id INTO v_seller_user_id FROM character_profiles WHERE id = v_existing.seller_profile_id;

    -- 3. Resolve editor role strictly from database
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

        -- Send notification to all favorited users except seller
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
                CASE WHEN p_new_price < v_old_price THEN 'LISTING_PRICE_DROP' ELSE 'LISTING_PRICE_CHANGE' END,
                CASE WHEN p_new_price < v_old_price THEN 'Favori İlanınızın Fiyatı Düştü' ELSE 'Favori İlanınızın Fiyatı Değişti' END,
                v_existing.title || ' ilanının fiyatı $' || to_char(v_old_price, 'FM999,999,999') || ' → $' || to_char(p_new_price, 'FM999,999,999') || ' olarak güncellendi.',
                'listing',
                p_listing_id,
                jsonb_build_object('listingId', p_listing_id, 'oldPrice', v_old_price, 'newPrice', p_new_price),
                NOW()
            );
            v_notifications_sent := v_notifications_sent + 1;
        END LOOP;
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

-- Explicitly revoke public and browser-accessible execution
REVOKE ALL ON FUNCTION update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) FROM authenticated;

-- Grant execution ONLY to trusted service_role
GRANT EXECUTE ON FUNCTION update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) TO service_role;

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_listings_seller_type ON public.listings (seller_type, seller_profile_id);
