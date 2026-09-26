-- SANBOARD PAYMENT / BOOST INTEGRITY PACKAGE 1
-- READ-ONLY POST-MIGRATION VALIDATION. Run only after controlled deployment.

SELECT
  COUNT(*) FILTER (WHERE current_period_start IS NOT NULL AND current_period_end IS NULL) AS start_without_end,
  COUNT(*) FILTER (WHERE current_period_end IS NOT NULL AND current_period_start IS NULL) AS end_without_start,
  COUNT(*) FILTER (WHERE current_period_start IS NOT NULL AND current_period_end IS NOT NULL AND current_period_start >= current_period_end) AS start_not_before_end,
  COUNT(*) FILTER (WHERE current_period_end IS NOT NULL AND subscription_expires_at IS NOT NULL AND current_period_end > subscription_expires_at) AS period_beyond_subscription,
  COUNT(*) FILTER (WHERE subscription_status = 'ACTIVE' AND subscription_expires_at > NOW() AND current_period_start IS NULL AND current_period_end IS NULL) AS active_future_with_null_period,
  COUNT(*) FILTER (WHERE subscription_expires_at <= NOW() AND current_period_end > NOW()) AS expired_subscription_with_future_period,
  COUNT(*) FILTER (WHERE boost_credits IS NULL) AS null_boost_credits,
  COUNT(*) FILTER (WHERE boost_credits < 0) AS negative_boost_credits
FROM public.corporate_profiles;

SELECT id, owner_profile_id, subscription_status, subscription_expires_at,
  current_period_start, current_period_end, boost_credits
FROM public.corporate_profiles
WHERE (current_period_start IS NULL) <> (current_period_end IS NULL)
   OR (current_period_start IS NOT NULL AND current_period_end IS NOT NULL AND current_period_start >= current_period_end)
   OR (current_period_end IS NOT NULL AND subscription_expires_at IS NOT NULL AND current_period_end > subscription_expires_at)
   OR (subscription_status = 'ACTIVE' AND subscription_expires_at > NOW() AND current_period_start IS NULL AND current_period_end IS NULL)
   OR (subscription_expires_at <= NOW() AND current_period_end > NOW())
   OR boost_credits IS NULL OR boost_credits < 0
ORDER BY id;

SELECT c.conname, c.convalidated,
  pg_get_constraintdef(c.oid, true) AS definition
FROM pg_constraint c
WHERE c.conrelid = 'public.corporate_profiles'::regclass
  AND c.conname = 'chk_corporate_profiles_boost_credits_nonnegative';

SELECT n.nspname AS schema_name, p.proname,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  p.prosecdef AS security_definer, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('consume_corporate_boost', 'complete_sanboard_payment')
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);

SELECT
  COUNT(*) AS subscription_package_row_count,
  COUNT(*) FILTER (
    WHERE name = '30 Günlük Kurumsal Üyelik'
      AND price = 5000
      AND seller_type = 'CORPORATE'
      AND duration_days = 30
      AND active = TRUE
  ) AS canonical_subscription_package_row_count,
  CASE
    WHEN COUNT(*) = 1 AND COUNT(*) FILTER (
      WHERE name = '30 Günlük Kurumsal Üyelik'
        AND price = 5000
        AND seller_type = 'CORPORATE'
        AND duration_days = 30
        AND active = TRUE
    ) = 1 THEN 'MATCH'
    WHEN COUNT(*) = 0 THEN 'MISSING'
    ELSE 'MISMATCH'
  END AS validation_status
FROM public.packages
WHERE code = 'CORPORATE_SUBSCRIPTION_30_DAY';

SELECT code, name, price, seller_type, duration_days, active
FROM public.packages
WHERE code = 'CORPORATE_SUBSCRIPTION_30_DAY'
  AND (name IS DISTINCT FROM '30 Günlük Kurumsal Üyelik'
    OR price IS DISTINCT FROM 5000
    OR seller_type IS DISTINCT FROM 'CORPORATE'
    OR duration_days IS DISTINCT FROM 30
    OR active IS DISTINCT FROM TRUE);