-- SANBOARD PAYMENT / BOOST INTEGRITY PACKAGE 1
-- Prepared on 2026-09-26. Do not apply automatically.

BEGIN;

ALTER TABLE public.corporate_profiles
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Historical period boundaries cannot be reconstructed safely. Give every
-- legacy active subscription one technical period at the transaction-stable
-- deployment timestamp, cap it at paid expiry, and preserve its credits.
UPDATE public.corporate_profiles
SET current_period_start = NOW(),
    current_period_end = LEAST(NOW() + INTERVAL '30 days', subscription_expires_at),
    updated_at = NOW()
WHERE subscription_status = 'ACTIVE'
  AND subscription_expires_at > NOW()
  AND current_period_start IS NULL
  AND current_period_end IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.corporate_profiles'::regclass
      AND conname = 'chk_corporate_profiles_boost_credits_nonnegative'
  ) THEN
    ALTER TABLE public.corporate_profiles
      ADD CONSTRAINT chk_corporate_profiles_boost_credits_nonnegative
      CHECK (boost_credits >= 0) NOT VALID;
  END IF;
END $$;

-- Fail deployment rather than leave a half-enforced constraint if preflight
-- did not resolve legacy negative values. NULL policy remains unchanged.
ALTER TABLE public.corporate_profiles
  VALIDATE CONSTRAINT chk_corporate_profiles_boost_credits_nonnegative;

