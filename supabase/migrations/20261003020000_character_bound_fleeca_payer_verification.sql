-- Character-bound Fleeca payer verification.
-- Forward-only migration prepared on 2026-10-03. Do not apply automatically.
BEGIN;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS expected_external_character_id TEXT,
  ADD COLUMN IF NOT EXISTS expected_character_name TEXT,
  ADD COLUMN IF NOT EXISTS payer_identity_status TEXT,
  ADD COLUMN IF NOT EXISTS payer_identity_failure_code TEXT,
  ADD COLUMN IF NOT EXISTS payer_identity_verified_at TIMESTAMPTZ;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS chk_payments_expected_payer_snapshot;
ALTER TABLE public.payments ADD CONSTRAINT chk_payments_expected_payer_snapshot CHECK (
  (expected_external_character_id IS NULL AND expected_character_name IS NULL)
  OR (NULLIF(BTRIM(expected_external_character_id), '') IS NOT NULL AND NULLIF(BTRIM(expected_character_name), '') IS NOT NULL)
);
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS chk_payments_payer_identity_status;
ALTER TABLE public.payments ADD CONSTRAINT chk_payments_payer_identity_status CHECK (
  payer_identity_status IS NULL OR payer_identity_status IN ('PENDING', 'VERIFIED', 'MISMATCH', 'UNAVAILABLE', 'FAILED')
);
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS chk_payments_payer_identity_failure_code;
ALTER TABLE public.payments ADD CONSTRAINT chk_payments_payer_identity_failure_code CHECK (
  payer_identity_failure_code IS NULL OR payer_identity_failure_code IN (
    'PAYER_NAME_MISMATCH', 'PAYER_NAME_MISSING', 'PAYER_ROUTING_MISSING',
    'PAYER_ROUTING_INVALID', 'PAYER_ROUTING_CONFLICT',
    'PAYER_IDENTITY_UNAVAILABLE', 'PAYER_VERIFICATION_FAILED'
  )
);

CREATE TABLE IF NOT EXISTS public.character_fleeca_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.character_profiles(id) ON DELETE CASCADE,
  payer_routing TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'VERIFIED' CHECK (verification_status = 'VERIFIED'),
  verified_payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_character_fleeca_accounts_routing CHECK (payer_routing ~ '^[0-9]+$'),
  CONSTRAINT uq_character_fleeca_accounts_routing UNIQUE (payer_routing),
  CONSTRAINT uq_character_fleeca_accounts_profile_routing UNIQUE (profile_id, payer_routing)
);

ALTER TABLE public.character_fleeca_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.character_fleeca_accounts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_payment_expected_payer_identity()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.expected_external_character_id IS DISTINCT FROM NEW.expected_external_character_id
     OR OLD.expected_character_name IS DISTINCT FROM NEW.expected_character_name THEN
    RAISE EXCEPTION 'Payment expected payer identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_payment_expected_payer_identity ON public.payments;
CREATE TRIGGER trg_protect_payment_expected_payer_identity
BEFORE UPDATE OF expected_external_character_id, expected_character_name ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.protect_payment_expected_payer_identity();

CREATE OR REPLACE FUNCTION public.require_verified_payer_before_entitlement()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.expected_external_character_id IS NOT NULL
     AND NEW.expected_character_name IS NOT NULL
     AND (NEW.status = 'SUCCESS' OR NEW.entitlement_applied_at IS NOT NULL)
     AND NEW.payer_identity_status IS DISTINCT FROM 'VERIFIED' THEN
    RAISE EXCEPTION 'Character-bound payer identity is not verified';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_verified_payer_before_entitlement ON public.payments;
CREATE TRIGGER trg_require_verified_payer_before_entitlement
BEFORE UPDATE OF status, entitlement_applied_at ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.require_verified_payer_before_entitlement();

