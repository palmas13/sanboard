-- SANBOARD PAYMENT / BOOST INTEGRITY PACKAGE 1
-- READ-ONLY PRE-MIGRATION PREFLIGHT. Safe before period columns exist.

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'corporate_profiles'
  AND column_name IN (
    'id', 'owner_profile_id', 'status', 'moderation_status',
    'subscription_status', 'subscription_expires_at', 'boost_credits',
    'current_period_start', 'current_period_end'
  )
ORDER BY ordinal_position;

-- Uses only columns that exist before this migration.
SELECT id, owner_profile_id, status, moderation_status, subscription_status,
  subscription_expires_at, boost_credits
FROM public.corporate_profiles
ORDER BY id;

SELECT
  COUNT(*) FILTER (WHERE boost_credits IS NULL) AS null_boost_credits,
  COUNT(*) FILTER (WHERE boost_credits < 0) AS negative_boost_credits,
  COUNT(*) FILTER (WHERE subscription_status = 'ACTIVE' AND subscription_expires_at > NOW()) AS legacy_active_future_expiry_rows_to_initialize,
  COUNT(*) FILTER (WHERE subscription_status = 'ACTIVE' AND (subscription_expires_at IS NULL OR subscription_expires_at <= NOW())) AS active_without_future_expiry,
  COUNT(*) FILTER (WHERE subscription_status <> 'ACTIVE' AND subscription_expires_at > NOW()) AS inactive_with_future_expiry
FROM public.corporate_profiles;

SELECT external_payment_id, COUNT(*) AS duplicate_count
FROM public.payments WHERE external_payment_id IS NOT NULL
GROUP BY external_payment_id HAVING COUNT(*) > 1;

SELECT profile_id, idempotency_key, COUNT(*) AS duplicate_count
FROM public.payments WHERE idempotency_key IS NOT NULL
GROUP BY profile_id, idempotency_key HAVING COUNT(*) > 1;

SELECT payment_id, COUNT(*) AS duplicate_count
FROM public.listing_credits GROUP BY payment_id HAVING COUNT(*) > 1;

-- Every overload, exact signature, definition and ACL is visible here.
SELECT n.nspname AS schema_name, p.proname,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_get_function_arguments(p.oid) AS declared_arguments,
  pg_get_function_result(p.oid) AS result_type,
  p.prosecdef AS security_definer, p.proacl,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('consume_corporate_boost', 'complete_sanboard_payment')
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);

WITH expected(index_name, table_name, expected_policy) AS (
  VALUES
    ('uq_payments_external_payment_id', 'payments', 'UNIQUE external_payment_id WHERE external_payment_id IS NOT NULL'),
    ('uq_payments_profile_idempotency', 'payments', 'UNIQUE (profile_id, idempotency_key) WHERE idempotency_key IS NOT NULL'),
    ('uq_listing_credits_payment', 'listing_credits', 'UNIQUE payment_id')
)
SELECT e.index_name AS expected_index_name, e.table_name, e.expected_policy,
  i.indexname AS deployed_index_name, i.indexdef AS deployed_definition,
  (i.indexname IS NOT NULL) AS is_present
FROM expected e
LEFT JOIN pg_indexes i ON i.schemaname = 'public'
  AND i.tablename = e.table_name AND i.indexname = e.index_name
ORDER BY e.index_name;

SELECT c.conname, c.contype, c.convalidated,
  pg_get_constraintdef(c.oid, true) AS definition
FROM pg_constraint c
WHERE c.conrelid IN (
  'public.payments'::regclass,
  'public.listing_credits'::regclass,
  'public.corporate_profiles'::regclass
)
ORDER BY c.conrelid::regclass::text, c.conname;

SELECT code, active, seller_type, duration_days, price
FROM public.packages
WHERE code IN ('STANDARD_7_DAY', 'CORPORATE_14_DAY', 'CORPORATE_SUBSCRIPTION_30_DAY')
ORDER BY code;

-- Explicit canonical expectation for the controlled subscription package data migration.
WITH expected AS (
  SELECT
    'CORPORATE_SUBSCRIPTION_30_DAY'::TEXT AS code,
    '30 Günlük Kurumsal Üyelik'::TEXT AS name,
    5000::INTEGER AS price,
    'CORPORATE'::TEXT AS seller_type,
    30::INTEGER AS duration_days,
    TRUE AS active
), actual AS (
  SELECT code, name, price, seller_type, duration_days, active
  FROM public.packages
  WHERE code = 'CORPORATE_SUBSCRIPTION_30_DAY'
)
SELECT e.code, e.name AS expected_name, a.name AS actual_name,
  e.price AS expected_price, a.price AS actual_price,
  e.seller_type AS expected_seller_type, a.seller_type AS actual_seller_type,
  e.duration_days AS expected_duration_days, a.duration_days AS actual_duration_days,
  e.active AS expected_active, a.active AS actual_active,
  CASE
    WHEN a.code IS NULL THEN 'MISSING'
    WHEN a.name IS DISTINCT FROM e.name
      OR a.price IS DISTINCT FROM e.price
      OR a.seller_type IS DISTINCT FROM e.seller_type
      OR a.duration_days IS DISTINCT FROM e.duration_days
      OR a.active IS DISTINCT FROM e.active THEN 'MISMATCH'
    ELSE 'MATCH'
  END AS validation_status
FROM expected e
LEFT JOIN actual a ON a.code = e.code;