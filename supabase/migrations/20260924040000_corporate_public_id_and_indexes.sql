-- ==============================================================================
-- Migration: 20260924040000_corporate_public_id_and_indexes.sql
-- Description:
-- 1. Adds sequential public_id to corporate_profiles (starting at 1).
-- 2. Adds logo_path and banner_path to corporate_profiles for canonical R2 keys.
-- 3. Backfills public_id for all existing stores (Apex Motors = 1, etc.).
-- 4. Creates recommended performance indexes for marketplace and admin queries.
-- ==============================================================================

-- 1. CREATE SEQUENCE FOR CORPORATE PUBLIC ID
CREATE SEQUENCE IF NOT EXISTS corporate_public_id_seq START WITH 1 INCREMENT BY 1;

-- 2. ADD COLUMNS TO CORPORATE PROFILES
ALTER TABLE public.corporate_profiles
ADD COLUMN IF NOT EXISTS public_id BIGINT,
ADD COLUMN IF NOT EXISTS logo_path TEXT,
ADD COLUMN IF NOT EXISTS banner_path TEXT;

-- 3. BACKFILL PUBLIC_ID FOR EXISTING STORES IN ORDER OF CREATION
DO $$
DECLARE
    rec RECORD;
    v_seq_val BIGINT := 1;
BEGIN
    FOR rec IN 
        SELECT id FROM public.corporate_profiles 
        WHERE public_id IS NULL 
        ORDER BY created_at ASC
    LOOP
        UPDATE public.corporate_profiles 
        SET public_id = v_seq_val 
        WHERE id = rec.id;

        v_seq_val := v_seq_val + 1;
    END LOOP;

    -- Advance sequence to next value
    PERFORM setval('corporate_public_id_seq', GREATEST(v_seq_val, 1), true);
END $$;

-- Set default for future stores
ALTER TABLE public.corporate_profiles 
ALTER COLUMN public_id SET DEFAULT nextval('corporate_public_id_seq');

-- Ensure NOT NULL and UNIQUE constraint
ALTER TABLE public.corporate_profiles 
ALTER COLUMN public_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'corporate_profiles_public_id_unique'
    ) THEN
        ALTER TABLE public.corporate_profiles 
        ADD CONSTRAINT corporate_profiles_public_id_unique UNIQUE (public_id);
    END IF;
END $$;

-- 4. BACKFILL LOGO_PATH AND BANNER_PATH FROM EXISTING URLS IF PRESENT
UPDATE public.corporate_profiles
SET logo_path = SUBSTRING(logo_url FROM 'dealers/logos/.*')
WHERE logo_path IS NULL AND logo_url LIKE '%dealers/logos/%';

UPDATE public.corporate_profiles
SET banner_path = SUBSTRING(banner_url FROM 'dealers/banners/.*')
WHERE banner_path IS NULL AND banner_url LIKE '%dealers/banners/%';

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_listings_status_expires ON public.listings (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_listings_category_created ON public.listings (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_corporate_id ON public.listings (corporate_profile_id);

CREATE INDEX IF NOT EXISTS idx_favorites_user_listing ON public.favorites (user_id, listing_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing_id ON public.favorites (listing_id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created ON public.support_tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_created ON public.ticket_messages (ticket_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_payments_status_created ON public.payments (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corporate_apps_status_created ON public.corporate_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corporate_profiles_public_id ON public.corporate_profiles (public_id);
