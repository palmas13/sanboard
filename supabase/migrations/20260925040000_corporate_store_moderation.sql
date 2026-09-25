-- ============================================================================
-- Migration: 20260925040000_corporate_store_moderation.sql
-- Description:
--   1. Adds corporate store moderation status (ACTIVE, SUSPENDED, DELETED)
--      and audit metadata (suspended_at, suspended_by, deleted_at, deleted_by, reasons).
--   2. Adds corporate_profile_id foreign key to listing_credits to explicitly tie
--      corporate listing credits to the store that purchased them.
--   3. Replaces unconditional uq_corporate_profiles_owner_profile_id constraint
--      with a partial unique index allowing soft-deleted history while enforcing
--      at most one active/usable store per owner profile.
--   4. Adds supporting indexes for moderation state queries.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CORPORATE PROFILES MODERATION COLUMNS
-- ============================================================================

ALTER TABLE public.corporate_profiles
ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE public.corporate_profiles
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

ALTER TABLE public.corporate_profiles
ADD COLUMN IF NOT EXISTS suspended_by_profile_id UUID
REFERENCES public.character_profiles(id)
ON DELETE SET NULL;

ALTER TABLE public.corporate_profiles
ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

ALTER TABLE public.corporate_profiles
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.corporate_profiles
ADD COLUMN IF NOT EXISTS deleted_by_profile_id UUID
REFERENCES public.character_profiles(id)
ON DELETE SET NULL;

ALTER TABLE public.corporate_profiles
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_corporate_profiles_moderation_status'
          AND conrelid = 'public.corporate_profiles'::regclass
    ) THEN
        ALTER TABLE public.corporate_profiles
        ADD CONSTRAINT chk_corporate_profiles_moderation_status
        CHECK (moderation_status IN ('ACTIVE', 'SUSPENDED', 'DELETED'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_corporate_profiles_moderation_status
ON public.corporate_profiles(moderation_status);


-- ============================================================================
-- 2. PARTIAL UNIQUE CONSTRAINT FOR ACTIVE STORE OWNERSHIP
-- ============================================================================

-- Önce aynı karaktere bağlı birden fazla aktif mağaza var mı kontrol et.
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
          AND deleted_at IS NULL
          AND moderation_status <> 'DELETED'
        GROUP BY owner_profile_id
        HAVING COUNT(*) > 1
    ) x;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION
            'Migration durduruldu: % owner profile üzerinde birden fazla aktif mağaza bulundu.',
            duplicate_count;
    END IF;
END $$;


-- Eski koşulsuz UNIQUE constraint'i kaldır.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_corporate_profiles_owner_profile_id'
          AND conrelid = 'public.corporate_profiles'::regclass
    ) THEN
        ALTER TABLE public.corporate_profiles
        DROP CONSTRAINT uq_corporate_profiles_owner_profile_id;
    END IF;
END $$;


-- Sadece silinmemiş mağazalarda karakter başına 1 mağaza.
CREATE UNIQUE INDEX IF NOT EXISTS uq_corporate_profiles_active_owner
ON public.corporate_profiles(owner_profile_id)
WHERE deleted_at IS NULL
  AND moderation_status <> 'DELETED';


-- ============================================================================
-- 3. LISTING CREDITS CORPORATE PROFILE ID
-- ============================================================================

ALTER TABLE public.listing_credits
ADD COLUMN IF NOT EXISTS corporate_profile_id UUID
REFERENCES public.corporate_profiles(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_listing_credits_corporate_profile_id
ON public.listing_credits(corporate_profile_id);

CREATE INDEX IF NOT EXISTS idx_listing_credits_corporate_lookup
ON public.listing_credits(corporate_profile_id, status)
WHERE corporate_profile_id IS NOT NULL;

COMMIT;