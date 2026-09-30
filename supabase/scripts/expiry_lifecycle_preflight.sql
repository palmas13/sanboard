-- Read-only: run before 20261001000000_expiry_and_subscription_lifecycle.sql.
SELECT COUNT(*) AS active_past_due_listings
FROM public.listings
WHERE status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at <= NOW();

SELECT COUNT(*) AS active_past_due_subscriptions
FROM public.corporate_profiles
WHERE subscription_status = 'ACTIVE'
  AND subscription_expires_at IS NOT NULL
  AND subscription_expires_at <= NOW();

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer, p.proacl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('run_expiry_lifecycle', 'close_offers_for_listing');