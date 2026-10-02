-- Atomic corporate application review and admin-only subscription grants.
-- Prepared as a forward-only migration. Do not apply automatically.
BEGIN;

CREATE OR REPLACE FUNCTION public.review_corporate_application(
  p_application_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL,
  p_reviewer_user_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application public.corporate_applications%ROWTYPE;
  v_profile public.character_profiles%ROWTYPE;
  v_store public.corporate_profiles%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_reason TEXT;
  v_slug_base TEXT;
  v_slug TEXT;
BEGIN
  IF p_status NOT IN ('APPROVED', 'REJECTED') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Geçersiz başvuru durumu.');
  END IF;

  SELECT * INTO v_application
  FROM public.corporate_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Başvuru bulunamadı.');
  END IF;
  IF v_application.status <> 'PENDING' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Başvuru daha önce değerlendirilmiş.');
  END IF;

  SELECT * INTO v_profile
  FROM public.character_profiles
  WHERE id = v_application.applicant_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Başvuru sahibi karakter bulunamadı.');
  END IF;

  IF p_status = 'APPROVED' THEN
    SELECT * INTO v_store
    FROM public.corporate_profiles
    WHERE owner_profile_id = v_profile.id
      AND deleted_at IS NULL
      AND moderation_status <> 'DELETED'
    FOR UPDATE;

    IF FOUND THEN
      RETURN jsonb_build_object('success', FALSE, 'error', 'Bu karakterin zaten onaylanmış bir kurumsal mağazası bulunmaktadır.');
    END IF;

    v_slug_base := trim(BOTH '-' FROM regexp_replace(
      translate(lower(v_application.company_name), 'çğıöşü', 'cgiosu'),
      '[^a-z0-9]+', '-', 'g'
    ));
    IF v_slug_base = '' THEN v_slug_base := 'kurumsal-magaza'; END IF;
    v_slug := v_slug_base || '-' || left(replace(p_application_id::TEXT, '-', ''), 8);

    INSERT INTO public.corporate_profiles (
      owner_profile_id, company_name, slug, description, phone, email, address,
      status, subscription_status, subscription_expires_at,
      current_period_start, current_period_end,
      moderation_status, boost_credits, created_at, updated_at
    ) VALUES (
      v_profile.id, v_application.company_name, v_slug, v_application.purpose,
      v_application.contact_phone, v_application.contact_email, v_application.location,
      'APPROVED', 'INACTIVE', NULL, NULL, NULL, 'ACTIVE', 0, v_now, v_now
    ) RETURNING * INTO v_store;

    UPDATE public.corporate_applications
    SET status = 'APPROVED', rejection_reason = NULL,
        reviewed_by = p_reviewer_user_id, reviewed_at = v_now
    WHERE id = v_application.id;

    UPDATE public.character_profiles
    SET is_dealer = TRUE, dealer_id = v_store.id, updated_at = v_now
    WHERE id = v_profile.id;

    INSERT INTO public.notifications (
      recipient_profile_id, user_id, type, title, message,
      entity_type, entity_id, metadata, created_at
    ) VALUES (
      v_profile.id, v_profile.user_id, 'CORPORATE_APPLICATION_APPROVED',
      'Kurumsal Profiliniz Onaylandı',
      format('"%s" adına yaptığınız kurumsal satış başvurusu onaylanmıştır. Kurumsal panelden üyeliğinizi aktif ederek avantajlardan yararlanabilirsiniz.', v_application.company_name),
      'application', v_application.id, jsonb_build_object('corporateProfileId', v_store.id), v_now
    );

    RETURN jsonb_build_object('success', TRUE, 'corporate_profile_id', v_store.id);
  END IF;

  v_reason := NULLIF(trim(p_rejection_reason), '');
  IF v_reason IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Red gerekçesi zorunludur.');
  END IF;

  UPDATE public.corporate_applications
  SET status = 'REJECTED', rejection_reason = v_reason,
      reviewed_by = p_reviewer_user_id, reviewed_at = v_now
  WHERE id = v_application.id;

  INSERT INTO public.notifications (
    recipient_profile_id, user_id, type, title, message,
    entity_type, entity_id, created_at
  ) VALUES (
    v_profile.id, v_profile.user_id, 'CORPORATE_APPLICATION_REJECTED',
    'Kurumsal Başvurunuz Reddedildi',
    format('Kurumsal hesap başvurunuz reddedildi. Neden: %s', v_reason),
    'application', v_application.id, v_now
  );

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_corporate_subscription(
  p_corporate_profile_id UUID,
  p_admin_profile_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store public.corporate_profiles%ROWTYPE;
  v_owner public.character_profiles%ROWTYPE;
  v_admin public.character_profiles%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_expiry TIMESTAMPTZ;
  v_previous_status TEXT;
BEGIN
  SELECT * INTO v_admin
  FROM public.character_profiles
  WHERE id = p_admin_profile_id AND role = 'ADMIN';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Yönetici yetkisi doğrulanamadı.');
  END IF;

  SELECT * INTO v_store
  FROM public.corporate_profiles
  WHERE id = p_corporate_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Kurumsal mağaza bulunamadı.');
  END IF;
  IF v_store.status <> 'APPROVED' OR v_store.moderation_status = 'DELETED' OR v_store.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Kurumsal mağaza üyelik aktivasyonu için uygun değil.');
  END IF;
  IF v_store.subscription_status = 'ACTIVE'
     AND v_store.subscription_expires_at IS NOT NULL
     AND v_store.subscription_expires_at > v_now THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Kurumsal üyelik zaten aktif.');
  END IF;

  v_previous_status := COALESCE(v_store.subscription_status, 'INACTIVE');
  v_expiry := v_now + INTERVAL '1 month';

  UPDATE public.corporate_profiles
  SET subscription_status = 'ACTIVE',
      subscription_expires_at = v_expiry,
      current_period_start = v_now,
      current_period_end = v_expiry,
      boost_credits = 3,
      updated_at = v_now
  WHERE id = v_store.id
  RETURNING * INTO v_store;

  SELECT * INTO v_owner FROM public.character_profiles WHERE id = v_store.owner_profile_id;
  IF FOUND THEN
    INSERT INTO public.notifications (
      recipient_profile_id, user_id, type, title, message,
      entity_type, entity_id, metadata, created_at
    ) VALUES (
      v_owner.id, v_owner.user_id, 'SYSTEM',
      'Kurumsal üyeliğiniz aktifleştirildi',
      'Kurumsal üyeliğiniz yönetim tarafından aktifleştirildi.',
      'system', v_store.id, jsonb_build_object('source', 'ADMIN_GRANT'), v_now
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'dealer', to_jsonb(v_store),
    'previous_status', v_previous_status,
    'activated_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_corporate_application(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_corporate_application(UUID, TEXT, TEXT, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.grant_corporate_subscription(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_corporate_subscription(UUID, UUID) TO service_role;

COMMIT;