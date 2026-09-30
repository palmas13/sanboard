-- Character-scoped, non-destructive listing history visibility cutoffs.
ALTER TABLE public.character_profiles
  ADD COLUMN IF NOT EXISTS expired_listing_history_cleared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sold_listing_history_cleared_at TIMESTAMPTZ;

COMMENT ON COLUMN public.character_profiles.expired_listing_history_cleared_at IS
  'User-visible expired listing history cutoff; listing and audit records remain intact.';
COMMENT ON COLUMN public.character_profiles.sold_listing_history_cleared_at IS
  'User-visible sold listing history cutoff; listing and audit records remain intact.';