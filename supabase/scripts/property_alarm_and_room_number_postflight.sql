-- Read-only postflight checks for 20261001030000_property_alarm_and_room_number.sql.
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'property_details'
  AND column_name IN ('alarm', 'room_number')
ORDER BY column_name;

SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition,
  convalidated AS validated
FROM pg_constraint
WHERE conrelid = 'public.property_details'::regclass
  AND conname = 'property_details_room_number_check';

SELECT
  COUNT(*) FILTER (WHERE room_number IS NOT NULL AND room_number <= 0) AS invalid_room_numbers,
  COUNT(*) FILTER (WHERE room_number IS NULL) AS legacy_room_number_nulls,
  COUNT(*) FILTER (WHERE alarm IS NULL) AS legacy_alarm_nulls
FROM public.property_details;

SELECT
  p.oid::regprocedure::text AS function_signature,
  p.prosecdef AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'create_listing_with_credit'
  AND pg_get_function_identity_arguments(p.oid) = 'p_profile_id uuid, p_seller_type text, p_corporate_profile_id uuid, p_listing jsonb, p_details jsonb, p_images jsonb';