-- READ-ONLY DIAGNOSTIC SCRIPT
-- Not a migration.
-- Do not apply as a schema migration.
-- SANBOARD PRODUCTION DATABASE RECONCILIATION AUDIT
-- Read-only audit prepared on 2026-09-26.
-- Run once in the Supabase SQL Editor; all audit sections are returned as one result table.
-- This file intentionally contains only SELECT/WITH statements.
-- SQL syntax is stored literally (for example: SELECT * and count(*)); no Markdown escapes.

WITH
-- RESULT SET 1: expected tables and known code/schema naming conflicts
section_01_raw AS (
WITH expected(object_name, current_expected_presence, target_expected_presence, source) AS (
  VALUES
    ('users',NULL::boolean,true,'local target schema'),
    ('character_profiles',NULL,true,'local target schema'),
    ('corporate_profiles',NULL,true,'local target schema'),
    ('corporate_applications',NULL,true,'local target schema'),
    ('packages',NULL,true,'local target schema'),
    ('payments',NULL,true,'local target schema'),
    ('listing_credits',NULL,true,'local target schema'),
    ('listings',NULL,true,'local target schema'),
    ('vehicle_details',NULL,true,'local target schema'),
    ('property_details',NULL,true,'local target schema'),
    ('listing_images',NULL,true,'local target schema'),
    ('favorites',NULL,true,'local target schema'),
    ('reports',NULL,true,'local target schema'),
    ('support_tickets',NULL,true,'local target schema'),
    ('tickets',NULL,false,'code/schema naming mismatch; support_tickets is canonical'),
    ('ticket_messages',NULL,true,'local target schema'),
    ('sold_listing_audit',NULL,true,'local target schema'),
    ('listing_price_history',NULL,true,'local target schema'),
    ('notifications',NULL,true,'local target schema'),
    ('audit_logs',NULL,true,'local target schema'),
    ('media_cleanup_jobs',NULL,true,'local target schema'),
    ('corporate_followers',NULL,true,'local target schema')
)
SELECT
  'table'::text AS object_type,
  'public.' || e.object_name AS object_name,
  CASE WHEN e.current_expected_presence IS NULL THEN 'UNKNOWN_REQUIRES_AUDIT'
       WHEN e.current_expected_presence THEN 'PRESENT' ELSE 'ABSENT' END AS current_expected_state,
  concat(CASE WHEN e.target_expected_presence THEN 'PRESENT' ELSE 'ABSENT' END,
         ', source=', e.source) AS target_expected_state,
  CASE WHEN t.table_name IS NULL THEN 'MISSING' ELSE 'EXISTS' END AS actual_state,
  CASE WHEN e.current_expected_presence IS NULL THEN NULL
       WHEN e.current_expected_presence THEN t.table_name IS NOT NULL
       ELSE t.table_name IS NULL END AS matches_current_state,
  CASE WHEN e.target_expected_presence THEN t.table_name IS NOT NULL
       ELSE t.table_name IS NULL END AS matches_target_state
FROM expected e
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = e.object_name
ORDER BY e.object_name
),
section_01 AS (
  SELECT
    'RESULT SET 1'::text AS section,
    object_type::text,
    object_name::text,
    current_expected_state::text,
    target_expected_state::text,
    actual_state::text,
    matches_current_state::boolean,
    matches_target_state::boolean,
    NULL::text AS details
  FROM section_01_raw
)
,-- RESULT SET 2: important columns, types, nullability and defaults
section_02_raw AS (
-- current_expected_presence: known current production state; NULL means unknown and requires audit.
-- target_expected_presence: final local target schema state.
WITH base_expected(table_name, column_name, expected_type, expected_nullable, expected_default_pattern, source_migration) AS (
  VALUES
    ('listings','location','text','YES',NULL,'20260923000000 / 20260924020000'),
    ('listings','price','bigint','NO',NULL,'20260924020000'),
    ('listings','seller_type','text','NO','INDIVIDUAL','20260924060000'),
    ('listings','is_featured','boolean','NO','false','20260925000000'),
    ('listings','featured_until','timestamp with time zone','YES',NULL,'20260925000000'),
    ('character_profiles','avatar_path','text','YES',NULL,'20260924030000'),
    ('character_profiles','public_id','bigint','NO','nextval','20260924070000'),
    ('character_profiles','role','character varying','NO','USER','20260925030000'),
    ('character_profiles','sanmail_email','character varying','YES',NULL,'20260924060000'),
    ('character_profiles','phone','character varying','YES',NULL,'20260924060000'),
    ('corporate_profiles','public_id','bigint','NO','nextval','20260924040000'),
    ('corporate_profiles','logo_path','text','YES',NULL,'20260924040000'),
    ('corporate_profiles','banner_path','text','YES',NULL,'20260924040000'),
    ('corporate_profiles','subscription_status','text','YES','ACTIVE','20260925000000'),
    ('corporate_profiles','subscription_expires_at','timestamp with time zone','YES',NULL,'20260925000000'),
    ('corporate_profiles','boost_credits','integer','NO','3','20260925000000'),
    ('corporate_profiles','social_media','jsonb','YES',NULL,'20260925000000 / 20260925030000'),
    ('corporate_profiles','moderation_status','character varying','NO','ACTIVE','20260925040000'),
    ('corporate_profiles','suspended_at','timestamp with time zone','YES',NULL,'20260925040000'),
    ('corporate_profiles','suspended_by_profile_id','uuid','YES',NULL,'20260925040000'),
    ('corporate_profiles','suspension_reason','text','YES',NULL,'20260925040000'),
    ('corporate_profiles','deleted_at','timestamp with time zone','YES',NULL,'20260925040000'),
    ('corporate_profiles','deleted_by_profile_id','uuid','YES',NULL,'20260925040000'),
    ('corporate_profiles','deletion_reason','text','YES',NULL,'20260925040000'),
    ('corporate_applications','rejection_reason','text','YES',NULL,'20260925000000'),
    ('packages','seller_type','text','NO','INDIVIDUAL','20260925030000'),
    ('listing_credits','credit_type','text','NO','INDIVIDUAL','20260925030000'),
    ('listing_credits','amount','integer','NO','2000','20260925030000'),
    ('listing_credits','corporate_profile_id','uuid','YES',NULL,'20260925040000'),
    ('listing_credits','balance',NULL,NULL,NULL,'code/schema mismatch; each row represents one credit'),
    ('favorites','user_id','uuid','NO',NULL,'20260924000000 / 20260924020000'),
    ('favorites','profile_id','uuid','NO',NULL,'20260925030000'),
    ('notifications','recipient_profile_id','uuid','YES',NULL,'20260925030000'),
    ('notifications','user_id','uuid','YES',NULL,'20260925030000'),
    ('vehicle_details','lock_level','integer','YES',NULL,'20260924060000'),
    ('vehicle_details','alarm_level','integer','YES',NULL,'20260924060000'),
    ('vehicle_details','anti_theft_level','integer','YES',NULL,'20260924060000'),
    ('vehicle_details','engine_health','integer','YES',NULL,'20260924060000'),
    ('vehicle_details','suspension','text','YES',NULL,'20260924060000'),
    ('vehicle_details','fuel_type','text','YES',NULL,'20260924060000'),
    ('vehicle_details','factory_price','bigint','YES',NULL,'20260924060000'),
    ('payments','idempotency_key','text','YES',NULL,'20260926020000 KNOWN NOT APPLIED'),
    ('payments','corporate_profile_id','uuid','YES',NULL,'20260926020000 KNOWN NOT APPLIED'),
    ('payments','entitlement_type','text','NO','LISTING_CREDIT','20260926020000 KNOWN NOT APPLIED'),
    ('payments','entitlement_applied_at','timestamp with time zone','YES',NULL,'20260926020000 KNOWN NOT APPLIED')
), expected AS (
  SELECT b.*,
         CASE WHEN b.table_name = 'payments' AND b.column_name IN (
           'idempotency_key','corporate_profile_id','entitlement_type','entitlement_applied_at'
         ) THEN false ELSE NULL END AS current_expected_presence,
         CASE WHEN b.table_name = 'listing_credits' AND b.column_name = 'balance'
              THEN false ELSE true END AS target_expected_presence
  FROM base_expected b
), actual AS (
  SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
)
SELECT
  'column'::text AS object_type,
  'public.' || e.table_name || '.' || e.column_name AS object_name,
  CASE WHEN e.current_expected_presence IS NULL THEN 'UNKNOWN_REQUIRES_AUDIT'
       WHEN e.current_expected_presence THEN 'PRESENT' ELSE 'ABSENT' END AS current_expected_state,
  CASE WHEN e.target_expected_presence
       THEN concat('PRESENT, type=', e.expected_type, ', nullable=', e.expected_nullable,
                   CASE WHEN e.expected_default_pattern IS NULL THEN '' ELSE ', default contains ' || e.expected_default_pattern END,
                   ', source=', e.source_migration)
       ELSE concat('ABSENT, source=', e.source_migration) END AS target_expected_state,
  CASE WHEN a.column_name IS NULL THEN 'MISSING'
       ELSE concat('type=', a.data_type, ', udt=', a.udt_name, ', nullable=', a.is_nullable,
                   ', default=', coalesce(a.column_default, 'NULL')) END AS actual_state,
  CASE WHEN e.current_expected_presence IS NULL THEN NULL
       WHEN e.current_expected_presence THEN a.column_name IS NOT NULL
       ELSE a.column_name IS NULL END AS matches_current_state,
  CASE WHEN NOT e.target_expected_presence THEN a.column_name IS NULL
       WHEN a.column_name IS NULL THEN false
       ELSE a.data_type = e.expected_type
        AND a.is_nullable = e.expected_nullable
        AND (e.expected_default_pattern IS NULL OR coalesce(a.column_default, '') ILIKE '%' || e.expected_default_pattern || '%')
  END AS matches_target_state
FROM expected e
LEFT JOIN actual a USING (table_name, column_name)
ORDER BY e.table_name, e.column_name
),
section_02 AS (
  SELECT
    'RESULT SET 2'::text AS section,
    object_type::text,
    object_name::text,
    current_expected_state::text,
    target_expected_state::text,
    actual_state::text,
    matches_current_state::boolean,
    matches_target_state::boolean,
    NULL::text AS details
  FROM section_02_raw
)
,-- RESULT SET 3: indexes, including known production facts and Phase 1 expectations
section_03_raw AS (
WITH expected(index_name, expected_fragment, current_expected_presence, target_expected_presence, source_migration) AS (
  VALUES
    ('idx_users_provider_external_id','provider, external_user_id',NULL,true,'20260924050000'),
    ('idx_character_profiles_external_char_id','external_character_id',NULL,true,'20260924050000'),
    ('idx_character_profiles_sanmail_lower','lower(sanmail_email',NULL,true,'20260925000000'),
    ('idx_character_profiles_phone','phone',NULL,true,'20260925000000'),
    ('idx_listings_public_category_published','category, published_at DESC',true,true,'20260926000000 CONFIRMED'),
    ('idx_listings_profile_status_published','seller_profile_id, status, published_at DESC',true,true,'20260926000000 CONFIRMED'),
    ('idx_listings_corporate_status_published','corporate_profile_id, status, published_at DESC',true,true,'20260926000000 CONFIRMED'),
    ('idx_corporate_profiles_subscription_moderation','subscription_status, moderation_status',true,true,'20260926000000 CONFIRMED'),
    ('idx_support_tickets_profile_updated','profile_id, updated_at DESC',true,true,'20260926000000 CONFIRMED'),
    ('uq_corporate_profiles_active_owner','owner_profile_id',true,true,'20260925040000 CONFIRMED'),
    ('idx_corporate_profiles_moderation_status','moderation_status',true,true,'20260925040000 CONFIRMED'),
    ('idx_listing_credits_corporate_profile_id','corporate_profile_id',true,true,'20260925040000 CONFIRMED'),
    ('idx_listing_credits_corporate_lookup','corporate_profile_id, status',true,true,'20260925040000 CONFIRMED'),
    ('uq_favorites_profile_listing',NULL,false,false,'obsolete partial index must be absent'),
    ('uq_payments_profile_idempotency','profile_id, idempotency_key',false,true,'20260926020000 KNOWN NOT APPLIED'),
    ('uq_payments_external_payment_id','external_payment_id',false,true,'20260926020000 KNOWN NOT APPLIED'),
    ('uq_listing_credits_payment','payment_id',false,true,'20260926020000 KNOWN NOT APPLIED'),
    ('idx_listing_credits_used_listing','used_listing_id',false,true,'20260926020000 KNOWN NOT APPLIED'),
    ('uq_listing_credits_used_listing',NULL,false,false,'invalid Phase 1 draft index must be absent')
), actual AS (
  SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'
)
SELECT
  'index'::text AS object_type,
  'public.' || e.index_name AS object_name,
  CASE WHEN e.current_expected_presence IS NULL THEN 'UNKNOWN_REQUIRES_AUDIT'
       WHEN e.current_expected_presence THEN 'PRESENT' ELSE 'ABSENT' END AS current_expected_state,
  concat(CASE WHEN e.target_expected_presence THEN 'PRESENT' ELSE 'ABSENT' END,
         CASE WHEN e.expected_fragment IS NULL THEN '' ELSE ', definition contains ' || e.expected_fragment END,
         ', source=' || e.source_migration) AS target_expected_state,
  coalesce(a.indexdef, 'MISSING') AS actual_state,
  CASE WHEN e.current_expected_presence IS NULL THEN NULL
       WHEN e.current_expected_presence THEN a.indexname IS NOT NULL
       ELSE a.indexname IS NULL END AS matches_current_state,
  CASE WHEN e.target_expected_presence
       THEN a.indexname IS NOT NULL AND (e.expected_fragment IS NULL OR a.indexdef ILIKE '%' || e.expected_fragment || '%')
       ELSE a.indexname IS NULL END AS matches_target_state
FROM expected e
LEFT JOIN actual a ON a.indexname = e.index_name
ORDER BY e.index_name
),
section_03 AS (
  SELECT
    'RESULT SET 3'::text AS section,
    object_type::text,
    object_name::text,
    current_expected_state::text,
    target_expected_state::text,
    actual_state::text,
    matches_current_state::boolean,
    matches_target_state::boolean,
    NULL::text AS details
  FROM section_03_raw
)
,-- RESULT SET 4: named constraints and definitions
section_04_raw AS (
WITH expected(table_name, constraint_name, constraint_type, expected_fragment,
              current_expected_presence, target_expected_presence, source_migration) AS (
  VALUES
    ('favorites','favorites_profile_id_listing_id_key','u','UNIQUE (profile_id, listing_id)',true,true,'20260926010000 CONFIRMED'),
    ('favorites','favorites_user_id_listing_id_key','u',NULL,false,false,'obsolete account-scoped uniqueness'),
    ('corporate_profiles','uq_corporate_profiles_owner_profile_id','u',NULL,false,false,'replaced by partial unique index'),
    ('corporate_profiles','chk_corporate_profiles_moderation_status','c','moderation_status',true,true,'20260925040000 CONFIRMED'),
    ('character_profiles','chk_character_profiles_role','c','role',NULL,true,'20260925030000'),
    ('packages','chk_packages_seller_type','c','seller_type',NULL,true,'20260925030000'),
    ('listing_credits','chk_listing_credits_credit_type','c','credit_type',NULL,true,'20260925030000'),
    ('payments','chk_payments_entitlement_type','c','entitlement_type',false,true,'20260926020000 KNOWN NOT APPLIED')
), actual AS (
  SELECT c.conname, c.contype, cls.relname AS table_name, pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
  JOIN pg_class cls ON cls.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = cls.relnamespace
  WHERE n.nspname = 'public'
)
SELECT
  'constraint'::text AS object_type,
  'public.' || e.table_name || '.' || e.constraint_name AS object_name,
  CASE WHEN e.current_expected_presence IS NULL THEN 'UNKNOWN_REQUIRES_AUDIT'
       WHEN e.current_expected_presence THEN 'PRESENT' ELSE 'ABSENT' END AS current_expected_state,
  concat(CASE WHEN e.target_expected_presence THEN 'PRESENT' ELSE 'ABSENT' END,
         ', type=', e.constraint_type,
         CASE WHEN e.expected_fragment IS NULL THEN '' ELSE ', definition contains ' || e.expected_fragment END,
         ', source=' || e.source_migration) AS target_expected_state,
  CASE WHEN a.conname IS NULL THEN 'MISSING'
       ELSE concat('type=', a.contype, ', definition=', a.definition) END AS actual_state,
  CASE WHEN e.current_expected_presence IS NULL THEN NULL
       WHEN e.current_expected_presence THEN a.conname IS NOT NULL
       ELSE a.conname IS NULL END AS matches_current_state,
  CASE WHEN e.target_expected_presence
       THEN a.conname IS NOT NULL AND a.contype = e.constraint_type
        AND (e.expected_fragment IS NULL OR a.definition ILIKE '%' || e.expected_fragment || '%')
       ELSE a.conname IS NULL END AS matches_target_state
FROM expected e
LEFT JOIN actual a
  ON a.table_name = e.table_name AND a.conname = e.constraint_name
ORDER BY e.table_name, e.constraint_name
),
section_04 AS (
  SELECT
    'RESULT SET 4'::text AS section,
    object_type::text,
    object_name::text,
    current_expected_state::text,
    target_expected_state::text,
    actual_state::text,
    matches_current_state::boolean,
    matches_target_state::boolean,
    NULL::text AS details
  FROM section_04_raw
)
,-- RESULT SET 5: foreign keys that are especially important to later migrations
section_05_raw AS (
WITH expected(table_name, constraint_target_fragment, current_expected_presence,
              target_expected_presence, source_migration) AS (
  VALUES
    ('favorites','FOREIGN KEY (profile_id) REFERENCES character_profiles(id)',NULL,true,'base / 20260925030000'),
    ('favorites','FOREIGN KEY (user_id) REFERENCES users(id)',NULL,true,'20260924000000'),
    ('notifications','FOREIGN KEY (recipient_profile_id) REFERENCES character_profiles(id)',NULL,true,'20260925030000'),
    ('listing_credits','FOREIGN KEY (corporate_profile_id) REFERENCES corporate_profiles(id)',true,true,'20260925040000 CONFIRMED'),
    ('corporate_profiles','FOREIGN KEY (suspended_by_profile_id) REFERENCES character_profiles(id)',true,true,'20260925040000 CONFIRMED'),
    ('corporate_profiles','FOREIGN KEY (deleted_by_profile_id) REFERENCES character_profiles(id)',true,true,'20260925040000 CONFIRMED'),
    ('payments','FOREIGN KEY (corporate_profile_id) REFERENCES corporate_profiles(id)',false,true,'20260926020000 KNOWN NOT APPLIED')
), public_tables AS (
  SELECT cls.oid, cls.relname
  FROM pg_class cls
  JOIN pg_namespace n ON n.oid = cls.relnamespace
  WHERE n.nspname = 'public'
), matches AS (
  SELECT e.*, c.conname, pg_get_constraintdef(c.oid) AS definition
  FROM expected e
  LEFT JOIN public_tables cls ON cls.relname = e.table_name
  LEFT JOIN pg_constraint c ON c.conrelid = cls.oid AND c.contype = 'f'
    AND pg_get_constraintdef(c.oid) ILIKE '%' || e.constraint_target_fragment || '%'
)
SELECT
  'foreign_key'::text AS object_type,
  'public.' || table_name || ': ' || constraint_target_fragment AS object_name,
  CASE WHEN current_expected_presence IS NULL THEN 'UNKNOWN_REQUIRES_AUDIT'
       WHEN current_expected_presence THEN 'PRESENT' ELSE 'ABSENT' END AS current_expected_state,
  concat(CASE WHEN target_expected_presence THEN 'PRESENT' ELSE 'ABSENT' END,
         ', source=', source_migration) AS target_expected_state,
  coalesce(conname || ': ' || definition, 'MISSING') AS actual_state,
  CASE WHEN current_expected_presence IS NULL THEN NULL
       WHEN current_expected_presence THEN conname IS NOT NULL
       ELSE conname IS NULL END AS matches_current_state,
  CASE WHEN target_expected_presence THEN conname IS NOT NULL
       ELSE conname IS NULL END AS matches_target_state
FROM matches
ORDER BY table_name, constraint_target_fragment
),
section_05 AS (
  SELECT
    'RESULT SET 5'::text AS section,
    object_type::text,
    object_name::text,
    current_expected_state::text,
    target_expected_state::text,
    actual_state::text,
    matches_current_state::boolean,
    matches_target_state::boolean,
    NULL::text AS details
  FROM section_05_raw
)
,-- RESULT SET 6: RPC/function existence, signature, security mode and browser execution
section_06_raw AS (
WITH expected(function_name, identity_arguments, current_expected_presence, target_expected_presence,
              expected_security_definer, target_public_execute, target_anon_execute,
              target_authenticated_execute, target_service_role_execute, source_migration) AS (
  VALUES
    ('is_admin','',NULL,true,true,NULL,NULL,NULL,NULL,'20260924010000'),
    ('get_auth_profile_ids','',NULL,true,true,NULL,NULL,NULL,NULL,'20260924010000'),
    ('update_listing_price','uuid, bigint, uuid, uuid, text, text',NULL,true,true,NULL,NULL,NULL,NULL,'20260924020000 / replaced by 20260924060000'),
    ('complete_sanboard_payment','text, text',false,true,true,false,false,false,true,'20260926020000 KNOWN NOT APPLIED'),
    ('republish_listing_with_credit','uuid, uuid',false,true,true,false,false,false,true,'20260926020000 KNOWN NOT APPLIED'),
    ('create_listing_with_credit','uuid, text, uuid, jsonb, jsonb, jsonb',false,true,true,false,false,false,true,'20260926020000 KNOWN NOT APPLIED')
), actual AS (
  SELECT
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS identity_arguments,
    p.prosecdef,
    EXISTS (
      SELECT 1
      FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
      WHERE acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) AS public_execute,
    CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
         THEN has_function_privilege('anon', p.oid, 'EXECUTE') END AS anon_execute,
    CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
         THEN has_function_privilege('authenticated', p.oid, 'EXECUTE') END AS authenticated_execute,
    CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
         THEN has_function_privilege('service_role', p.oid, 'EXECUTE') END AS service_role_execute,
    pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
)
SELECT
  'function'::text AS object_type,
  'public.' || e.function_name || '(' || e.identity_arguments || ')' AS object_name,
  CASE WHEN e.current_expected_presence IS NULL THEN 'UNKNOWN_REQUIRES_AUDIT'
       WHEN e.current_expected_presence THEN 'PRESENT' ELSE 'ABSENT' END AS current_expected_state,
  concat(CASE WHEN e.target_expected_presence THEN 'PRESENT' ELSE 'ABSENT' END,
         ', security_definer=', e.expected_security_definer,
         CASE WHEN e.target_public_execute IS NULL THEN ''
              ELSE concat(', public_execute=', e.target_public_execute,
                          ', anon_execute=', e.target_anon_execute,
                          ', authenticated_execute=', e.target_authenticated_execute,
                          ', service_role_execute=', e.target_service_role_execute) END,
         ', source=', e.source_migration) AS target_expected_state,
  CASE WHEN a.proname IS NULL THEN 'MISSING'
       ELSE concat('security_definer=', a.prosecdef,
                   ', public_execute=', a.public_execute,
                   ', anon_execute=', coalesce(a.anon_execute::text,'role missing'),
                   ', authenticated_execute=', coalesce(a.authenticated_execute::text,'role missing'),
                   ', service_role_execute=', coalesce(a.service_role_execute::text,'role missing')) END AS actual_state,
  CASE WHEN e.current_expected_presence IS NULL THEN NULL
       WHEN e.current_expected_presence THEN a.proname IS NOT NULL
       ELSE a.proname IS NULL END AS matches_current_state,
  CASE WHEN e.target_expected_presence
       THEN a.proname IS NOT NULL
        AND a.prosecdef = e.expected_security_definer
        AND (e.target_public_execute IS NULL OR a.public_execute IS NOT DISTINCT FROM e.target_public_execute)
        AND (e.target_anon_execute IS NULL OR a.anon_execute IS NOT DISTINCT FROM e.target_anon_execute)
        AND (e.target_authenticated_execute IS NULL OR a.authenticated_execute IS NOT DISTINCT FROM e.target_authenticated_execute)
        AND (e.target_service_role_execute IS NULL OR a.service_role_execute IS NOT DISTINCT FROM e.target_service_role_execute)
       ELSE a.proname IS NULL END AS matches_target_state,
  a.definition AS actual_definition
FROM expected e
LEFT JOIN actual a
  ON a.proname = e.function_name AND a.identity_arguments = e.identity_arguments
ORDER BY e.function_name
),
section_06 AS (
  SELECT
    'RESULT SET 6'::text AS section,
    object_type::text,
    object_name::text,
    current_expected_state::text,
    target_expected_state::text,
    actual_state::text,
    matches_current_state::boolean,
    matches_target_state::boolean,
    actual_definition::text AS details
  FROM section_06_raw
)
,-- RESULT SET 7: RLS enabled state
section_07_raw AS (
WITH expected(table_name) AS (
  VALUES ('users'),('character_profiles'),('corporate_profiles'),('corporate_applications'),
         ('packages'),('payments'),('listing_credits'),('listings'),('vehicle_details'),
         ('property_details'),('listing_images'),('favorites'),('reports'),('support_tickets'),
         ('ticket_messages'),('sold_listing_audit'),('listing_price_history'),('notifications'),
         ('audit_logs'),('media_cleanup_jobs'),('corporate_followers')
), public_tables AS (
  SELECT c.oid, c.relname, c.relrowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
)
SELECT
  'rls'::text AS object_type,
  'public.' || e.table_name AS object_name,
  'RLS enabled'::text AS expected_state,
  CASE WHEN c.oid IS NULL THEN 'TABLE MISSING' ELSE 'rowsecurity=' || c.relrowsecurity END AS actual_state,
  coalesce(c.relrowsecurity, false) AS matches_expected
FROM expected e
LEFT JOIN public_tables c ON c.relname = e.table_name
ORDER BY e.table_name
),
section_07 AS (
  SELECT
    'RESULT SET 7'::text AS section,
    object_type::text,
    object_name::text,
    NULL::text AS current_expected_state,
    expected_state::text AS target_expected_state,
    actual_state::text,
    NULL::boolean AS matches_current_state,
    matches_expected::boolean AS matches_target_state,
    NULL::text AS details
  FROM section_07_raw
)
,-- RESULT SET 8: policies and their current definitions
section_08_raw AS (
SELECT
  'policy'::text AS object_type,
  schemaname || '.' || tablename || '.' || policyname AS object_name,
  concat('command=', cmd, ', roles=', array_to_string(roles, ',')) AS expected_state,
  concat('permissive=', permissive, ', using=', coalesce(qual,'NULL'), ', check=', coalesce(with_check,'NULL')) AS actual_state,
  true AS matches_expected
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname
),
section_08 AS (
  SELECT
    'RESULT SET 8'::text AS section,
    object_type::text,
    object_name::text,
    NULL::text AS current_expected_state,
    expected_state::text AS target_expected_state,
    actual_state::text,
    NULL::boolean AS matches_current_state,
    matches_expected::boolean AS matches_target_state,
    NULL::text AS details
  FROM section_08_raw
)
,-- RESULT SET 9: triggers. Local project migrations define no application triggers.
section_09_raw AS (
SELECT
  'trigger'::text AS object_type,
  event_object_schema || '.' || event_object_table || '.' || trigger_name AS object_name,
  'No project trigger expected; review unexpected triggers manually'::text AS expected_state,
  concat(action_timing, ' ', event_manipulation, ' -> ', action_statement) AS actual_state,
  false AS matches_expected
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name
),
section_09 AS (
  SELECT
    'RESULT SET 9'::text AS section,
    object_type::text,
    object_name::text,
    NULL::text AS current_expected_state,
    expected_state::text AS target_expected_state,
    actual_state::text,
    NULL::boolean AS matches_current_state,
    matches_expected::boolean AS matches_target_state,
    NULL::text AS details
  FROM section_09_raw
)
,-- RESULT SET 10: package rows required by current application code
section_10_raw AS (
WITH expected(code, expected_seller_type) AS (
  VALUES
    ('STANDARD_7_DAY','INDIVIDUAL'),
    ('CORPORATE_14_DAY','CORPORATE'),
    ('CORPORATE_SUBSCRIPTION_30_DAY','CORPORATE')
)
SELECT
  'package_data'::text AS object_type,
  e.code AS object_name,
  'row exists, active=true, seller_type=' || e.expected_seller_type AS expected_state,
  CASE WHEN p.id IS NULL THEN 'MISSING'
       ELSE concat('id=',p.id,', price=',p.price,', duration_days=',p.duration_days,
                   ', active=',p.active,', seller_type=',coalesce(to_jsonb(p)->>'seller_type','COLUMN MISSING/NULL')) END AS actual_state,
  (p.id IS NOT NULL AND p.active AND to_jsonb(p)->>'seller_type' = e.expected_seller_type) AS matches_expected
FROM expected e
LEFT JOIN public.packages p ON p.code = e.code
ORDER BY e.code
),
section_10 AS (
  SELECT
    'RESULT SET 10'::text AS section,
    object_type::text,
    object_name::text,
    NULL::text AS current_expected_state,
    expected_state::text AS target_expected_state,
    actual_state::text,
    NULL::boolean AS matches_current_state,
    matches_expected::boolean AS matches_target_state,
    NULL::text AS details
  FROM section_10_raw
)
,-- RESULT SET 11: duplicate/conflict preflight. Any returned row requires manual review.
section_11_raw AS (
SELECT 'favorites_profile_listing_duplicate'::text AS object_type,
       profile_id::text AS object_name,
       listing_id::text AS expected_state,
       count(*)::text AS actual_state,
       false AS matches_expected
FROM public.favorites
WHERE profile_id IS NOT NULL
GROUP BY profile_id, listing_id
HAVING count(*) > 1
UNION ALL
SELECT 'corporate_active_owner_duplicate', owner_profile_id::text, 'one usable store', count(*)::text, false
FROM public.corporate_profiles
WHERE owner_profile_id IS NOT NULL
  AND deleted_at IS NULL
  AND moderation_status <> 'DELETED'
GROUP BY owner_profile_id
HAVING count(*) > 1
UNION ALL
SELECT 'payment_external_id_duplicate', external_payment_id, 'unique non-null external ID', count(*)::text, false
FROM public.payments
WHERE external_payment_id IS NOT NULL
GROUP BY external_payment_id
HAVING count(*) > 1
UNION ALL
SELECT 'listing_credit_payment_duplicate', payment_id::text, 'one credit per payment', count(*)::text, false
FROM public.listing_credits
GROUP BY payment_id
HAVING count(*) > 1
ORDER BY object_type, object_name
),
section_11 AS (
  SELECT
    'RESULT SET 11'::text AS section,
    object_type::text,
    object_name::text,
    NULL::text AS current_expected_state,
    expected_state::text AS target_expected_state,
    actual_state::text,
    NULL::boolean AS matches_current_state,
    matches_expected::boolean AS matches_target_state,
    NULL::text AS details
  FROM section_11_raw
)
,-- RESULT SET 12: whether a Supabase CLI migration ledger is available.
section_12_raw AS (
-- If it exists, export it separately after this audit; avoiding a direct reference
-- keeps this single script safe on databases where the ledger schema is absent.
SELECT
  'migration_ledger'::text AS object_type,
  'supabase_migrations.schema_migrations'::text AS object_name,
  'table presence only; ledger entries must not be treated as schema proof'::text AS expected_state,
  coalesce(to_regclass('supabase_migrations.schema_migrations')::text, 'MISSING') AS actual_state,
  (to_regclass('supabase_migrations.schema_migrations') IS NOT NULL) AS matches_expected
),
section_12 AS (
  SELECT
    'RESULT SET 12'::text AS section,
    object_type::text,
    object_name::text,
    NULL::text AS current_expected_state,
    expected_state::text AS target_expected_state,
    actual_state::text,
    NULL::boolean AS matches_current_state,
    matches_expected::boolean AS matches_target_state,
    NULL::text AS details
  FROM section_12_raw
)
SELECT
  section,
      object_type,
      object_name,
      current_expected_state,
      target_expected_state,
      actual_state,
      matches_current_state,
      matches_target_state,
      details
FROM (
  SELECT * FROM section_01
  UNION ALL
  SELECT * FROM section_02
  UNION ALL
  SELECT * FROM section_03
  UNION ALL
  SELECT * FROM section_04
  UNION ALL
  SELECT * FROM section_05
  UNION ALL
  SELECT * FROM section_06
  UNION ALL
  SELECT * FROM section_07
  UNION ALL
  SELECT * FROM section_08
  UNION ALL
  SELECT * FROM section_09
  UNION ALL
  SELECT * FROM section_10
  UNION ALL
  SELECT * FROM section_11
  UNION ALL
  SELECT * FROM section_12
) audit_results
ORDER BY
  split_part(section, ' ', 3)::integer,
  object_type,
  object_name;
