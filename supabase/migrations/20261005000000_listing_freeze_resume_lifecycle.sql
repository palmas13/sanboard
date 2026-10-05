BEGIN;

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('DRAFT','ACTIVE','FROZEN','EXPIRED','SOLD','REMOVED'));

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS remaining_listing_seconds BIGINT,
  ADD COLUMN IF NOT EXISTS remaining_boost_seconds BIGINT,
  ADD COLUMN IF NOT EXISTS freeze_source TEXT,
  ADD COLUMN IF NOT EXISTS last_freeze_transition_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS freeze_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resume_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS chk_listings_freeze_durations;
ALTER TABLE public.listings ADD CONSTRAINT chk_listings_freeze_durations CHECK (
  (remaining_listing_seconds IS NULL OR remaining_listing_seconds >= 0) AND
  (remaining_boost_seconds IS NULL OR remaining_boost_seconds >= 0) AND
  freeze_count >= 0 AND resume_count >= 0
);

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS chk_listings_freeze_source;
ALTER TABLE public.listings ADD CONSTRAINT chk_listings_freeze_source CHECK (
  freeze_source IS NULL OR freeze_source IN ('OWNER','ADMIN','MEMBERSHIP')
);

CREATE INDEX IF NOT EXISTS idx_listings_frozen_owner ON public.listings(seller_profile_id, frozen_at DESC) WHERE status='FROZEN';

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
    IF EXISTS(SELECT 1 FROM public.offer_threads WHERE listing_id=l.id AND status='ACCEPTED') THEN
      RETURN jsonb_build_object('success',false,'code','INVALID_LISTING_STATE','error','Kabul edilmiş teklifi bulunan ilan dondurulamaz.');
    END IF;
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

