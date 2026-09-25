-- Sanboard performance indexes
-- Review and apply manually in production. This migration is not auto-executed.

BEGIN;

-- Public category feeds: ACTIVE + non-expired filtering followed by newest sort.
CREATE INDEX IF NOT EXISTS idx_listings_public_category_published
ON public.listings (category, published_at DESC)
WHERE status = 'ACTIVE';

-- Character-scoped dashboard/list management.
CREATE INDEX IF NOT EXISTS idx_listings_profile_status_published
ON public.listings (seller_profile_id, status, published_at DESC)
WHERE seller_type = 'INDIVIDUAL' AND corporate_profile_id IS NULL;

-- Corporate inventory and admin/store counters.
CREATE INDEX IF NOT EXISTS idx_listings_corporate_status_published
ON public.listings (corporate_profile_id, status, published_at DESC)
WHERE corporate_profile_id IS NOT NULL;

-- Canonical corporate state resolver filters.
CREATE INDEX IF NOT EXISTS idx_corporate_profiles_subscription_moderation
ON public.corporate_profiles (subscription_status, moderation_status)
WHERE deleted_at IS NULL;

-- Account support screens order tickets by most recently updated.
CREATE INDEX IF NOT EXISTS idx_support_tickets_profile_updated
ON public.support_tickets (profile_id, updated_at DESC);

COMMIT;