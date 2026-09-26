-- READ-ONLY DIAGNOSTIC SCRIPT
-- Not a migration.
-- Do not apply as a schema migration.
-- SANBOARD PHASE 1 + RECONCILIATION READ-ONLY PREFLIGHT
-- Run against production and export every result set before applying migrations.

SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  p.prosecdef AS security_definer,
  p.proacl AS execute_acl,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'update_listing_price'
ORDER BY identity_arguments;

SELECT
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid, true) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'notifications'
  AND c.conname = 'notifications_type_check';

SELECT type, COUNT(*) AS row_count
FROM public.notifications
GROUP BY type
ORDER BY type;

WITH favorite_health AS (
  SELECT
    COUNT(*) FILTER (WHERE f.profile_id IS NULL) AS null_profile_count,
    COUNT(*) FILTER (WHERE f.profile_id IS NOT NULL AND cp.id IS NULL) AS orphan_profile_count,
    COUNT(*) FILTER (
      WHERE f.profile_id IS NOT NULL
        AND cp.id IS NOT NULL
        AND f.user_id IS NOT NULL
        AND f.user_id <> cp.user_id
    ) AS profile_user_mismatch_count
  FROM public.favorites f
  LEFT JOIN public.character_profiles cp ON cp.id = f.profile_id
)
SELECT * FROM favorite_health;

WITH conflicts AS (
  SELECT 'payment_profile_idempotency_duplicate'::text AS conflict_type,
         profile_id::text || ':' || idempotency_key AS conflict_key,
         COUNT(*) AS row_count
  FROM public.payments
  WHERE idempotency_key IS NOT NULL
  GROUP BY profile_id, idempotency_key
  HAVING COUNT(*) > 1
  UNION ALL
  SELECT 'payment_external_id_duplicate', external_payment_id, COUNT(*)
  FROM public.payments
  WHERE external_payment_id IS NOT NULL
  GROUP BY external_payment_id
  HAVING COUNT(*) > 1
  UNION ALL
  SELECT 'listing_credit_payment_duplicate', payment_id::text, COUNT(*)
  FROM public.listing_credits
  GROUP BY payment_id
  HAVING COUNT(*) > 1
)
SELECT * FROM conflicts ORDER BY conflict_type, conflict_key;

SELECT id, code, name, price, seller_type, duration_days, active
FROM public.packages
WHERE code = 'CORPORATE_SUBSCRIPTION_30_DAY';