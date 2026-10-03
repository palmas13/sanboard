-- Canonical pricing and split corporate boost-credit model.
-- Forward-only migration prepared on 2026-10-03. Do not apply automatically.
BEGIN;

UPDATE public.packages SET name = '7 Günlük Bireysel İlan', price = 1500, active = TRUE
WHERE code = 'STANDARD_7_DAY';
UPDATE public.packages SET name = '14 Günlük Kurumsal İlan', price = 1250, active = TRUE
WHERE code = 'CORPORATE_14_DAY';
UPDATE public.packages SET name = 'Aylık Kurumsal Üyelik', price = 5500, active = TRUE
WHERE code = 'CORPORATE_SUBSCRIPTION_30_DAY';
UPDATE public.packages SET name = 'Boost Kredisi', price = 1000, active = TRUE
WHERE code = 'LISTING_BOOST_24_HOUR';

-- Remove the legacy constraint before introducing BOOST_CREDIT into existing rows.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS chk_payments_entitlement_type;

-- Convert historical Boost payments before installing the replacement constraint.
UPDATE public.payments
SET entitlement_type = 'BOOST_CREDIT'
WHERE purpose = 'LISTING_BOOST' OR entitlement_type = 'LISTING_BOOST';

ALTER TABLE public.payments ADD CONSTRAINT chk_payments_entitlement_type
  CHECK (entitlement_type IN ('LISTING_CREDIT', 'BOOST_CREDIT', 'CORPORATE_SUBSCRIPTION'));

ALTER TABLE public.corporate_profiles
  ADD COLUMN IF NOT EXISTS monthly_boost_credits INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchased_boost_credits INTEGER NOT NULL DEFAULT 0;

-- Historical boost_credits cannot be classified reliably from existing records.
-- Preserve the full legacy balance conservatively as permanent purchased credit.
UPDATE public.corporate_profiles
SET monthly_boost_credits = 0,
    purchased_boost_credits = GREATEST(COALESCE(boost_credits, 0), COALESCE(purchased_boost_credits, 0)),
    boost_credits = GREATEST(COALESCE(boost_credits, 0), COALESCE(purchased_boost_credits, 0));

ALTER TABLE public.corporate_profiles
  DROP CONSTRAINT IF EXISTS chk_corporate_monthly_boost_credits_nonnegative;
ALTER TABLE public.corporate_profiles
  ADD CONSTRAINT chk_corporate_monthly_boost_credits_nonnegative CHECK (monthly_boost_credits >= 0);
ALTER TABLE public.corporate_profiles
  DROP CONSTRAINT IF EXISTS chk_corporate_purchased_boost_credits_nonnegative;
