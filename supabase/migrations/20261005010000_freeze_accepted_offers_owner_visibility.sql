BEGIN;

-- Forward-only correction for the already-deployed freeze/resume lifecycle.
-- Public visibility remains ACTIVE + unexpired, while authenticated individual
-- and corporate owners retain management access to every status, including FROZEN.
DROP POLICY IF EXISTS "Listings select policy" ON public.listings;
CREATE POLICY "Listings select policy" ON public.listings
  FOR SELECT
  USING (
    (status = 'ACTIVE' AND expires_at > NOW())
    OR seller_profile_id IN (SELECT public.get_auth_profile_ids())
    OR corporate_profile_id IN (
      SELECT id
      FROM public.corporate_profiles
      WHERE owner_profile_id IN (SELECT public.get_auth_profile_ids())
    )
    OR public.is_admin()
  );

-- Keep the deployed canonical lifecycle as the single transition path. The
-- only business-rule change is that ACCEPTED offers no longer block FREEZE.
CREATE OR REPLACE FUNCTION public.transition_listing_freeze_state(
  p_listing_id UUID,
  p_actor_profile_id UUID,
  p_actor_user_id UUID,
  p_action TEXT,
  p_source TEXT DEFAULT 'OWNER'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  l public.listings%ROWTYPE;
  owner_id UUID;
  store public.corporate_profiles%ROWTYPE;
  at TIMESTAMPTZ := NOW();
  remaining_listing BIGINT;
  remaining_boost BIGINT;
  old_expires TIMESTAMPTZ;
  old_boost_expires TIMESTAMPTZ;
  new_expires TIMESTAMPTZ;
  new_boost_expires TIMESTAMPTZ;
  retry_after INTEGER;
BEGIN
  IF p_action NOT IN ('FREEZE','RESUME') OR p_source NOT IN ('OWNER','ADMIN','MEMBERSHIP') THEN
    RETURN jsonb_build_object('success',false,'code','INVALID_ACTION','error','Geçersiz ilan geçişi.');
  END IF;
  SELECT * INTO l FROM public.listings WHERE id=p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'code','NOT_FOUND','error','İlan bulunamadı.'); END IF;

  IF l.seller_type='CORPORATE' THEN
    SELECT * INTO store FROM public.corporate_profiles WHERE id=l.corporate_profile_id;
    owner_id := store.owner_profile_id;
  ELSE owner_id := l.seller_profile_id;
  END IF;
  IF p_source='MEMBERSHIP' AND l.seller_type<>'CORPORATE' THEN
    RETURN jsonb_build_object('success',false,'code','INVALID_LISTING_STATE','error','Üyelik geçişi yalnızca kurumsal ilanlara uygulanabilir.');
  END IF;
  IF p_source NOT IN ('ADMIN','MEMBERSHIP') AND owner_id IS DISTINCT FROM p_actor_profile_id THEN
    RETURN jsonb_build_object('success',false,'code','FORBIDDEN','error','Bu işlem için yetkiniz yok.');
  END IF;

  IF (p_action='FREEZE' AND l.status='FROZEN') OR (p_action='RESUME' AND l.status='ACTIVE') THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'listingId',l.id,'status',l.status,'frozenAt',l.frozen_at,
      'remainingListingSeconds',l.remaining_listing_seconds,'remainingBoostSeconds',l.remaining_boost_seconds,
      'expiresAt',l.expires_at,'boostExpiresAt',l.featured_until,
      'cooldownUntil',CASE WHEN l.last_freeze_transition_at IS NULL THEN NULL ELSE l.last_freeze_transition_at+INTERVAL '60 seconds' END);
  END IF;
  IF p_source<>'MEMBERSHIP' AND l.last_freeze_transition_at IS NOT NULL AND l.last_freeze_transition_at+INTERVAL '60 seconds'>at THEN
    retry_after := GREATEST(1,CEIL(EXTRACT(EPOCH FROM (l.last_freeze_transition_at+INTERVAL '60 seconds'-at)))::INTEGER);
    RETURN jsonb_build_object('success',false,'code','LISTING_TRANSITION_COOLDOWN','error','İlan durumu yeniden değiştirilmeden önce kısa bir süre beklemelisiniz.','retryAfterSeconds',retry_after);
  END IF;

  old_expires := l.expires_at; old_boost_expires := l.featured_until;
  IF p_action='FREEZE' THEN
    IF l.status<>'ACTIVE' THEN RETURN jsonb_build_object('success',false,'code','INVALID_LISTING_STATE','error','Yalnızca aktif ilanlar dondurulabilir.'); END IF;
    IF l.expires_at IS NULL OR l.expires_at<=at THEN RETURN jsonb_build_object('success',false,'code','LISTING_ALREADY_EXPIRED','error','Süresi dolmuş ilan dondurulamaz.'); END IF;
    remaining_listing := GREATEST(0,CEIL(EXTRACT(EPOCH FROM (l.expires_at-at)))::BIGINT);
    IF remaining_listing<=0 THEN RETURN jsonb_build_object('success',false,'code','LISTING_ALREADY_EXPIRED','error','Süresi dolmuş ilan dondurulamaz.'); END IF;
    remaining_boost := CASE WHEN l.is_featured AND l.featured_until>at THEN GREATEST(0,CEIL(EXTRACT(EPOCH FROM (l.featured_until-at)))::BIGINT) ELSE 0 END;
    UPDATE public.listings SET status='FROZEN',frozen_at=at,remaining_listing_seconds=remaining_listing,freeze_source=p_source,
      remaining_boost_seconds=remaining_boost,last_freeze_transition_at=at,freeze_count=freeze_count+1,
      is_featured=false,featured_until=NULL,updated_at=at WHERE id=l.id RETURNING * INTO l;
    INSERT INTO public.audit_logs(event_type,user_id,profile_id,metadata,created_at) VALUES(
      'LISTING_FROZEN',p_actor_user_id,p_actor_profile_id,jsonb_build_object('listing_id',l.id,'actor_profile_id',p_actor_profile_id,
      'actor_user_id',p_actor_user_id,'previous_status','ACTIVE','new_status','FROZEN','frozen_at',at,
      'remaining_listing_seconds',remaining_listing,'remaining_boost_seconds',remaining_boost,'previous_expires_at',old_expires,
      'new_expires_at',old_expires,'previous_boost_expires_at',old_boost_expires,'new_boost_expires_at',NULL,'source',p_source),at);
  ELSE
    IF l.status<>'FROZEN' THEN RETURN jsonb_build_object('success',false,'code','INVALID_LISTING_STATE','error','Yalnızca dondurulmuş ilanlar yeniden aktif edilebilir.'); END IF;
    IF COALESCE(l.remaining_listing_seconds,0)<=0 THEN RETURN jsonb_build_object('success',false,'code','LISTING_ALREADY_EXPIRED','error','Kalan süresi olmayan ilan yeniden aktif edilemez.'); END IF;
    IF l.seller_type='CORPORATE' AND (store.id IS NULL OR store.status<>'APPROVED' OR store.moderation_status<>'ACTIVE' OR store.deleted_at IS NOT NULL OR store.subscription_status<>'ACTIVE' OR store.subscription_expires_at IS NULL OR store.subscription_expires_at<=at) THEN
      RETURN jsonb_build_object('success',false,'code','CORPORATE_SUBSCRIPTION_REQUIRED','error','İlanı yeniden aktifleştirmek için kurumsal üyeliğiniz aktif olmalıdır.');
    END IF;
    new_expires := at + make_interval(secs=>l.remaining_listing_seconds::DOUBLE PRECISION);
    new_boost_expires := CASE WHEN COALESCE(l.remaining_boost_seconds,0)>0 THEN at+make_interval(secs=>l.remaining_boost_seconds::DOUBLE PRECISION) ELSE NULL END;
    UPDATE public.listings SET status='ACTIVE',frozen_at=NULL,freeze_source=NULL,expires_at=new_expires,
      is_featured=(new_boost_expires IS NOT NULL),featured_until=new_boost_expires,
      last_freeze_transition_at=at,resume_count=resume_count+1,updated_at=at WHERE id=l.id RETURNING * INTO l;
    INSERT INTO public.audit_logs(event_type,user_id,profile_id,metadata,created_at) VALUES(
      'LISTING_RESUMED',p_actor_user_id,p_actor_profile_id,jsonb_build_object('listing_id',l.id,'actor_profile_id',p_actor_profile_id,
      'actor_user_id',p_actor_user_id,'previous_status','FROZEN','new_status','ACTIVE','resumed_at',at,
      'remaining_listing_seconds',l.remaining_listing_seconds,'remaining_boost_seconds',l.remaining_boost_seconds,
      'previous_expires_at',old_expires,'new_expires_at',new_expires,'previous_boost_expires_at',old_boost_expires,
      'new_boost_expires_at',new_boost_expires,'source',p_source),at);
  END IF;
  RETURN jsonb_build_object('success',true,'listingId',l.id,'status',l.status,'frozenAt',l.frozen_at,
    'remainingListingSeconds',l.remaining_listing_seconds,'remainingBoostSeconds',l.remaining_boost_seconds,
    'expiresAt',l.expires_at,'boostExpiresAt',l.featured_until,'cooldownUntil',at+INTERVAL '60 seconds');
END $$;

REVOKE ALL ON FUNCTION public.transition_listing_freeze_state(UUID,UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transition_listing_freeze_state(UUID,UUID,UUID,TEXT,TEXT) TO service_role;

-- Membership expiry already calls transition_corporate_membership_listings(),
-- which delegates every eligible row to the canonical function above. With the
-- accepted-offer guard removed, no accepted-offer-specific deferral remains.

COMMIT;