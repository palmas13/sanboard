-- SANBOARD CORPORATE SUBSCRIPTION PACKAGE
-- Prepared on 2026-09-26. Do not apply automatically.

BEGIN;

DO $$
DECLARE
  v_package public.packages%ROWTYPE;
BEGIN
  SELECT *
  INTO v_package
  FROM public.packages
  WHERE code = 'CORPORATE_SUBSCRIPTION_30_DAY'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.packages (
      code,
      name,
      price,
      seller_type,
      duration_days,
      active
    ) VALUES (
      'CORPORATE_SUBSCRIPTION_30_DAY',
      '30 Günlük Kurumsal Üyelik',
      5000,
      'CORPORATE',
      30,
      TRUE
    );
  ELSIF v_package.name IS DISTINCT FROM '30 Günlük Kurumsal Üyelik'
     OR v_package.price IS DISTINCT FROM 5000
     OR v_package.seller_type IS DISTINCT FROM 'CORPORATE'
     OR v_package.duration_days IS DISTINCT FROM 30
     OR v_package.active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION
      'Conflicting CORPORATE_SUBSCRIPTION_30_DAY package: expected name=%, price=%, seller_type=%, duration_days=%, active=%; found name=%, price=%, seller_type=%, duration_days=%, active=%',
      '30 Günlük Kurumsal Üyelik', 5000, 'CORPORATE', 30, TRUE,
      v_package.name, v_package.price, v_package.seller_type, v_package.duration_days, v_package.active;
  END IF;
END $$;

COMMIT;