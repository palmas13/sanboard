-- Materialize listing/subscription expiry without changing the existing
-- timestamp-based fail-closed visibility and eligibility rules.
BEGIN;

CREATE INDEX IF NOT EXISTS idx_listings_expiry_lifecycle
  ON public.listings (expires_at)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_corporate_profiles_subscription_expiry_lifecycle
  ON public.corporate_profiles (subscription_expires_at)
  WHERE subscription_status = 'ACTIVE';

CREATE OR REPLACE FUNCTION public.run_expiry_lifecycle()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_listing RECORD;
  v_expired_listings BIGINT := 0;
  v_expired_subscriptions BIGINT := 0;
  v_closed_offers BIGINT := 0;
  v_count BIGINT := 0;
BEGIN
  -- Row locks make concurrent scheduler invocations converge. Only ACTIVE rows
  -- are transitioned, so SOLD/REMOVED/DRAFT state is never overwritten.
  FOR v_listing IN
    SELECT id
    FROM public.listings
    WHERE status = 'ACTIVE'
      AND expires_at IS NOT NULL
      AND expires_at <= v_now
    ORDER BY expires_at, id
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.listings
    SET status = 'EXPIRED',
        is_featured = FALSE,
        featured_until = NULL,
        updated_at = v_now
    WHERE id = v_listing.id
      AND status = 'ACTIVE'
      AND expires_at <= v_now;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 1 THEN
      v_expired_listings := v_expired_listings + 1;
      -- Canonical offer closure creates the existing audit event and is itself
      -- safe when there are no active offers.
      SELECT public.close_offers_for_listing(v_listing.id, 'LISTING_EXPIRED')
      INTO v_count;
      v_closed_offers := v_closed_offers + COALESCE(v_count, 0);
    END IF;
  END LOOP;

  WITH expired AS (
    UPDATE public.corporate_profiles
    SET subscription_status = 'EXPIRED',
        boost_credits = 0,
        current_period_end = LEAST(COALESCE(current_period_end, subscription_expires_at), subscription_expires_at),
        updated_at = v_now
    WHERE subscription_status = 'ACTIVE'
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at <= v_now
    RETURNING id
  )
  SELECT COUNT(*) INTO v_expired_subscriptions FROM expired;

  RETURN jsonb_build_object(
    'success', TRUE,
    'expired_listings', v_expired_listings,
    'expired_subscriptions', v_expired_subscriptions,
    'closed_offers', v_closed_offers
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_expiry_lifecycle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_expiry_lifecycle() TO service_role;

COMMIT;