ALTER TABLE public.corporate_profiles
  ADD CONSTRAINT chk_corporate_purchased_boost_credits_nonnegative CHECK (purchased_boost_credits >= 0);

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
  IF NOT FOUND OR v_listing.status <> 'ACTIVE' OR v_listing.expires_at IS NULL OR v_listing.expires_at <= v_now THEN
    RETURN jsonb_build_object('success', false, 'code', 'LISTING_NOT_ELIGIBLE', 'error', 'Yalnızca yayın süresi devam eden aktif ilanlar öne çıkarılabilir.');
  END IF;
  IF v_listing.is_featured AND v_listing.featured_until IS NOT NULL AND v_listing.featured_until > v_now THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_BOOSTED', 'error', 'İlan zaten aktif olarak öne çıkarılmış.');
  END IF;
  IF v_test_bypass AND v_listing.seller_type = 'INDIVIDUAL' THEN
    IF v_listing.seller_profile_id <> p_actor_profile_id THEN
      RETURN jsonb_build_object('success', false, 'code', 'LISTING_NOT_OWNED', 'error', 'İlan aktif karaktere ait değil.');
    END IF;
    v_featured_until := v_now + INTERVAL '24 hours';
    UPDATE public.listings SET is_featured = TRUE, featured_until = v_featured_until, updated_at = v_now WHERE id = v_listing.id;
    RETURN jsonb_build_object('success', true, 'remaining_boosts', 0, 'monthly_boost_credits', 0, 'purchased_boost_credits', 0, 'featured_until', v_featured_until);
  END IF;
  SELECT * INTO v_store FROM public.corporate_profiles
  WHERE owner_profile_id = p_actor_profile_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_listing.seller_type <> 'CORPORATE' OR v_listing.corporate_profile_id <> v_store.id THEN
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
  IF NOT v_test_bypass AND v_store.monthly_boost_credits <= 0 AND v_store.purchased_boost_credits <= 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_BOOST_CREDITS', 'error', 'Kullanılabilir Boost Krediniz bulunmuyor.');
  END IF;
  IF NOT v_test_bypass THEN
    IF v_store.monthly_boost_credits > 0 THEN
      UPDATE public.corporate_profiles
      SET monthly_boost_credits = monthly_boost_credits - 1,
          boost_credits = monthly_boost_credits - 1 + purchased_boost_credits,
          updated_at = v_now
      WHERE id = v_store.id RETURNING * INTO v_store;
    ELSE
      UPDATE public.corporate_profiles
      SET purchased_boost_credits = purchased_boost_credits - 1,
          boost_credits = monthly_boost_credits + purchased_boost_credits - 1,
          updated_at = v_now
      WHERE id = v_store.id RETURNING * INTO v_store;
    END IF;
  END IF;
  v_featured_until := v_now + INTERVAL '24 hours';
  UPDATE public.listings SET is_featured = TRUE, featured_until = v_featured_until, updated_at = v_now WHERE id = v_listing.id;
  RETURN jsonb_build_object('success', true, 'remaining_boosts', v_store.boost_credits,
    'monthly_boost_credits', v_store.monthly_boost_credits, 'purchased_boost_credits', v_store.purchased_boost_credits,
    'featured_until', v_featured_until);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_sanboard_boost_payment(p_order_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_package public.packages%ROWTYPE;
  v_store public.corporate_profiles%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Ödeme kaydı bulunamadı.'); END IF;
  IF v_payment.purpose <> 'LISTING_BOOST' OR v_payment.entitlement_type <> 'BOOST_CREDIT' OR v_payment.corporate_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Boost kredisi ödeme hedefi geçersiz.');
  END IF;
  IF v_payment.status = 'SUCCESS' AND v_payment.entitlement_applied_at IS NOT NULL THEN
    SELECT * INTO v_store FROM public.corporate_profiles WHERE id = v_payment.corporate_profile_id;
    RETURN jsonb_build_object('success', true, 'purchased_boost_credits', v_store.purchased_boost_credits);
  END IF;
  IF v_payment.status <> 'PENDING' OR v_payment.external_payment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Boost kredisi ödemesi tamamlanmaya uygun değil.');
  END IF;
  SELECT * INTO v_package FROM public.packages WHERE id = v_payment.package_id;
  IF NOT FOUND OR v_package.code <> 'LISTING_BOOST_24_HOUR' OR NOT v_package.active
     OR v_package.seller_type <> 'CORPORATE' OR v_package.duration_days <> 1 OR v_payment.amount <> v_package.price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Boost kredisi paketi veya tutarı doğrulanamadı.');
  END IF;
  SELECT * INTO v_store FROM public.corporate_profiles WHERE id = v_payment.corporate_profile_id
    AND owner_profile_id = v_payment.profile_id AND status = 'APPROVED' AND moderation_status = 'ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Boost kredisi kurumsal mağazaya tanımlanamadı.'); END IF;
  UPDATE public.corporate_profiles
  SET purchased_boost_credits = purchased_boost_credits + 1,
      boost_credits = monthly_boost_credits + purchased_boost_credits + 1,
      updated_at = v_now
  WHERE id = v_store.id RETURNING * INTO v_store;
  UPDATE public.payments SET status = 'SUCCESS', paid_at = v_now, entitlement_applied_at = v_now, processed_at = v_now
  WHERE id = v_payment.id;
  RETURN jsonb_build_object('success', true, 'purchased_boost_credits', v_store.purchased_boost_credits);
END;
$$;

-- Refresh included credits on every verified paid activation/renewal; permanent credits are untouched.
DO $$ DECLARE v_definition TEXT; v_rewritten TEXT; BEGIN
  SELECT pg_get_functiondef('public.complete_sanboard_payment(text,text)'::regprocedure) INTO v_definition;
  v_rewritten := replace(v_definition,
    'boost_credits = CASE WHEN v_new_period THEN 3 ELSE boost_credits END',
    'monthly_boost_credits = 3, boost_credits = 3 + purchased_boost_credits');
  IF v_rewritten = v_definition THEN RAISE EXCEPTION 'complete_sanboard_payment boost refresh definition was not recognized'; END IF;
  EXECUTE v_rewritten;
END $$;

DO $$ DECLARE v_definition TEXT; v_rewritten TEXT; BEGIN
  SELECT pg_get_functiondef('public.grant_corporate_subscription(uuid,uuid)'::regprocedure) INTO v_definition;
  v_rewritten := v_definition;
  v_rewritten := replace(v_definition, 'boost_credits = 3', 'monthly_boost_credits = 3, boost_credits = 3 + purchased_boost_credits');
  IF v_rewritten = v_definition THEN RAISE EXCEPTION 'grant_corporate_subscription boost refresh definition was not recognized'; END IF;
  EXECUTE v_rewritten;
END $$;

DO $$ DECLARE v_definition TEXT; v_rewritten TEXT; BEGIN
  SELECT pg_get_functiondef('public.run_expiry_lifecycle()'::regprocedure) INTO v_definition;
  v_rewritten := v_definition;
  v_rewritten := replace(v_definition, 'boost_credits = 0', 'monthly_boost_credits = 0, boost_credits = purchased_boost_credits');
  IF v_rewritten = v_definition THEN RAISE EXCEPTION 'run_expiry_lifecycle boost expiry definition was not recognized'; END IF;
  EXECUTE v_rewritten;
END $$;

REVOKE ALL ON FUNCTION public.consume_corporate_boost(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_corporate_boost(UUID, UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.complete_sanboard_boost_payment(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_sanboard_boost_payment(TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.complete_sanboard_payment(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_sanboard_payment(TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.grant_corporate_subscription(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_corporate_subscription(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.run_expiry_lifecycle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_expiry_lifecycle() TO service_role;

COMMIT;