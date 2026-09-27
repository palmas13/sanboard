-- Sanboard dashboard experience refinement
-- Prepared only. Do not apply automatically to production.

ALTER TABLE public.character_profiles
  ADD COLUMN IF NOT EXISTS phone_visibility TEXT NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS sanmail_visibility TEXT NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS payment_history_cleared_at TIMESTAMPTZ;

UPDATE public.character_profiles
SET phone_visibility = 'PUBLIC'
WHERE phone_visibility IS NULL;

UPDATE public.character_profiles
SET sanmail_visibility = 'PUBLIC'
WHERE sanmail_visibility IS NULL;

ALTER TABLE public.character_profiles
  DROP CONSTRAINT IF EXISTS character_profiles_phone_visibility_check,
  ADD CONSTRAINT character_profiles_phone_visibility_check
    CHECK (phone_visibility IN ('PUBLIC', 'PRIVATE')),
  DROP CONSTRAINT IF EXISTS character_profiles_sanmail_visibility_check,
  ADD CONSTRAINT character_profiles_sanmail_visibility_check
    CHECK (sanmail_visibility IN ('PUBLIC', 'PRIVATE'));

ALTER TABLE public.corporate_applications
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT;

COMMENT ON COLUMN public.character_profiles.payment_history_cleared_at IS
  'User-visible history cutoff. Payment/audit/idempotency rows remain intact.';