CREATE OR REPLACE FUNCTION public.transition_corporate_membership_listings(
  p_corporate_profile_id UUID,
  p_action TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  store public.corporate_profiles%ROWTYPE;
  owner_user_id UUID;
  listing_row RECORD;
  transition_result JSONB;
  transitioned BIGINT := 0;
BEGIN
  IF p_action NOT IN ('FREEZE','RESUME') THEN
    RAISE EXCEPTION 'Unsupported corporate membership listing transition: %', p_action;
  END IF;
  SELECT * INTO store FROM public.corporate_profiles WHERE id=p_corporate_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Corporate profile not found: %', p_corporate_profile_id; END IF;
  SELECT user_id INTO owner_user_id FROM public.character_profiles WHERE id=store.owner_profile_id;

  FOR listing_row IN
    SELECT id FROM public.listings
    WHERE seller_type='CORPORATE'
      AND corporate_profile_id=store.id
      AND ((p_action='FREEZE' AND status='ACTIVE' AND expires_at IS NOT NULL AND expires_at>NOW())
        OR (p_action='RESUME' AND status='FROZEN' AND freeze_source='MEMBERSHIP'))
    ORDER BY id
    FOR UPDATE
  LOOP
    transition_result := public.transition_listing_freeze_state(
      listing_row.id,store.owner_profile_id,owner_user_id,p_action,'MEMBERSHIP'
    );
    IF NOT COALESCE((transition_result->>'success')::BOOLEAN,FALSE) THEN
      RAISE EXCEPTION 'Corporate membership listing transition failed for %: %', listing_row.id, transition_result;
    END IF;
    transitioned := transitioned + 1;
  END LOOP;
  RETURN jsonb_build_object('success',TRUE,'action',p_action,'transitioned_listings',transitioned);
END $$;

REVOKE ALL ON FUNCTION public.transition_corporate_membership_listings(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transition_corporate_membership_listings(UUID,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.run_expiry_lifecycle() RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE at TIMESTAMPTZ:=NOW(); l RECORD; store RECORD; expired_listings BIGINT:=0; expired_subscriptions BIGINT:=0; blocked_subscriptions BIGINT:=0; frozen_membership_listings BIGINT:=0; closed_offers BIGINT:=0; c BIGINT:=0; transition_result JSONB;
BEGIN
  FOR l IN SELECT id FROM public.listings WHERE status='ACTIVE' AND expires_at IS NOT NULL AND expires_at<=at ORDER BY expires_at,id FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.listings SET status='EXPIRED',is_featured=false,featured_until=NULL,updated_at=at WHERE id=l.id AND status='ACTIVE' AND expires_at<=at;
    GET DIAGNOSTICS c=ROW_COUNT; IF c=1 THEN expired_listings:=expired_listings+1; SELECT public.close_offers_for_listing(l.id,'LISTING_EXPIRED') INTO c; closed_offers:=closed_offers+COALESCE(c,0); END IF;
  END LOOP;
  FOR store IN SELECT id FROM public.corporate_profiles WHERE subscription_status='ACTIVE' AND subscription_expires_at IS NOT NULL AND subscription_expires_at<=at ORDER BY subscription_expires_at,id FOR UPDATE SKIP LOCKED LOOP
    BEGIN
      transition_result:=public.transition_corporate_membership_listings(store.id,'FREEZE');
      UPDATE public.corporate_profiles SET subscription_status='EXPIRED',monthly_boost_credits=0,boost_credits=purchased_boost_credits,current_period_end=LEAST(COALESCE(current_period_end,subscription_expires_at),subscription_expires_at),updated_at=at WHERE id=store.id AND subscription_status='ACTIVE';
      GET DIAGNOSTICS c=ROW_COUNT;
      expired_subscriptions:=expired_subscriptions+c;
      frozen_membership_listings:=frozen_membership_listings+COALESCE((transition_result->>'transitioned_listings')::BIGINT,0);
    EXCEPTION WHEN OTHERS THEN
      blocked_subscriptions:=blocked_subscriptions+1;
      RAISE WARNING 'Corporate membership expiry deferred for %: %',store.id,SQLERRM;
    END;
  END LOOP;
  RETURN jsonb_build_object('success',true,'expired_listings',expired_listings,'expired_subscriptions',expired_subscriptions,'blocked_subscriptions',blocked_subscriptions,'frozen_membership_listings',frozen_membership_listings,'closed_offers',closed_offers);
END $$;

DO $$ DECLARE d TEXT; rewritten TEXT; BEGIN
  SELECT pg_get_functiondef('public.complete_sanboard_payment(text,text)'::regprocedure) INTO d;
  IF (SELECT COUNT(*) FROM regexp_matches(d,'WHERE id = v_store\.id;','g'))<>1 THEN
    RAISE EXCEPTION 'complete_sanboard_payment membership resume definition was not recognized';
  END IF;
  rewritten:=replace(d,'WHERE id = v_store.id;','WHERE id = v_store.id; PERFORM public.transition_corporate_membership_listings(v_store.id, ''RESUME'');');
  IF rewritten=d THEN RAISE EXCEPTION 'complete_sanboard_payment membership resume definition was not recognized'; END IF;
  EXECUTE rewritten;
END $$;

DO $$ DECLARE d TEXT; rewritten TEXT; BEGIN
  SELECT pg_get_functiondef('public.grant_corporate_subscription(uuid,uuid)'::regprocedure) INTO d;
  IF (SELECT COUNT(*) FROM regexp_matches(d,'WHERE id = v_store\.id\s+RETURNING \* INTO v_store;','g'))<>1 THEN
    RAISE EXCEPTION 'grant_corporate_subscription membership resume definition was not recognized';
  END IF;
  rewritten:=regexp_replace(d,'WHERE id = v_store\.id\s+RETURNING \* INTO v_store;','WHERE id = v_store.id RETURNING * INTO v_store; PERFORM public.transition_corporate_membership_listings(v_store.id, ''RESUME'');');
  IF rewritten=d THEN RAISE EXCEPTION 'grant_corporate_subscription membership resume definition was not recognized'; END IF;
  EXECUTE rewritten;
END $$;

CREATE OR REPLACE FUNCTION public.create_offer_thread(p_actor_profile_id UUID,p_listing_id UUID,p_amount BIGINT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.listings%ROWTYPE;b public.character_profiles%ROWTYPE;s UUID;su UUID;e public.offer_threads%ROWTYPE;t public.offer_threads%ROWTYPE;at TIMESTAMPTZ:=NOW();
BEGIN
 SELECT * INTO l FROM public.listings WHERE id=p_listing_id FOR UPDATE; SELECT * INTO b FROM public.character_profiles WHERE id=p_actor_profile_id;
 IF l.id IS NULL OR b.id IS NULL THEN RETURN jsonb_build_object('success',false,'code','NOT_FOUND','error','İlan bulunamadı.');END IF;
 IF l.status='FROZEN' THEN RETURN jsonb_build_object('success',false,'code','LISTING_FROZEN','error','İlan dondurulduğu için teklif işlemleri geçici olarak kullanılamıyor.');END IF;
 IF l.status<>'ACTIVE' OR l.expires_at IS NULL OR l.expires_at<=at THEN RETURN jsonb_build_object('success',false,'code','LISTING_INACTIVE','error','İlan yayında olmadığı için teklif verilemez.');END IF;
 IF NOT l.offers_enabled THEN RETURN jsonb_build_object('success',false,'code','OFFERS_DISABLED','error','Bu ilan tekliflere kapalı.');END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>9000000000000000 THEN RETURN jsonb_build_object('success',false,'code','INVALID_AMOUNT','error','Geçerli bir teklif tutarı girin.');END IF;
 IF l.minimum_offer_amount IS NOT NULL AND p_amount<l.minimum_offer_amount THEN RETURN jsonb_build_object('success',false,'code','MINIMUM_OFFER_NOT_MET','error','Bu ilan için minimum teklif tutarı karşılanmadı.');END IF;
 IF l.seller_type='CORPORATE' THEN SELECT owner_profile_id INTO s FROM public.corporate_profiles WHERE id=l.corporate_profile_id AND status='APPROVED' AND moderation_status='ACTIVE' AND deleted_at IS NULL AND subscription_status='ACTIVE' AND subscription_expires_at>at; ELSE s:=l.seller_profile_id;END IF;
 SELECT user_id INTO su FROM public.character_profiles WHERE id=s; IF s IS NULL OR su=b.user_id THEN RETURN jsonb_build_object('success',false,'code','SELF_OFFER','error','Kendi hesabınıza ait ilana teklif veremezsiniz.');END IF;
 SELECT * INTO e FROM public.offer_threads WHERE listing_id=p_listing_id AND buyer_profile_id=p_actor_profile_id AND status='ACTIVE'; IF e.id IS NOT NULL THEN RETURN jsonb_build_object('success',true,'code','EXISTING_ACTIVE','thread',to_jsonb(e));END IF;
 IF EXISTS(SELECT 1 FROM public.offer_threads WHERE listing_id=p_listing_id AND buyer_profile_id=p_actor_profile_id AND status IN('REJECTED','WITHDRAWN','EXPIRED','CLOSED') AND updated_at>at-INTERVAL '30 minutes') THEN RETURN jsonb_build_object('success',false,'code','COOLDOWN','error','Bu ilan için yeni teklif vermeden önce 30 dakika beklemelisiniz.');END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_profile_id::TEXT,0));
 IF(SELECT COUNT(*) FROM public.offer_threads WHERE buyer_profile_id=p_actor_profile_id AND status='ACTIVE')>=10 THEN RETURN jsonb_build_object('success',false,'code','ACTIVE_LIMIT','error','Aynı anda en fazla 10 aktif teklif görüşmeniz olabilir.');END IF;
 IF(SELECT COUNT(*) FROM public.offer_threads WHERE buyer_profile_id=p_actor_profile_id AND created_at>at-INTERVAL '1 hour')>=10 THEN RETURN jsonb_build_object('success',false,'code','RATE_LIMIT','error','Saatlik yeni teklif limitine ulaştınız.');END IF;
 INSERT INTO public.offer_threads(listing_id,original_listing_id,buyer_profile_id,seller_profile_id,seller_corporate_profile_id,current_amount,turn_profile_id,movement_count,expires_at,buyer_last_read_at)VALUES(l.id,l.id,b.id,s,l.corporate_profile_id,p_amount,s,1,LEAST(at+INTERVAL '24 hours',l.expires_at),at)RETURNING * INTO t;
 INSERT INTO public.offer_events(thread_id,actor_profile_id,event_type,amount)VALUES(t.id,b.id,'OFFER_CREATED',p_amount); INSERT INTO public.notifications(recipient_profile_id,user_id,type,title,message,entity_type,entity_id,metadata)VALUES(s,su,'OFFER_ACTIVITY','Yeni teklif geldi',l.title||' ilanına yeni teklif geldi.','offer',t.id,jsonb_build_object('offerThreadId',t.id)); RETURN jsonb_build_object('success',true,'thread',to_jsonb(t));
EXCEPTION WHEN unique_violation THEN SELECT * INTO e FROM public.offer_threads WHERE listing_id=p_listing_id AND buyer_profile_id=p_actor_profile_id AND status='ACTIVE';RETURN jsonb_build_object('success',true,'code','EXISTING_ACTIVE','thread',to_jsonb(e));END $$;

CREATE OR REPLACE FUNCTION public.act_on_offer_thread(p_actor_profile_id UUID,p_thread_id UUID,p_action TEXT,p_amount BIGINT DEFAULT NULL,p_proposal_event_id UUID DEFAULT NULL) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.offer_threads%ROWTYPE;l public.listings%ROWTYPE;o UUID;ou UUID;at TIMESTAMPTZ:=NOW();ev TEXT;proposal UUID;lid UUID;
BEGIN SELECT listing_id INTO lid FROM public.offer_threads WHERE id=p_thread_id;IF lid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Teklif bulunamadı.');END IF;SELECT * INTO l FROM public.listings WHERE id=lid FOR UPDATE;SELECT * INTO t FROM public.offer_threads WHERE id=p_thread_id FOR UPDATE;IF t.id IS NULL OR p_actor_profile_id NOT IN(t.buyer_profile_id,t.seller_profile_id)THEN RETURN jsonb_build_object('success',false,'error','Teklif bulunamadı.');END IF;
 IF l.status='FROZEN' THEN RETURN jsonb_build_object('success',false,'code','LISTING_FROZEN','error','İlan dondurulduğu için teklif işlemleri geçici olarak kullanılamıyor.');END IF;
 IF t.status='ACTIVE' AND t.expires_at<=at THEN UPDATE public.offer_threads SET status='EXPIRED',turn_profile_id=NULL,updated_at=at WHERE id=t.id RETURNING * INTO t;INSERT INTO public.offer_events(thread_id,event_type,metadata)VALUES(t.id,'THREAD_CLOSED',jsonb_build_object('reason','RESPONSE_EXPIRED'));RETURN jsonb_build_object('success',false,'code','EXPIRED','error','Teklifin süresi doldu.');END IF;
 IF l.status<>'ACTIVE' OR l.expires_at<=at OR t.status<>'ACTIVE' THEN RETURN jsonb_build_object('success',false,'error','Bu teklif artık aktif değil.');END IF;o:=CASE WHEN p_actor_profile_id=t.buyer_profile_id THEN t.seller_profile_id ELSE t.buyer_profile_id END;SELECT user_id INTO ou FROM public.character_profiles WHERE id=o;
 IF p_action='WITHDRAW'THEN IF p_actor_profile_id<>t.buyer_profile_id THEN RETURN jsonb_build_object('success',false,'error','Yalnız alıcı teklifi geri çekebilir.');END IF;ev:='WITHDRAWN';UPDATE public.offer_threads SET status='WITHDRAWN',turn_profile_id=NULL,updated_at=at WHERE id=t.id RETURNING * INTO t;
 ELSE IF t.turn_profile_id IS DISTINCT FROM p_actor_profile_id THEN RETURN jsonb_build_object('success',false,'error','Bu teklifte yanıt sırası sizde değil.');END IF;SELECT id INTO proposal FROM public.offer_events WHERE thread_id=t.id AND event_type IN('OFFER_CREATED','COUNTER_OFFER_CREATED')ORDER BY created_at DESC,id DESC LIMIT 1;IF p_proposal_event_id IS NULL OR p_proposal_event_id IS DISTINCT FROM proposal THEN RETURN jsonb_build_object('success',false,'code','STALE_PROPOSAL','error','Teklif güncellendi. Lütfen son teklifi tekrar inceleyin.');END IF;
 IF p_action='COUNTER'THEN IF t.movement_count>=6 THEN RETURN jsonb_build_object('success',false,'code','MOVEMENT_LIMIT','error','Bu teklif görüşmesinde maksimum karşı teklif sayısına ulaşıldı.');END IF;IF p_amount IS NULL OR p_amount<=0 OR p_amount>9000000000000000 OR(l.minimum_offer_amount IS NOT NULL AND p_amount<l.minimum_offer_amount)THEN RETURN jsonb_build_object('success',false,'error','Geçerli bir karşı teklif tutarı girin.');END IF;ev:='COUNTER_OFFER_CREATED';UPDATE public.offer_threads SET current_amount=p_amount,movement_count=movement_count+1,turn_profile_id=o,expires_at=LEAST(at+INTERVAL '24 hours',l.expires_at),updated_at=at WHERE id=t.id RETURNING * INTO t;
 ELSIF p_action IN('ACCEPT','REJECT')THEN ev:=CASE WHEN p_action='ACCEPT'THEN'ACCEPTED'ELSE'REJECTED'END;UPDATE public.offer_threads SET status=ev,turn_profile_id=NULL,updated_at=at WHERE id=t.id RETURNING * INTO t;ELSE RETURN jsonb_build_object('success',false,'error','Geçersiz teklif aksiyonu.');END IF;END IF;
 INSERT INTO public.offer_events(thread_id,actor_profile_id,event_type,amount)VALUES(t.id,p_actor_profile_id,ev,CASE WHEN ev IN('COUNTER_OFFER_CREATED','ACCEPTED')THEN t.current_amount ELSE NULL END);INSERT INTO public.notifications(recipient_profile_id,user_id,type,title,message,entity_type,entity_id,metadata)VALUES(o,ou,'OFFER_ACTIVITY',CASE WHEN ev='ACCEPTED'THEN'Teklif kabul edildi'ELSE'Teklif güncellendi'END,CASE WHEN ev='ACCEPTED'THEN l.title||' ilanındaki teklif kabul edildi.'ELSE l.title||' ilanındaki teklif görüşmesinde yeni hareket var.'END,'offer',t.id,jsonb_build_object('offerThreadId',t.id,'eventType',ev,'listingId',t.listing_id));RETURN jsonb_build_object('success',true,'thread',to_jsonb(t));END $$;

-- Existing boost function already requires ACTIVE; return the canonical frozen error before that generic guard.
DO $$ DECLARE d TEXT; rewritten TEXT; BEGIN
  SELECT pg_get_functiondef('public.consume_corporate_boost(uuid,uuid,text)'::regprocedure) INTO d;
  rewritten:=replace(d,'IF NOT FOUND OR v_listing.status <> ''ACTIVE'' OR v_listing.expires_at IS NULL OR v_listing.expires_at <= v_now THEN','IF NOT FOUND THEN RETURN jsonb_build_object(''success'', false, ''code'', ''LISTING_NOT_ELIGIBLE'', ''error'', ''İlan bulunamadı.''); END IF; IF v_listing.status = ''FROZEN'' THEN RETURN jsonb_build_object(''success'', false, ''code'', ''LISTING_FROZEN'', ''error'', ''Dondurulmuş ilan öne çıkarılamaz.''); END IF; IF v_listing.status <> ''ACTIVE'' OR v_listing.expires_at IS NULL OR v_listing.expires_at <= v_now THEN');
  IF rewritten=d THEN RAISE EXCEPTION 'consume_corporate_boost definition was not recognized'; END IF;
  EXECUTE rewritten;
END $$;

-- Frozen listings are non-terminal and therefore never purge candidates. Corporate hard purge explicitly terminalizes them.
CREATE OR REPLACE FUNCTION public.discover_corporate_purge_jobs(n integer DEFAULT 25) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c RECORD;discovered INTEGER:=0;BEGIN FOR c IN SELECT id FROM public.corporate_profiles WHERE moderation_status='DELETED' AND deleted_at IS NOT NULL ORDER BY deleted_at LIMIT GREATEST(1,LEAST(n,100)) LOOP UPDATE public.character_profiles SET is_dealer=false,dealer_id=NULL,updated_at=now() WHERE dealer_id=c.id::TEXT;PERFORM public.close_offers_for_listing(l.id,'LISTING_REMOVED_BY_ADMIN') FROM public.listings l WHERE l.corporate_profile_id=c.id AND l.status IN('ACTIVE','FROZEN');UPDATE public.listings SET status='REMOVED',close_reason='ADMIN_REMOVED',closed_at=now(),updated_at=now() WHERE corporate_profile_id=c.id AND status IN('ACTIVE','FROZEN');PERFORM public.enqueue_corporate_profile_purge_job(c.id);discovered:=discovered+1;PERFORM public.enqueue_listing_purge_job(l.id,'CORPORATE_PROFILE_RECONCILIATION') FROM public.listings l WHERE l.corporate_profile_id=c.id AND l.status='REMOVED';END LOOP;RETURN discovered;END $$;

-- Owners may close FROZEN listings through the existing terminal lifecycle.
DO $$ DECLARE d TEXT; rewritten TEXT; BEGIN
  SELECT pg_get_functiondef('public.close_listing_with_offers(uuid,uuid,text,boolean,text)'::regprocedure) INTO d;
  rewritten:=replace(d,'IF v_listing.status <> ''ACTIVE'' OR v_listing.expires_at <= NOW() THEN','IF v_listing.status NOT IN (''ACTIVE'',''FROZEN'') OR (v_listing.status=''ACTIVE'' AND v_listing.expires_at <= NOW()) THEN');
  IF rewritten=d THEN RAISE EXCEPTION 'close_listing_with_offers definition was not recognized'; END IF;
  EXECUTE rewritten;
END $$;

REVOKE ALL ON FUNCTION public.create_offer_thread(UUID,UUID,BIGINT),public.act_on_offer_thread(UUID,UUID,TEXT,BIGINT,UUID),public.run_expiry_lifecycle(),public.discover_corporate_purge_jobs(INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_offer_thread(UUID,UUID,BIGINT),public.act_on_offer_thread(UUID,UUID,TEXT,BIGINT,UUID),public.run_expiry_lifecycle(),public.discover_corporate_purge_jobs(INTEGER) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;