BEGIN;

DROP FUNCTION IF EXISTS public.consume_corporate_boost(UUID, UUID);

CREATE OR REPLACE FUNCTION public.consume_corporate_boost(
  p_actor_profile_id UUID,
  p_listing_id UUID,
  p_payment_mode TEXT DEFAULT 'REQUIRE_CREDIT'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store public.corporate_profiles%ROWTYPE;
  v_listing public.listings%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_featured_until TIMESTAMPTZ;
  v_test_bypass BOOLEAN := p_payment_mode = 'TEST_BYPASS';
BEGIN
  IF p_payment_mode NOT IN ('REQUIRE_CREDIT', 'TEST_BYPASS') THEN
    RETURN jsonb_build_object('success', false, 'code', 'LISTING_NOT_ELIGIBLE', 'error', 'Geçersiz ödeme modu.');
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'code', 'LISTING_NOT_ELIGIBLE', 'error', 'İlan bulunamadı.'); END IF;
  IF v_listing.status <> 'ACTIVE' THEN
    RETURN jsonb_build_object('success', false, 'code', 'LISTING_NOT_ELIGIBLE', 'error', 'Yalnızca aktif ilanlar öne çıkarılabilir.');
  END IF;
  IF v_listing.is_featured AND v_listing.featured_until > v_now THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_BOOSTED', 'error', 'İlan zaten aktif olarak öne çıkarılmış.');
  END IF;

  IF v_test_bypass AND v_listing.seller_type = 'INDIVIDUAL' THEN
    IF v_listing.seller_profile_id <> p_actor_profile_id THEN
      RETURN jsonb_build_object('success', false, 'code', 'LISTING_NOT_OWNED', 'error', 'İlan aktif karaktere ait değil.');
    END IF;
    v_featured_until := v_now + INTERVAL '24 hours';
    UPDATE public.listings SET is_featured = TRUE, featured_until = v_featured_until, updated_at = v_now WHERE id = v_listing.id;
    RETURN jsonb_build_object('success', true, 'remaining_boosts', 0, 'featured_until', v_featured_until);
  END IF;

  SELECT * INTO v_store FROM public.corporate_profiles
    WHERE owner_profile_id = p_actor_profile_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'code', 'LISTING_NOT_OWNED', 'error', 'Aktif karaktere ait kurumsal mağaza bulunamadı.'); END IF;
  IF v_listing.seller_type <> 'CORPORATE' OR v_listing.corporate_profile_id <> v_store.id THEN
    RETURN jsonb_build_object('success', false, 'code', 'LISTING_NOT_OWNED', 'error', 'İlan aktif karakterin kurumsal mağazasına ait değil.');
  END IF;
  IF v_store.status <> 'APPROVED' OR v_store.moderation_status <> 'ACTIVE' THEN
    RETURN jsonb_build_object('success', false, 'code', 'LISTING_NOT_ELIGIBLE', 'error', 'Kurumsal mağaza öne çıkarma için uygun değil.');
  END IF;
  IF v_store.subscription_status <> 'ACTIVE' THEN
    RETURN jsonb_build_object('success', false, 'code', 'SUBSCRIPTION_INACTIVE', 'error', 'Kurumsal üyelik aktif değil.');
  END IF;
  IF v_store.subscription_expires_at IS NULL OR v_store.subscription_expires_at <= v_now THEN
    RETURN jsonb_build_object('success', false, 'code', 'SUBSCRIPTION_EXPIRED', 'error', 'Kurumsal üyeliğin süresi dolmuş.');
  END IF;
  IF v_store.current_period_start IS NULL AND v_store.current_period_end IS NULL THEN
    UPDATE public.corporate_profiles SET current_period_start = v_now,
      current_period_end = LEAST(v_now + INTERVAL '30 days', subscription_expires_at), updated_at = v_now
    WHERE id = v_store.id RETURNING * INTO v_store;
  ELSIF v_store.current_period_start IS NULL OR v_store.current_period_end IS NULL
     OR v_store.current_period_start >= v_store.current_period_end THEN
    RETURN jsonb_build_object('success', false, 'code', 'LISTING_NOT_ELIGIBLE', 'error', 'Kurumsal üyelik dönemi tutarsızdır.');
  ELSIF v_store.current_period_end <= v_now THEN
    UPDATE public.corporate_profiles SET current_period_start = v_now,
      current_period_end = LEAST(v_now + INTERVAL '30 days', subscription_expires_at), boost_credits = 3, updated_at = v_now
    WHERE id = v_store.id RETURNING * INTO v_store;
  END IF;
  IF NOT v_test_bypass AND (v_store.boost_credits IS NULL OR v_store.boost_credits <= 0) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_BOOST_CREDITS', 'error', 'Bu abonelik dönemi için öne çıkarma hakkı tükenmiş.');
  END IF;

  v_featured_until := v_now + INTERVAL '24 hours';
  IF NOT v_test_bypass THEN
    UPDATE public.corporate_profiles SET boost_credits = boost_credits - 1, updated_at = v_now WHERE id = v_store.id;
  END IF;
  UPDATE public.listings SET is_featured = TRUE, featured_until = v_featured_until, updated_at = v_now WHERE id = v_listing.id;
  RETURN jsonb_build_object(
    'success', true,
    'remaining_boosts', CASE WHEN v_test_bypass THEN COALESCE(v_store.boost_credits, 0) ELSE v_store.boost_credits - 1 END,
    'featured_until', v_featured_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_corporate_boost(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_corporate_boost(UUID, UUID, TEXT) TO service_role;

COMMIT;