-- SANBOARD FLEECA V2 HOSTED PAYMENTS
BEGIN;

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS target_listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

UPDATE public.payments SET purpose = CASE
  WHEN entitlement_type = 'CORPORATE_SUBSCRIPTION' THEN 'CORPORATE_SUBSCRIPTION'
  ELSE 'LISTING_PUBLICATION'
END WHERE purpose IS NULL;

ALTER TABLE public.payments ALTER COLUMN purpose SET NOT NULL;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS chk_payments_purpose;
ALTER TABLE public.payments ADD CONSTRAINT chk_payments_purpose
  CHECK (purpose IN ('LISTING_PUBLICATION','LISTING_BOOST','CORPORATE_SUBSCRIPTION'));
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS chk_payments_entitlement_type;
ALTER TABLE public.payments ADD CONSTRAINT chk_payments_entitlement_type
  CHECK (entitlement_type IN ('LISTING_CREDIT','LISTING_BOOST','CORPORATE_SUBSCRIPTION'));

INSERT INTO public.packages (code, name, price, duration_days, active, seller_type)
SELECT 'LISTING_BOOST_24_HOUR', '24 Saat İlan Öne Çıkarma', 1, 1, TRUE, 'CORPORATE'
WHERE NOT EXISTS (SELECT 1 FROM public.packages WHERE code = 'LISTING_BOOST_24_HOUR');

CREATE OR REPLACE FUNCTION public.complete_sanboard_boost_payment(p_order_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_result JSONB;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Ödeme kaydı bulunamadı.'); END IF;
  IF v_payment.purpose <> 'LISTING_BOOST' OR v_payment.target_listing_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Boost ödeme hedefi geçersiz.');
  END IF;
  IF v_payment.status = 'SUCCESS' AND v_payment.entitlement_applied_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'featured_until',
      (SELECT featured_until FROM public.listings WHERE id = v_payment.target_listing_id));
  END IF;
  IF v_payment.external_payment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fleeca ödeme kimliği bulunamadı.');
  END IF;

  v_result := public.consume_corporate_boost(v_payment.profile_id, v_payment.target_listing_id, 'REQUIRE_CREDIT');
  IF NOT COALESCE((v_result->>'success')::BOOLEAN, FALSE) THEN RETURN v_result; END IF;

  UPDATE public.payments SET status = 'SUCCESS', paid_at = v_now,
    entitlement_applied_at = v_now, processed_at = v_now WHERE id = v_payment.id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_sanboard_boost_payment(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_sanboard_boost_payment(TEXT) TO service_role;

COMMIT;