CREATE OR REPLACE FUNCTION public.complete_sanboard_payment(
  p_order_id TEXT,
  p_external_payment_id TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_package public.packages%ROWTYPE;
  v_credit public.listing_credits%ROWTYPE;
  v_store public.corporate_profiles%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_old_expiry TIMESTAMPTZ;
  v_new_expiry TIMESTAMPTZ;
  v_new_period BOOLEAN;
  v_legacy_period BOOLEAN;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Ödeme kaydı bulunamadı.'); END IF;

  IF v_payment.status = 'SUCCESS' AND v_payment.entitlement_applied_at IS NOT NULL THEN
    IF p_external_payment_id IS NOT NULL AND v_payment.external_payment_id IS NOT NULL
       AND p_external_payment_id <> v_payment.external_payment_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ödeme farklı bir sağlayıcı işlem kimliğiyle zaten tamamlanmış.');
    END IF;
    SELECT * INTO v_credit FROM public.listing_credits WHERE payment_id = v_payment.id;
    RETURN jsonb_build_object('success', true, 'credit', to_jsonb(v_credit));
  END IF;

  IF p_external_payment_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.payments WHERE external_payment_id = p_external_payment_id AND id <> v_payment.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu sağlayıcı işlemi başka bir ödeme için kullanılmış.');
  END IF;

  SELECT * INTO v_package FROM public.packages WHERE id = v_payment.package_id;
  IF NOT FOUND OR NOT v_package.active OR v_payment.amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ödeme paketi veya tutarı doğrulanamadı.');
  END IF;

  IF v_payment.entitlement_type = 'CORPORATE_SUBSCRIPTION'
     AND v_package.code = 'CORPORATE_SUBSCRIPTION_30_DAY'
     AND v_package.seller_type = 'CORPORATE' AND v_package.duration_days = 30 THEN
    SELECT * INTO v_store FROM public.corporate_profiles
      WHERE id = v_payment.corporate_profile_id
        AND owner_profile_id = v_payment.profile_id
        AND status = 'APPROVED' AND moderation_status <> 'DELETED'
      FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Kurumsal mağaza üyelik için uygun değil.'); END IF;

    v_old_expiry := v_store.subscription_expires_at;
    v_new_expiry := GREATEST(v_now, COALESCE(v_old_expiry, v_now)) + INTERVAL '30 days';
    v_legacy_period := v_store.subscription_status = 'ACTIVE'
      AND v_old_expiry > v_now
      AND v_store.current_period_start IS NULL
      AND v_store.current_period_end IS NULL;
    v_new_period := NOT (v_store.subscription_status = 'ACTIVE' AND v_old_expiry > v_now)
      OR (v_store.current_period_start IS NOT NULL
          AND v_store.current_period_end IS NOT NULL
          AND v_store.current_period_end <= v_now);

    IF (v_store.current_period_start IS NULL) <> (v_store.current_period_end IS NULL)
       OR (v_store.current_period_start IS NOT NULL
           AND v_store.current_period_end IS NOT NULL
           AND v_store.current_period_start >= v_store.current_period_end) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Kurumsal üyelik dönemi tutarsızdır.');
    END IF;

    UPDATE public.corporate_profiles SET
      subscription_status = 'ACTIVE',
      subscription_expires_at = v_new_expiry,
      current_period_start = CASE WHEN v_new_period OR v_legacy_period THEN v_now ELSE current_period_start END,
      current_period_end = CASE
        WHEN v_new_period THEN LEAST(v_now + INTERVAL '30 days', v_new_expiry)
        WHEN v_legacy_period THEN LEAST(v_now + INTERVAL '30 days', v_old_expiry)
        ELSE current_period_end
      END,
      boost_credits = CASE WHEN v_new_period THEN 3 ELSE boost_credits END,
      updated_at = v_now
    WHERE id = v_store.id;
  ELSIF v_payment.entitlement_type = 'LISTING_CREDIT'
    AND ((v_package.code = 'STANDARD_7_DAY' AND v_package.seller_type = 'INDIVIDUAL' AND v_package.duration_days = 7)
      OR (v_package.code = 'CORPORATE_14_DAY' AND v_package.seller_type = 'CORPORATE' AND v_package.duration_days = 14)) THEN
    IF v_package.code = 'CORPORATE_14_DAY' THEN
      SELECT * INTO v_store FROM public.corporate_profiles
        WHERE id = v_payment.corporate_profile_id AND owner_profile_id = v_payment.profile_id
          AND status = 'APPROVED' AND moderation_status = 'ACTIVE'
          AND subscription_status = 'ACTIVE' AND subscription_expires_at > v_now FOR UPDATE;
      IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Kurumsal mağaza ilan kredisi için uygun değil.'); END IF;
    END IF;
    INSERT INTO public.listing_credits (profile_id, payment_id, package_id, credit_type, corporate_profile_id, amount, status)
    VALUES (v_payment.profile_id, v_payment.id, v_payment.package_id,
      CASE WHEN v_package.code = 'CORPORATE_14_DAY' THEN 'CORPORATE' ELSE 'INDIVIDUAL' END,
      CASE WHEN v_package.code = 'CORPORATE_14_DAY' THEN v_payment.corporate_profile_id ELSE NULL END,
      v_payment.amount, 'AVAILABLE')
    ON CONFLICT (payment_id) DO NOTHING RETURNING * INTO v_credit;
    IF v_credit.id IS NULL THEN SELECT * INTO v_credit FROM public.listing_credits WHERE payment_id = v_payment.id; END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Paket ve entitlement türü birbiriyle uyumlu değil.');
  END IF;

  UPDATE public.payments SET status = 'SUCCESS',
    external_payment_id = COALESCE(external_payment_id, p_external_payment_id),
    paid_at = COALESCE(paid_at, v_now), entitlement_applied_at = COALESCE(entitlement_applied_at, v_now)
  WHERE id = v_payment.id;
  RETURN jsonb_build_object('success', true, 'credit', to_jsonb(v_credit));
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_corporate_boost(
  p_actor_profile_id UUID,
  p_listing_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_store public.corporate_profiles%ROWTYPE;
  v_listing public.listings%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_featured_until TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_store FROM public.corporate_profiles
    WHERE owner_profile_id = p_actor_profile_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'code', 'LISTING_NOT_OWNED', 'error', 'Aktif karaktere ait kurumsal mağaza bulunamadı.'); END IF;
  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'code', 'LISTING_NOT_ELIGIBLE', 'error', 'İlan bulunamadı.'); END IF;
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
  IF v_store.boost_credits IS NULL OR v_store.boost_credits <= 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_BOOST_CREDITS', 'error', 'Bu abonelik dönemi için öne çıkarma hakkı tükenmiş.');
  END IF;
  IF v_listing.status <> 'ACTIVE' THEN
    RETURN jsonb_build_object('success', false, 'code', 'LISTING_NOT_ELIGIBLE', 'error', 'Yalnızca aktif ilanlar öne çıkarılabilir.');
  END IF;
  IF v_listing.is_featured AND v_listing.featured_until > v_now THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_BOOSTED', 'error', 'İlan zaten aktif olarak öne çıkarılmış.');
  END IF;
  v_featured_until := v_now + INTERVAL '24 hours';
  UPDATE public.corporate_profiles SET boost_credits = boost_credits - 1, updated_at = v_now WHERE id = v_store.id;
  UPDATE public.listings SET is_featured = TRUE, featured_until = v_featured_until, updated_at = v_now WHERE id = v_listing.id;
  RETURN jsonb_build_object('success', true, 'remaining_boosts', v_store.boost_credits - 1, 'featured_until', v_featured_until);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_sanboard_payment(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_sanboard_payment(TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.consume_corporate_boost(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_corporate_boost(UUID, UUID) TO service_role;

COMMIT;