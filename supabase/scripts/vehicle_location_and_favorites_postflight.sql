-- READ-ONLY POSTFLIGHT
-- Run after the account-level favorites / price RPC reconciliation migration.

WITH function_meta AS (
    SELECT
        p.oid,
        p.prosecdef,
        pg_get_functiondef(p.oid) AS definition,
        array_to_string(p.proconfig, ',') AS config
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.oid = to_regprocedure(
          'public.update_listing_price(uuid,bigint,uuid,uuid,text,text)'
      )
), checks AS (
    SELECT 1 AS check_no, 'listings.location nullable' AS check_name,
           EXISTS (
               SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'listings'
                 AND column_name = 'location' AND is_nullable = 'YES'
           ) AS passed
    UNION ALL
    SELECT 2, 'listings.price BIGINT', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'listings'
          AND column_name = 'price' AND data_type = 'bigint'
    )
    UNION ALL
    SELECT 3, 'listing_price_history.old_price BIGINT', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'listing_price_history'
          AND column_name = 'old_price' AND data_type = 'bigint'
    )
    UNION ALL
    SELECT 4, 'listing_price_history.new_price BIGINT', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'listing_price_history'
          AND column_name = 'new_price' AND data_type = 'bigint'
    )
    UNION ALL
    SELECT 5, 'favorites.user_id exists', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'favorites'
          AND column_name = 'user_id'
    )
    UNION ALL
    SELECT 6, 'favorites.user_id NOT NULL', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'favorites'
          AND column_name = 'user_id' AND is_nullable = 'NO'
    )
    UNION ALL
    SELECT 7, 'favorites.profile_id nullable', EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'favorites'
          AND column_name = 'profile_id' AND is_nullable = 'YES'
    )
    UNION ALL
    SELECT 8, 'UNIQUE(user_id, listing_id) exists', EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conrelid = 'public.favorites'::regclass
          AND c.contype = 'u'
          AND ARRAY(
              SELECT a.attname
              FROM unnest(c.conkey) WITH ORDINALITY AS key(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = c.conrelid AND a.attnum = key.attnum
              ORDER BY key.ord
          ) = ARRAY['user_id', 'listing_id']::name[]
    )
    UNION ALL
    SELECT 9, 'legacy UNIQUE(profile_id, listing_id) absent', NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = 'public.favorites'::regclass
          AND i.indisunique
          AND i.indnkeyatts = 2
          AND ARRAY(
              SELECT a.attname
              FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS key(attnum, ord)
              JOIN pg_attribute a
                ON a.attrelid = i.indrelid AND a.attnum = key.attnum
              WHERE key.ord <= i.indnkeyatts
              ORDER BY key.ord
          ) = ARRAY['profile_id', 'listing_id']::name[]
    )
    UNION ALL
    SELECT 10, 'no duplicate (user_id, listing_id)', NOT EXISTS (
        SELECT 1 FROM public.favorites
        GROUP BY user_id, listing_id HAVING COUNT(*) > 1
    )
    UNION ALL
    SELECT 11, 'idx_favorites_user_id exists', to_regclass('public.idx_favorites_user_id') IS NOT NULL
    UNION ALL
    SELECT 12, 'idx_favorites_listing_id exists', to_regclass('public.idx_favorites_listing_id') IS NOT NULL
    UNION ALL
    SELECT 13, 'canonical update_listing_price signature exists',
           to_regprocedure('public.update_listing_price(uuid,bigint,uuid,uuid,text,text)') IS NOT NULL
    UNION ALL
    SELECT 14, 'RPC uses FOR UPDATE', EXISTS (
        SELECT 1 FROM function_meta WHERE definition ~* 'FOR[[:space:]]+UPDATE'
    )
    UNION ALL
    SELECT 15, 'RPC guards SOLD / REMOVED', EXISTS (
        SELECT 1 FROM function_meta
        WHERE definition ~* 'status[[:space:]]+IN[[:space:]]*\(' AND definition LIKE '%SOLD%' AND definition LIKE '%REMOVED%'
    )
    UNION ALL
    SELECT 16, 'RPC rejects p_new_price <= 0', EXISTS (
        SELECT 1 FROM function_meta WHERE definition ~* 'p_new_price[[:space:]]*<=[[:space:]]*0'
    )
    UNION ALL
    SELECT 17, 'price history requires valid real change', EXISTS (
        SELECT 1 FROM function_meta
        WHERE definition ~* 'p_new_price[[:space:]]+IS[[:space:]]+NOT[[:space:]]+NULL'
          AND definition ~* 'p_new_price[[:space:]]*>[[:space:]]*0'
          AND definition ~* 'p_new_price[[:space:]]*<>[[:space:]]*v_old_price'
    )
    UNION ALL
    SELECT 18, 'price-drop notification is decrease-only', EXISTS (
        SELECT 1 FROM function_meta
        WHERE definition ~* 'IF[[:space:]]+p_new_price[[:space:]]*<[[:space:]]*v_old_price'
          AND definition LIKE '%LISTING_PRICE_DROP%'
    )
    UNION ALL
    SELECT 19, 'seller account resolves through character_profiles.user_id', EXISTS (
        SELECT 1 FROM function_meta
        WHERE definition LIKE '%FROM public.character_profiles cp%'
          AND definition LIKE '%cp.user_id%'
          AND definition LIKE '%v_existing.seller_profile_id%'
    )
    UNION ALL
    SELECT 20, 'admin resolves through public.users', EXISTS (
        SELECT 1 FROM function_meta WHERE definition LIKE '%FROM public.users u%'
    )
    UNION ALL
    SELECT 21, 'admin requires ACTIVE status', EXISTS (
        SELECT 1 FROM function_meta
        WHERE definition LIKE '%u.role = ''ADMIN''%' AND definition LIKE '%u.status = ''ACTIVE''%'
    )
    UNION ALL
    SELECT 22, 'favorite recipients use favorites.user_id', EXISTS (
        SELECT 1 FROM function_meta
        WHERE definition LIKE '%SELECT DISTINCT f.user_id%'
          AND definition LIKE '%FROM public.favorites f%'
    )
    UNION ALL
    SELECT 23, 'favorite recipient query does not use profile_id', EXISTS (
        SELECT 1 FROM function_meta
        WHERE definition LIKE '%SELECT DISTINCT f.user_id%'
          AND definition NOT LIKE '%f.profile_id%'
    )
    UNION ALL
    SELECT 24, 'seller user_id excluded from recipients', EXISTS (
        SELECT 1 FROM function_meta WHERE definition LIKE '%f.user_id <> v_seller_user_id%'
    )
    UNION ALL
    SELECT 25, 'vehicle update keeps location NULL', EXISTS (
        SELECT 1 FROM function_meta
        WHERE definition LIKE '%CASE WHEN category = ''vehicle'' THEN NULL ELSE location END%'
    )
    UNION ALL
    SELECT 26, 'RPC is SECURITY DEFINER', EXISTS (
        SELECT 1 FROM function_meta WHERE prosecdef
    )
    UNION ALL
    SELECT 27, 'RPC search_path is public, pg_temp', EXISTS (
        SELECT 1 FROM function_meta WHERE config = 'search_path=public, pg_temp'
    )
    UNION ALL
    SELECT 28, 'service_role execute TRUE', has_function_privilege(
        'service_role', 'public.update_listing_price(uuid,bigint,uuid,uuid,text,text)', 'EXECUTE'
    )
    UNION ALL
    SELECT 29, 'anon execute FALSE', NOT has_function_privilege(
        'anon', 'public.update_listing_price(uuid,bigint,uuid,uuid,text,text)', 'EXECUTE'
    )
    UNION ALL
    SELECT 30, 'authenticated execute FALSE', NOT has_function_privilege(
        'authenticated', 'public.update_listing_price(uuid,bigint,uuid,uuid,text,text)', 'EXECUTE'
    )
    UNION ALL
    SELECT 31, 'favorites SELECT policy is account-level', EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'favorites'
          AND policyname = 'Users can view own favorites'
          AND cmd = 'SELECT' AND qual LIKE '%user_id = auth.uid()%'
    )
    UNION ALL
    SELECT 32, 'favorites INSERT policy is account-level', EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'favorites'
          AND policyname = 'Users can insert own favorites'
          AND cmd = 'INSERT' AND with_check LIKE '%user_id = auth.uid()%'
    )
    UNION ALL
    SELECT 33, 'favorites DELETE policy is account-level', EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'favorites'
          AND policyname = 'Users can delete own favorites'
          AND cmd = 'DELETE' AND qual LIKE '%user_id = auth.uid()%'
    )
    UNION ALL
    SELECT 34, 'favorites.user_id FK cascades to users(id)', EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'public.favorites'::regclass
          AND c.contype = 'f' AND a.attname = 'user_id'
          AND c.confrelid = 'public.users'::regclass AND c.confdeltype = 'c'
    )
)
SELECT
    check_no,
    check_name,
    CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result
FROM checks
ORDER BY check_no;