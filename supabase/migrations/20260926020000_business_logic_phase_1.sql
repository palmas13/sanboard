-- SANBOARD BUSINESS LOGIC PHASE 1
-- This migration is intentionally NOT applied automatically.

BEGIN;

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS corporate_profile_id UUID REFERENCES public.corporate_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS entitlement_type TEXT NOT NULL DEFAULT 'LISTING_CREDIT';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS entitlement_applied_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_entitlement_type') THEN
    ALTER TABLE public.payments ADD CONSTRAINT chk_payments_entitlement_type
      CHECK (entitlement_type IN ('LISTING_CREDIT', 'CORPORATE_SUBSCRIPTION'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_profile_idempotency
  ON public.payments(profile_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_external_payment_id
  ON public.payments(external_payment_id)
  WHERE external_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_listing_credits_payment
  ON public.listing_credits(payment_id);
DROP INDEX IF EXISTS public.uq_listing_credits_used_listing;
CREATE INDEX IF NOT EXISTS idx_listing_credits_used_listing
  ON public.listing_credits(used_listing_id);

CREATE OR REPLACE FUNCTION public.complete_sanboard_payment(
  p_order_id TEXT,
  p_external_payment_id TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_package public.packages%ROWTYPE;
  v_credit public.listing_credits%ROWTYPE;
  v_base TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Ödeme kaydı bulunamadı.'); END IF;

  IF v_payment.status = 'SUCCESS' AND v_payment.entitlement_applied_at IS NOT NULL THEN
    IF p_external_payment_id IS NOT NULL
       AND v_payment.external_payment_id IS NOT NULL
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
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Ödeme paketi bulunamadı.'); END IF;
  IF NOT v_package.active OR v_package.price <= 0 OR v_payment.amount <> v_package.price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ödeme paketi veya tutarı doğrulanamadı.');
  END IF;

  IF v_payment.entitlement_type = 'CORPORATE_SUBSCRIPTION'
     AND v_package.code = 'CORPORATE_SUBSCRIPTION_30_DAY'
     AND v_package.seller_type = 'CORPORATE'
     AND v_package.duration_days = 30 THEN
    IF v_payment.corporate_profile_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Üyelik ödemesi mağazaya bağlı değil.');
    END IF;
    PERFORM 1 FROM public.corporate_profiles
      WHERE id = v_payment.corporate_profile_id
        AND owner_profile_id = v_payment.profile_id
        AND status = 'APPROVED'
        AND moderation_status <> 'DELETED'
      FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Kurumsal mağaza üyelik için uygun değil.'); END IF;

    SELECT GREATEST(NOW(), COALESCE(subscription_expires_at, NOW())) INTO v_base
      FROM public.corporate_profiles WHERE id = v_payment.corporate_profile_id;
    UPDATE public.corporate_profiles SET
      subscription_status = 'ACTIVE',
      subscription_expires_at = v_base + INTERVAL '30 days',
      boost_credits = 3,
      updated_at = NOW()
    WHERE id = v_payment.corporate_profile_id;
  ELSIF v_payment.entitlement_type = 'LISTING_CREDIT'
        AND (
          (v_package.code = 'STANDARD_7_DAY'
           AND v_package.seller_type = 'INDIVIDUAL'
           AND v_package.duration_days = 7)
          OR
          (v_package.code = 'CORPORATE_14_DAY'
           AND v_package.seller_type = 'CORPORATE'
           AND v_package.duration_days = 14)
        ) THEN
    IF v_package.code = 'CORPORATE_14_DAY' THEN
      IF v_payment.corporate_profile_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Kurumsal ilan kredisi mağazaya bağlı değil.');
      END IF;
      PERFORM 1 FROM public.corporate_profiles
        WHERE id = v_payment.corporate_profile_id
          AND owner_profile_id = v_payment.profile_id
          AND status = 'APPROVED'
          AND moderation_status = 'ACTIVE'
          AND subscription_status = 'ACTIVE'
          AND subscription_expires_at > NOW()
        FOR UPDATE;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Kurumsal mağaza ilan kredisi için uygun değil.');
      END IF;
    END IF;
    INSERT INTO public.listing_credits (
      profile_id, payment_id, package_id, credit_type, corporate_profile_id, amount, status
    ) VALUES (
      v_payment.profile_id,
      v_payment.id,
      v_payment.package_id,
      CASE v_package.code
        WHEN 'CORPORATE_14_DAY' THEN 'CORPORATE'
        WHEN 'STANDARD_7_DAY' THEN 'INDIVIDUAL'
        ELSE NULL
      END,
      CASE WHEN v_package.code = 'CORPORATE_14_DAY' THEN v_payment.corporate_profile_id ELSE NULL END,
      v_payment.amount,
      'AVAILABLE'
    ) ON CONFLICT (payment_id) DO NOTHING
    RETURNING * INTO v_credit;
    IF v_credit.id IS NULL THEN SELECT * INTO v_credit FROM public.listing_credits WHERE payment_id = v_payment.id; END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Paket ve entitlement türü birbiriyle uyumlu değil.');
  END IF;

  UPDATE public.payments SET
    status = 'SUCCESS',
    external_payment_id = COALESCE(external_payment_id, p_external_payment_id),
    paid_at = COALESCE(paid_at, NOW()),
    entitlement_applied_at = COALESCE(entitlement_applied_at, NOW())
  WHERE id = v_payment.id;

  RETURN jsonb_build_object('success', true, 'credit', to_jsonb(v_credit));
END;
$$;

CREATE OR REPLACE FUNCTION public.republish_listing_with_credit(
  p_listing_id UUID,
  p_profile_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
  v_credit public.listing_credits%ROWTYPE;
  v_owner UUID;
  v_days INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'İlan bulunamadı.'); END IF;
  IF v_listing.status <> 'EXPIRED' AND NOT (v_listing.status = 'ACTIVE' AND v_listing.expires_at <= v_now) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yalnızca süresi dolmuş ilanlar yeniden yayınlanabilir.');
  END IF;

  IF v_listing.seller_type = 'CORPORATE' THEN
    SELECT owner_profile_id INTO v_owner FROM public.corporate_profiles
      WHERE id = v_listing.corporate_profile_id AND status = 'APPROVED'
        AND moderation_status = 'ACTIVE' AND subscription_status = 'ACTIVE'
        AND subscription_expires_at > v_now;
    IF v_owner IS DISTINCT FROM p_profile_id THEN RETURN jsonb_build_object('success', false, 'error', 'Kurumsal mağaza yeniden yayınlamaya uygun değil.'); END IF;
    SELECT * INTO v_credit FROM public.listing_credits
      WHERE profile_id = p_profile_id AND status = 'AVAILABLE' AND credit_type = 'CORPORATE'
        AND corporate_profile_id = v_listing.corporate_profile_id
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
    v_days := 14;
  ELSE
    IF v_listing.seller_profile_id <> p_profile_id THEN RETURN jsonb_build_object('success', false, 'error', 'Bu ilanı yeniden yayınlama yetkiniz yok.'); END IF;
    SELECT * INTO v_credit FROM public.listing_credits
      WHERE profile_id = p_profile_id AND status = 'AVAILABLE' AND credit_type = 'INDIVIDUAL'
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
    v_days := 7;
  END IF;
  IF v_credit.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Uygun yayın hakkı bulunamadı.'); END IF;

  UPDATE public.listing_credits SET status = 'USED', used_listing_id = p_listing_id, used_at = v_now WHERE id = v_credit.id;
  UPDATE public.listings SET status = 'ACTIVE', published_at = v_now,
    expires_at = v_now + make_interval(days => v_days), updated_at = v_now,
    is_featured = false, featured_until = NULL WHERE id = p_listing_id
  RETURNING * INTO v_listing;
  RETURN jsonb_build_object('success', true, 'listing', to_jsonb(v_listing));
END;
$$;

CREATE OR REPLACE FUNCTION public.create_listing_with_credit(
  p_profile_id UUID,
  p_seller_type TEXT,
  p_corporate_profile_id UUID,
  p_listing JSONB,
  p_details JSONB,
  p_images JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_credit public.listing_credits%ROWTYPE;
  v_listing public.listings%ROWTYPE;
  v_store public.corporate_profiles%ROWTYPE;
  v_days INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_seller_type NOT IN ('INDIVIDUAL', 'CORPORATE') THEN
    RAISE EXCEPTION 'Desteklenmeyen satıcı tipi: %', p_seller_type;
  END IF;
  IF p_listing->>'category' NOT IN ('vehicle', 'property') THEN
    RAISE EXCEPTION 'Desteklenmeyen ilan kategorisi: %', COALESCE(p_listing->>'category', 'NULL');
  END IF;
  IF jsonb_typeof(p_images) <> 'array' THEN
    RAISE EXCEPTION 'İlan fotoğrafları dizi formatında olmalıdır.';
  END IF;
  IF p_listing->>'category' = 'vehicle' AND jsonb_array_length(p_images) > 3 THEN
    RAISE EXCEPTION 'Araç ilanlarında en fazla 3 fotoğraf kullanılabilir.';
  END IF;
  IF p_listing->>'category' = 'property' AND jsonb_array_length(p_images) > 5 THEN
    RAISE EXCEPTION 'Mülk ilanlarında en fazla 5 fotoğraf kullanılabilir.';
  END IF;

  IF p_seller_type = 'CORPORATE' THEN
    SELECT * INTO v_store FROM public.corporate_profiles
      WHERE id = p_corporate_profile_id AND owner_profile_id = p_profile_id
        AND status = 'APPROVED' AND moderation_status = 'ACTIVE'
        AND subscription_status = 'ACTIVE' AND subscription_expires_at > v_now
      FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Kurumsal mağaza ilan yayınlamaya uygun değil.'); END IF;
    SELECT * INTO v_credit FROM public.listing_credits
      WHERE profile_id = p_profile_id AND status = 'AVAILABLE' AND credit_type = 'CORPORATE'
        AND corporate_profile_id = p_corporate_profile_id
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
    v_days := 14;
  ELSE
    SELECT * INTO v_credit FROM public.listing_credits
      WHERE profile_id = p_profile_id AND status = 'AVAILABLE' AND credit_type = 'INDIVIDUAL'
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
    v_days := 7;
  END IF;
  IF v_credit.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Uygun yayın hakkı bulunamadı.'); END IF;

  INSERT INTO public.listings (
    listing_number, seller_profile_id, seller_type, corporate_profile_id, category,
    subcategory, title, description, price, location, status, published_at, expires_at
  ) VALUES (
    p_listing->>'listing_number', p_profile_id, p_seller_type,
    CASE WHEN p_seller_type = 'CORPORATE' THEN p_corporate_profile_id ELSE NULL END,
    p_listing->>'category', p_listing->>'subcategory', p_listing->>'title',
    p_listing->>'description', (p_listing->>'price')::BIGINT, NULLIF(p_listing->>'location', ''),
    'ACTIVE', v_now, v_now + make_interval(days => v_days)
  ) RETURNING * INTO v_listing;

  IF v_listing.category = 'vehicle' THEN
    INSERT INTO public.vehicle_details (
      listing_id, vehicle_category, brand, model, plate, mileage, engine_upgrade,
      transmission_upgrade, brake_upgrade, turbo, subwoofer, trade_available,
      lock_level, alarm_level, anti_theft_level, engine_health, suspension, fuel_type, factory_price
    ) VALUES (
      v_listing.id, p_details->>'vehicle_category', COALESCE(p_details->>'brand',''),
      COALESCE(p_details->>'model',''), COALESCE(p_details->>'plate','LS-TEMP'),
      COALESCE((p_details->>'mileage')::INTEGER,0), COALESCE((p_details->>'engine_upgrade')::INTEGER,0),
      COALESCE((p_details->>'transmission_upgrade')::INTEGER,0), COALESCE((p_details->>'brake_upgrade')::INTEGER,0),
      COALESCE((p_details->>'turbo')::BOOLEAN,false), COALESCE((p_details->>'subwoofer')::BOOLEAN,false),
      COALESCE((p_details->>'trade_available')::BOOLEAN,false), (p_details->>'lock_level')::INTEGER,
      (p_details->>'alarm_level')::INTEGER, (p_details->>'anti_theft_level')::INTEGER,
      (p_details->>'engine_health')::INTEGER, NULLIF(p_details->>'suspension',''),
      NULLIF(p_details->>'fuel_type',''), (p_details->>'factory_price')::BIGINT
    );
  ELSIF v_listing.category = 'property' THEN
    INSERT INTO public.property_details (
      listing_id, property_type, floor, room_count, furnished, building_type, balcony
    ) VALUES (
      v_listing.id, p_details->>'property_type', COALESCE((p_details->>'floor')::INTEGER,1),
      COALESCE(p_details->>'room_count','1+1'), COALESCE((p_details->>'furnished')::BOOLEAN,false),
      COALESCE(p_details->>'building_type','Normal'), COALESCE((p_details->>'balcony')::BOOLEAN,false)
    );
  ELSE
    RAISE EXCEPTION 'Desteklenmeyen ilan kategorisi: %', v_listing.category;
  END IF;

  INSERT INTO public.listing_images (listing_id, storage_path, sort_order, is_cover, size_bytes)
  SELECT v_listing.id, image->>'storage_path', COALESCE((image->>'sort_order')::SMALLINT, 0),
    COALESCE((image->>'is_cover')::BOOLEAN, false), COALESCE((image->>'size_bytes')::INTEGER, 0)
  FROM jsonb_array_elements(p_images) image;

  UPDATE public.listing_credits SET status = 'USED', used_listing_id = v_listing.id, used_at = v_now
    WHERE id = v_credit.id;
  RETURN jsonb_build_object('success', true, 'listing', to_jsonb(v_listing));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_sanboard_payment(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_sanboard_payment(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_sanboard_payment(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_sanboard_payment(TEXT, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.republish_listing_with_credit(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.republish_listing_with_credit(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.republish_listing_with_credit(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.republish_listing_with_credit(UUID, UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_listing_with_credit(UUID, TEXT, UUID, JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_listing_with_credit(UUID, TEXT, UUID, JSONB, JSONB, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_listing_with_credit(UUID, TEXT, UUID, JSONB, JSONB, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_listing_with_credit(UUID, TEXT, UUID, JSONB, JSONB, JSONB) TO service_role;

COMMIT;