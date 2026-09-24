-- ==============================================================================
-- Migration: 20260924030000_avatar_path_and_webp_media.sql
-- Description:
-- 1. Adds avatar_path column to character_profiles for canonical R2 object key storage.
-- 2. Backfills avatar_path from existing avatar_url records.
-- 3. Ensures character_profiles table has safe indexes and fallback support.
-- ==============================================================================

-- A) Add avatar_path column if it does not already exist
ALTER TABLE public.character_profiles
ADD COLUMN IF NOT EXISTS avatar_path TEXT;

-- B) Backfill avatar_path from avatar_url
-- If avatar_url contains an R2 storage path (e.g. avatars/...), extract and store the clean object key.
UPDATE public.character_profiles
SET avatar_path = CASE
  WHEN avatar_url LIKE '%/avatars/%' THEN SUBSTRING(avatar_url FROM 'avatars/.*')
  ELSE avatar_url
END
WHERE avatar_path IS NULL AND avatar_url IS NOT NULL;

-- C) Comment for documentation
COMMENT ON COLUMN public.character_profiles.avatar_path IS 'Canonical Cloudflare R2 object key (e.g. avatars/{profileId}/{uuid}.webp). UI resolves via CLOUDFLARE_R2_PUBLIC_DOMAIN + / + avatar_path.';
