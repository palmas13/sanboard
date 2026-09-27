-- User listing enrichment: one set-based round-trip for latest price history and favorite counts.
-- Apply manually after review in production.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_listing_enrichment(
  p_seller_profile_id UUID,
  p_listing_ids UUID[]
)
RETURNS TABLE (
  listing_id UUID,
  previous_price BIGINT,
  favorite_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  WITH authorized_listings AS (
    SELECT l.id
    FROM public.listings AS l
    WHERE l.id = ANY(COALESCE(p_listing_ids, ARRAY[]::UUID[]))
      AND l.seller_profile_id = p_seller_profile_id
      AND l.seller_type = 'INDIVIDUAL'
      AND l.corporate_profile_id IS NULL
  ),
  latest_price AS (
    SELECT DISTINCT ON (h.listing_id)
      h.listing_id,
      h.old_price::BIGINT AS previous_price
    FROM public.listing_price_history AS h
    INNER JOIN authorized_listings AS a ON a.id = h.listing_id
    ORDER BY h.listing_id, h.changed_at DESC
  ),
  favorite_counts AS (
    SELECT
      f.listing_id,
      COUNT(*)::BIGINT AS favorite_count
    FROM public.favorites AS f
    INNER JOIN authorized_listings AS a ON a.id = f.listing_id
    GROUP BY f.listing_id
  )
  SELECT
    a.id AS listing_id,
    lp.previous_price,
    COALESCE(fc.favorite_count, 0::BIGINT) AS favorite_count
  FROM authorized_listings AS a
  LEFT JOIN latest_price AS lp ON lp.listing_id = a.id
  LEFT JOIN favorite_counts AS fc ON fc.listing_id = a.id;
$$;

REVOKE ALL ON FUNCTION public.get_user_listing_enrichment(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_listing_enrichment(UUID, UUID[]) TO service_role;

COMMIT;