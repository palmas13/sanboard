-- ==============================================================================
-- Migration: 20260924070000_public_ids_and_media_cleanup.sql
-- Description:
-- 1. Adds sequential public_id to character_profiles (starting at 1) with deterministic backfill.
-- 2. Ensures public_id sequence is monotonic and non-recyclable.
-- 3. Sets UNIQUE constraint and then NOT NULL on character_profiles.public_id.
-- 4. Defensively checks and ensures corporate_profiles.public_id is NOT NULL.
-- 5. Creates media_cleanup_jobs table for reliable Cloudflare R2 orphan / delete retries.
-- 6. Enforces strict RLS on media_cleanup_jobs: inaccessible to public/anon/authenticated,
--    restricted exclusively to service_role.
-- 7. Creates performance indexes for public_id routing and cleanup job workers.
-- ==============================================================================

-- 1. CREATE SEQUENCE FOR CHARACTER PROFILES PUBLIC ID
CREATE SEQUENCE IF NOT EXISTS public.character_profiles_public_id_seq START WITH 1 INCREMENT BY 1;

-- 2. ADD PUBLIC_ID COLUMN TO CHARACTER PROFILES
ALTER TABLE public.character_profiles
ADD COLUMN IF NOT EXISTS public_id BIGINT;

-- 3. BACKFILL PUBLIC_ID DETERMINISTICALLY FOR ALL EXISTING PROFILES (ORDER BY created_at ASC, id ASC)
DO $$
DECLARE
    rec RECORD;
    v_seq_val BIGINT;
BEGIN
    -- Start from COALESCE(MAX(public_id), 0) + 1 to avoid collision with existing IDs
    SELECT COALESCE(MAX(public_id), 0) + 1 INTO v_seq_val FROM public.character_profiles;

    FOR rec IN 
        SELECT id FROM public.character_profiles 
        WHERE public_id IS NULL 
        ORDER BY created_at ASC, id ASC
    LOOP
        UPDATE public.character_profiles 
        SET public_id = v_seq_val 
        WHERE id = rec.id;

        v_seq_val := v_seq_val + 1;
    END LOOP;

    -- Advance sequence to next value strictly greater than max assigned
    PERFORM setval(
        'public.character_profiles_public_id_seq', 
        COALESCE((SELECT MAX(public_id) FROM public.character_profiles), 0) + 1, 
        false
    );
END $$;

-- 4. SET DEFAULT FOR ALL FUTURE CHARACTER PROFILE CREATIONS
ALTER TABLE public.character_profiles 
ALTER COLUMN public_id SET DEFAULT nextval('public.character_profiles_public_id_seq');

-- 5. ADD UNIQUE CONSTRAINT FOR CHARACTER PROFILES PUBLIC ID
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'character_profiles_public_id_unique'
    ) THEN
        ALTER TABLE public.character_profiles 
        ADD CONSTRAINT character_profiles_public_id_unique UNIQUE (public_id);
    END IF;
END $$;

-- 6. SET NOT NULL ON CHARACTER PROFILES PUBLIC ID (AFTER BACKFILL & UNIQUE CONSTRAINT)
ALTER TABLE public.character_profiles 
ALTER COLUMN public_id SET NOT NULL;

-- 7. DEFENSIVE CHECK FOR CORPORATE_PROFILES PUBLIC ID NOT NULL
-- (corporate_profiles.public_id was previously backfilled and set to NOT NULL in 20260924040000_corporate_public_id_and_indexes.sql)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'corporate_profiles' 
          AND column_name = 'public_id' 
          AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE public.corporate_profiles 
        ALTER COLUMN public_id SET NOT NULL;
    END IF;
END $$;

-- 8. CREATE MEDIA_CLEANUP_JOBS TABLE FOR ASYNC / RETRYABLE R2 REMOVALS
CREATE TABLE IF NOT EXISTS public.media_cleanup_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_key TEXT NOT NULL,
    media_type TEXT NOT NULL, -- 'AVATAR', 'LISTING_IMAGE', 'VEHICLE_IMAGE', 'PROPERTY_IMAGE', 'CORPORATE_LOGO', 'CORPORATE_BANNER'
    reason TEXT NOT NULL,     -- 'AVATAR_REPLACED', 'AVATAR_UPLOAD_ROLLBACK', 'LISTING_SOLD', 'LISTING_DELETED', etc.
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. STRICT ACCESS CONTROL & ROW LEVEL SECURITY FOR MEDIA_CLEANUP_JOBS
-- Client users (anon or authenticated) must never read, write, or list cleanup jobs.
REVOKE ALL ON TABLE public.media_cleanup_jobs FROM anon, authenticated;
GRANT ALL ON TABLE public.media_cleanup_jobs TO service_role;

ALTER TABLE public.media_cleanup_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage media cleanup jobs" ON public.media_cleanup_jobs;
DROP POLICY IF EXISTS "media_cleanup_service_all" ON public.media_cleanup_jobs;

CREATE POLICY "Service role can manage media cleanup jobs" ON public.media_cleanup_jobs
    FOR ALL
    TO service_role
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 10. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_character_profiles_public_id ON public.character_profiles(public_id);
CREATE INDEX IF NOT EXISTS idx_media_cleanup_status ON public.media_cleanup_jobs(status, next_attempt_at);
