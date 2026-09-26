-- READ-ONLY NOTIFICATION TYPE PREFLIGHT
-- Run against production and review every result set before applying the
-- notification type reconciliation migration.

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

WITH expected_types(type) AS (
  VALUES
    ('LISTING_PRICE_DROP'),
    ('LISTING_PRICE_CHANGE'),
    ('SUPPORT_REPLY'),
    ('SYSTEM'),
    ('LISTING_EXPIRES_SOON'),
    ('CORPORATE_APPLICATION_APPROVED'),
    ('CORPORATE_APPLICATION_REJECTED'),
    ('NEW_CORPORATE_LISTING'),
    ('NEW_FOLLOWER'),
    ('CORPORATE_SUBSCRIPTION_EXPIRING'),
    ('CORPORATE_STORE_SUSPENDED'),
    ('CORPORATE_STORE_REACTIVATED'),
    ('CORPORATE_STORE_DELETED')
), constraint_definition AS (
  SELECT pg_get_constraintdef(c.oid, true) AS definition
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'notifications'
    AND c.conname = 'notifications_type_check'
)
SELECT
  expected_types.type,
  COALESCE(constraint_definition.definition LIKE '%' || quote_literal(expected_types.type) || '%', false)
    AS present_in_current_constraint
FROM expected_types
LEFT JOIN constraint_definition ON true
ORDER BY expected_types.type;

WITH expected_types(type) AS (
  VALUES
    ('LISTING_PRICE_DROP'),
    ('LISTING_PRICE_CHANGE'),
    ('SUPPORT_REPLY'),
    ('SYSTEM'),
    ('LISTING_EXPIRES_SOON'),
    ('CORPORATE_APPLICATION_APPROVED'),
    ('CORPORATE_APPLICATION_REJECTED'),
    ('NEW_CORPORATE_LISTING'),
    ('NEW_FOLLOWER'),
    ('CORPORATE_SUBSCRIPTION_EXPIRING'),
    ('CORPORATE_STORE_SUSPENDED'),
    ('CORPORATE_STORE_REACTIVATED'),
    ('CORPORATE_STORE_DELETED')
)
SELECT n.type, COUNT(*) AS unsupported_row_count
FROM public.notifications n
LEFT JOIN expected_types e ON e.type = n.type
WHERE e.type IS NULL
GROUP BY n.type
ORDER BY n.type;