CREATE OR REPLACE FUNCTION public.verify_sanboard_fleeca_payer(
  p_order_id TEXT,
  p_payer_name TEXT,
  p_payer_routing TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_existing public.character_fleeca_accounts%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_expected_name TEXT;
  v_payer_name TEXT;
  v_routing TEXT;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'status', 'FAILED', 'failure_code', 'PAYER_VERIFICATION_FAILED');
  END IF;

  -- Historical payments created before identity snapshots retain legacy behavior.
  IF v_payment.expected_external_character_id IS NULL AND v_payment.expected_character_name IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'VERIFIED', 'legacy', true);
  END IF;
  IF v_payment.expected_external_character_id IS NULL OR v_payment.expected_character_name IS NULL THEN
    UPDATE public.payments SET payer_identity_status = 'UNAVAILABLE',
      payer_identity_failure_code = 'PAYER_IDENTITY_UNAVAILABLE', payer_identity_verified_at = NULL
    WHERE id = v_payment.id;
    RETURN jsonb_build_object('success', false, 'status', 'UNAVAILABLE', 'failure_code', 'PAYER_IDENTITY_UNAVAILABLE');
  END IF;
  IF p_payer_name IS NULL OR NULLIF(BTRIM(p_payer_name), '') IS NULL THEN
    UPDATE public.payments SET payer_identity_status = 'UNAVAILABLE',
      payer_identity_failure_code = 'PAYER_NAME_MISSING', payer_identity_verified_at = NULL WHERE id = v_payment.id;
    RETURN jsonb_build_object('success', false, 'status', 'UNAVAILABLE', 'failure_code', 'PAYER_NAME_MISSING');
  END IF;
  IF p_payer_routing IS NULL OR NULLIF(BTRIM(p_payer_routing), '') IS NULL THEN
    UPDATE public.payments SET payer_identity_status = 'UNAVAILABLE',
      payer_identity_failure_code = 'PAYER_ROUTING_MISSING', payer_identity_verified_at = NULL WHERE id = v_payment.id;
    RETURN jsonb_build_object('success', false, 'status', 'UNAVAILABLE', 'failure_code', 'PAYER_ROUTING_MISSING');
  END IF;

  v_routing := BTRIM(p_payer_routing);
  IF v_routing !~ '^[0-9]+$' THEN
    UPDATE public.payments SET payer_identity_status = 'FAILED',
      payer_identity_failure_code = 'PAYER_ROUTING_INVALID', payer_identity_verified_at = NULL WHERE id = v_payment.id;
    RETURN jsonb_build_object('success', false, 'status', 'FAILED', 'failure_code', 'PAYER_ROUTING_INVALID');
  END IF;

  v_expected_name := LOWER(REGEXP_REPLACE(BTRIM(v_payment.expected_character_name), '\s+', ' ', 'g'));
  v_payer_name := LOWER(REGEXP_REPLACE(BTRIM(p_payer_name), '\s+', ' ', 'g'));
  IF v_expected_name <> v_payer_name THEN
    UPDATE public.payments SET payer_identity_status = 'MISMATCH',
      payer_identity_failure_code = 'PAYER_NAME_MISMATCH', payer_identity_verified_at = NULL WHERE id = v_payment.id;
    RETURN jsonb_build_object('success', false, 'status', 'MISMATCH', 'failure_code', 'PAYER_NAME_MISMATCH');
  END IF;

  SELECT * INTO v_existing FROM public.character_fleeca_accounts
  WHERE payer_routing = v_routing AND verification_status = 'VERIFIED' FOR UPDATE;
  IF FOUND AND v_existing.profile_id <> v_payment.profile_id THEN
    UPDATE public.payments SET payer_identity_status = 'MISMATCH',
      payer_identity_failure_code = 'PAYER_ROUTING_CONFLICT', payer_identity_verified_at = NULL WHERE id = v_payment.id;
    RETURN jsonb_build_object('success', false, 'status', 'MISMATCH', 'failure_code', 'PAYER_ROUTING_CONFLICT');
  END IF;

  IF NOT FOUND THEN
    BEGIN
      INSERT INTO public.character_fleeca_accounts (
        profile_id, payer_routing, verification_status, verified_payment_id, verified_at
      ) VALUES (
        v_payment.profile_id, v_routing, 'VERIFIED', v_payment.id, v_now
      );
    EXCEPTION WHEN unique_violation THEN
      SELECT * INTO v_existing FROM public.character_fleeca_accounts
      WHERE payer_routing = v_routing AND verification_status = 'VERIFIED';
      IF NOT FOUND OR v_existing.profile_id <> v_payment.profile_id THEN
        UPDATE public.payments SET payer_identity_status = 'MISMATCH',
          payer_identity_failure_code = 'PAYER_ROUTING_CONFLICT', payer_identity_verified_at = NULL WHERE id = v_payment.id;
        RETURN jsonb_build_object('success', false, 'status', 'MISMATCH', 'failure_code', 'PAYER_ROUTING_CONFLICT');
      END IF;
    END;
  END IF;

  UPDATE public.payments SET payer_identity_status = 'VERIFIED',
    payer_identity_failure_code = NULL, payer_identity_verified_at = v_now WHERE id = v_payment.id;
  RETURN jsonb_build_object('success', true, 'status', 'VERIFIED');
END;
$$;

REVOKE ALL ON FUNCTION public.verify_sanboard_fleeca_payer(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_sanboard_fleeca_payer(TEXT, TEXT, TEXT) TO service_role;

COMMIT;