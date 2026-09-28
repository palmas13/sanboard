BEGIN;

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS offers_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS minimum_offer_amount BIGINT;
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_minimum_offer_valid;
ALTER TABLE public.listings ADD CONSTRAINT listings_minimum_offer_valid CHECK (minimum_offer_amount IS NULL OR (minimum_offer_amount > 0 AND minimum_offer_amount <= price));

CREATE TABLE IF NOT EXISTS public.offer_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  buyer_profile_id UUID NOT NULL REFERENCES public.character_profiles(id) ON DELETE RESTRICT,
  seller_profile_id UUID NOT NULL REFERENCES public.character_profiles(id) ON DELETE RESTRICT,
  seller_corporate_profile_id UUID REFERENCES public.corporate_profiles(id) ON DELETE RESTRICT,
  current_amount BIGINT NOT NULL CHECK (current_amount > 0 AND current_amount <= 9000000000000000),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED','CLOSED')),
  close_reason TEXT CHECK (close_reason IS NULL OR close_reason IN ('LISTING_EXPIRED','LISTING_REMOVED_BY_SELLER','LISTING_REMOVED_BY_ADMIN','LISTING_SOLD','LISTING_DELETED','LISTING_SUSPENDED')),
  turn_profile_id UUID REFERENCES public.character_profiles(id) ON DELETE RESTRICT,
  movement_count SMALLINT NOT NULL DEFAULT 1 CHECK (movement_count BETWEEN 1 AND 6),
  expires_at TIMESTAMPTZ NOT NULL,
  buyer_last_read_at TIMESTAMPTZ,
  seller_last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.offer_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES public.offer_threads(id) ON DELETE CASCADE,
  actor_profile_id UUID REFERENCES public.character_profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('OFFER_CREATED','COUNTER_OFFER_CREATED','ACCEPTED','REJECTED','WITHDRAWN','LISTING_PRICE_CHANGED','THREAD_CLOSED')),
  amount BIGINT CHECK (amount IS NULL OR (amount > 0 AND amount <= 9000000000000000)),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_offer_threads_active_buyer_listing ON public.offer_threads(listing_id,buyer_profile_id) WHERE status='ACTIVE';
CREATE INDEX IF NOT EXISTS idx_offer_threads_buyer_updated ON public.offer_threads(buyer_profile_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_threads_seller_updated ON public.offer_threads(seller_profile_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_threads_listing_status ON public.offer_threads(listing_id,status);
CREATE INDEX IF NOT EXISTS idx_offer_threads_expiry ON public.offer_threads(expires_at) WHERE status='ACTIVE';
CREATE INDEX IF NOT EXISTS idx_offer_events_thread_created ON public.offer_events(thread_id,created_at);

ALTER TABLE public.offer_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_events ENABLE ROW LEVEL SECURITY;
REVOKE INSERT,UPDATE,DELETE ON public.offer_threads,public.offer_events FROM anon,authenticated;
GRANT SELECT ON public.offer_threads,public.offer_events TO authenticated;
CREATE POLICY offer_threads_participant_select ON public.offer_threads FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.character_profiles p WHERE p.user_id=auth.uid() AND p.id IN (buyer_profile_id,seller_profile_id)) OR public.is_admin()
);
CREATE POLICY offer_events_participant_select ON public.offer_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.offer_threads t JOIN public.character_profiles p ON p.id IN (t.buyer_profile_id,t.seller_profile_id) WHERE t.id=thread_id AND p.user_id=auth.uid()) OR public.is_admin()
);

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('LISTING_PRICE_DROP','LISTING_PRICE_CHANGE','SUPPORT_REPLY','SYSTEM','LISTING_EXPIRES_SOON','CORPORATE_APPLICATION_APPROVED','CORPORATE_APPLICATION_REJECTED','NEW_CORPORATE_LISTING','NEW_FOLLOWER','CORPORATE_SUBSCRIPTION_EXPIRING','CORPORATE_STORE_SUSPENDED','CORPORATE_STORE_REACTIVATED','CORPORATE_STORE_DELETED','OFFER_ACTIVITY')) NOT VALID;
ALTER TABLE public.notifications VALIDATE CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_entity_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_entity_type_check CHECK (entity_type IS NULL OR entity_type IN ('listing','ticket','application','system','offer')) NOT VALID;
ALTER TABLE public.notifications VALIDATE CONSTRAINT notifications_entity_type_check;

CREATE OR REPLACE FUNCTION public.create_offer_thread(p_actor_profile_id UUID,p_listing_id UUID,p_amount BIGINT) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_listing public.listings%ROWTYPE; v_buyer public.character_profiles%ROWTYPE; v_seller UUID; v_seller_user UUID; v_existing public.offer_threads%ROWTYPE; v_thread public.offer_threads%ROWTYPE; v_now TIMESTAMPTZ:=NOW();
BEGIN
 SELECT * INTO v_listing FROM public.listings WHERE id=p_listing_id FOR UPDATE;
 SELECT * INTO v_buyer FROM public.character_profiles WHERE id=p_actor_profile_id;
 IF v_listing.id IS NULL OR v_buyer.id IS NULL THEN RETURN jsonb_build_object('success',false,'code','NOT_FOUND','error','İlan bulunamadı.'); END IF;
 IF v_listing.status<>'ACTIVE' OR v_listing.expires_at IS NULL OR v_listing.expires_at<=v_now THEN RETURN jsonb_build_object('success',false,'code','LISTING_INACTIVE','error','İlan yayında olmadığı için teklif verilemez.'); END IF;
 IF NOT v_listing.offers_enabled THEN RETURN jsonb_build_object('success',false,'code','OFFERS_DISABLED','error','Bu ilan tekliflere kapalı.'); END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount>9000000000000000 THEN RETURN jsonb_build_object('success',false,'code','INVALID_AMOUNT','error','Geçerli bir teklif tutarı girin.'); END IF;
 IF v_listing.minimum_offer_amount IS NOT NULL AND p_amount<v_listing.minimum_offer_amount THEN RETURN jsonb_build_object('success',false,'code','BELOW_MINIMUM','error','Teklif satıcının minimum tutarının altında.'); END IF;
 IF v_listing.seller_type='CORPORATE' THEN SELECT owner_profile_id INTO v_seller FROM public.corporate_profiles WHERE id=v_listing.corporate_profile_id AND moderation_status='ACTIVE' AND deleted_at IS NULL; ELSE v_seller:=v_listing.seller_profile_id; END IF;
 SELECT user_id INTO v_seller_user FROM public.character_profiles WHERE id=v_seller;
 IF v_seller IS NULL OR v_seller_user=v_buyer.user_id THEN RETURN jsonb_build_object('success',false,'code','SELF_OFFER','error','Kendi hesabınıza ait ilana teklif veremezsiniz.'); END IF;
 SELECT * INTO v_existing FROM public.offer_threads WHERE listing_id=p_listing_id AND buyer_profile_id=p_actor_profile_id AND status='ACTIVE';
 IF v_existing.id IS NOT NULL THEN RETURN jsonb_build_object('success',true,'code','EXISTING_ACTIVE','thread',to_jsonb(v_existing)); END IF;
 IF EXISTS(SELECT 1 FROM public.offer_threads WHERE listing_id=p_listing_id AND buyer_profile_id=p_actor_profile_id AND status IN ('REJECTED','WITHDRAWN','EXPIRED','CLOSED') AND updated_at>v_now-INTERVAL '30 minutes') THEN RETURN jsonb_build_object('success',false,'code','COOLDOWN','error','Bu ilan için yeni teklif vermeden önce 30 dakika beklemelisiniz.'); END IF;
 IF (SELECT COUNT(*) FROM public.offer_threads WHERE buyer_profile_id=p_actor_profile_id AND status='ACTIVE')>=10 THEN RETURN jsonb_build_object('success',false,'code','ACTIVE_LIMIT','error','Aynı anda en fazla 10 aktif teklif görüşmeniz olabilir.'); END IF;
 IF (SELECT COUNT(*) FROM public.offer_threads WHERE buyer_profile_id=p_actor_profile_id AND created_at>v_now-INTERVAL '1 hour')>=10 THEN RETURN jsonb_build_object('success',false,'code','RATE_LIMIT','error','Saatlik yeni teklif limitine ulaştınız.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_profile_id::TEXT,0));
 INSERT INTO public.offer_threads(listing_id,buyer_profile_id,seller_profile_id,seller_corporate_profile_id,current_amount,turn_profile_id,movement_count,expires_at,buyer_last_read_at) VALUES(p_listing_id,p_actor_profile_id,v_seller,v_listing.corporate_profile_id,p_amount,v_seller,1,LEAST(v_now+INTERVAL '24 hours',v_listing.expires_at),v_now) RETURNING * INTO v_thread;
 INSERT INTO public.offer_events(thread_id,actor_profile_id,event_type,amount) VALUES(v_thread.id,p_actor_profile_id,'OFFER_CREATED',p_amount);
 INSERT INTO public.notifications(recipient_profile_id,user_id,type,title,message,entity_type,entity_id,metadata) VALUES(v_seller,v_seller_user,'OFFER_ACTIVITY','Yeni teklif geldi',v_listing.title||' ilanına yeni teklif geldi.','offer',v_thread.id,jsonb_build_object('offerThreadId',v_thread.id));
 RETURN jsonb_build_object('success',true,'thread',to_jsonb(v_thread));
EXCEPTION WHEN unique_violation THEN SELECT * INTO v_existing FROM public.offer_threads WHERE listing_id=p_listing_id AND buyer_profile_id=p_actor_profile_id AND status='ACTIVE'; RETURN jsonb_build_object('success',true,'code','EXISTING_ACTIVE','thread',to_jsonb(v_existing)); END; $$;

CREATE OR REPLACE FUNCTION public.act_on_offer_thread(p_actor_profile_id UUID,p_thread_id UUID,p_action TEXT,p_amount BIGINT DEFAULT NULL) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_t public.offer_threads%ROWTYPE; v_l public.listings%ROWTYPE; v_other UUID; v_other_user UUID; v_now TIMESTAMPTZ:=NOW(); v_event TEXT;
BEGIN SELECT * INTO v_t FROM public.offer_threads WHERE id=p_thread_id FOR UPDATE; IF v_t.id IS NULL OR p_actor_profile_id NOT IN (v_t.buyer_profile_id,v_t.seller_profile_id) THEN RETURN jsonb_build_object('success',false,'error','Teklif bulunamadı.'); END IF;
 SELECT * INTO v_l FROM public.listings WHERE id=v_t.listing_id FOR UPDATE;
 IF v_t.status='ACTIVE' AND v_t.expires_at<=v_now THEN UPDATE public.offer_threads SET status='EXPIRED',turn_profile_id=NULL,updated_at=v_now WHERE id=v_t.id RETURNING * INTO v_t; INSERT INTO public.offer_events(thread_id,event_type,metadata) VALUES(v_t.id,'THREAD_CLOSED',jsonb_build_object('reason','RESPONSE_EXPIRED')); RETURN jsonb_build_object('success',false,'code','EXPIRED','error','Teklifin süresi doldu.'); END IF;
 IF v_l.status<>'ACTIVE' OR v_l.expires_at<=v_now OR v_t.status<>'ACTIVE' THEN RETURN jsonb_build_object('success',false,'error','Bu teklif artık aktif değil.'); END IF;
 v_other:=CASE WHEN p_actor_profile_id=v_t.buyer_profile_id THEN v_t.seller_profile_id ELSE v_t.buyer_profile_id END; SELECT user_id INTO v_other_user FROM public.character_profiles WHERE id=v_other;
 IF p_action='WITHDRAW' THEN IF p_actor_profile_id<>v_t.buyer_profile_id THEN RETURN jsonb_build_object('success',false,'error','Yalnız alıcı teklifi geri çekebilir.'); END IF; v_event:='WITHDRAWN'; UPDATE public.offer_threads SET status='WITHDRAWN',turn_profile_id=NULL,updated_at=v_now WHERE id=v_t.id RETURNING * INTO v_t;
 ELSE IF v_t.turn_profile_id<>p_actor_profile_id THEN RETURN jsonb_build_object('success',false,'error','Bu teklifte yanıt sırası sizde değil.'); END IF;
   IF p_action='COUNTER' THEN IF v_t.movement_count>=6 THEN RETURN jsonb_build_object('success',false,'code','MOVEMENT_LIMIT','error','Bu teklif görüşmesinde maksimum karşı teklif sayısına ulaşıldı.'); END IF; IF p_amount IS NULL OR p_amount<=0 OR p_amount>9000000000000000 OR (v_l.minimum_offer_amount IS NOT NULL AND p_amount<v_l.minimum_offer_amount) THEN RETURN jsonb_build_object('success',false,'error','Geçerli bir karşı teklif tutarı girin.'); END IF; v_event:='COUNTER_OFFER_CREATED'; UPDATE public.offer_threads SET current_amount=p_amount,movement_count=movement_count+1,turn_profile_id=v_other,expires_at=LEAST(v_now+INTERVAL '24 hours',v_l.expires_at),updated_at=v_now WHERE id=v_t.id RETURNING * INTO v_t;
  ELSIF p_action IN ('ACCEPT','REJECT') THEN v_event:=CASE WHEN p_action='ACCEPT' THEN 'ACCEPTED' ELSE 'REJECTED' END; UPDATE public.offer_threads SET status=v_event,turn_profile_id=NULL,updated_at=v_now WHERE id=v_t.id RETURNING * INTO v_t; ELSE RETURN jsonb_build_object('success',false,'error','Geçersiz teklif aksiyonu.'); END IF;
 END IF;
 INSERT INTO public.offer_events(thread_id,actor_profile_id,event_type,amount) VALUES(v_t.id,p_actor_profile_id,v_event,CASE WHEN v_event IN ('COUNTER_OFFER_CREATED','ACCEPTED') THEN v_t.current_amount ELSE NULL END);
 INSERT INTO public.notifications(recipient_profile_id,user_id,type,title,message,entity_type,entity_id,metadata) VALUES(v_other,v_other_user,'OFFER_ACTIVITY','Teklif güncellendi',v_l.title||' ilanındaki teklif görüşmesinde yeni hareket var.','offer',v_t.id,jsonb_build_object('offerThreadId',v_t.id,'eventType',v_event));
 RETURN jsonb_build_object('success',true,'thread',to_jsonb(v_t)); END; $$;

CREATE OR REPLACE FUNCTION public.mark_offer_thread_read(p_actor_profile_id UUID,p_thread_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_t public.offer_threads%ROWTYPE; v_count BIGINT; BEGIN SELECT * INTO v_t FROM public.offer_threads WHERE id=p_thread_id FOR UPDATE; IF v_t.id IS NULL OR p_actor_profile_id NOT IN(v_t.buyer_profile_id,v_t.seller_profile_id) THEN RETURN jsonb_build_object('success',false,'unreadCount',0,'error','Teklif bulunamadı.'); END IF; IF p_actor_profile_id=v_t.buyer_profile_id THEN UPDATE public.offer_threads SET buyer_last_read_at=NOW() WHERE id=v_t.id; ELSE UPDATE public.offer_threads SET seller_last_read_at=NOW() WHERE id=v_t.id; END IF; SELECT public.get_offer_unread_count(p_actor_profile_id) INTO v_count; RETURN jsonb_build_object('success',true,'unreadCount',v_count); END; $$;
CREATE OR REPLACE FUNCTION public.get_offer_unread_count(p_actor_profile_id UUID) RETURNS BIGINT LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT COUNT(*) FROM public.offer_events e JOIN public.offer_threads t ON t.id=e.thread_id WHERE p_actor_profile_id IN(t.buyer_profile_id,t.seller_profile_id) AND e.actor_profile_id IS DISTINCT FROM p_actor_profile_id AND e.created_at>COALESCE(CASE WHEN p_actor_profile_id=t.buyer_profile_id THEN t.buyer_last_read_at ELSE t.seller_last_read_at END,'epoch'::timestamptz); $$;
CREATE OR REPLACE FUNCTION public.expire_stale_offer_threads() RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_count BIGINT:=0; v_listing RECORD; v_expired BIGINT; BEGIN FOR v_listing IN SELECT DISTINCT t.listing_id FROM public.offer_threads t JOIN public.listings l ON l.id=t.listing_id WHERE t.status='ACTIVE' AND (l.status<>'ACTIVE' OR l.expires_at<=NOW()) LOOP SELECT public.close_offers_for_listing(v_listing.listing_id,'LISTING_EXPIRED') INTO v_expired; v_count:=v_count+v_expired; END LOOP; WITH expired AS (UPDATE public.offer_threads SET status='EXPIRED',turn_profile_id=NULL,updated_at=NOW() WHERE status='ACTIVE' AND expires_at<=NOW() RETURNING id) INSERT INTO public.offer_events(thread_id,event_type,metadata) SELECT id,'THREAD_CLOSED',jsonb_build_object('reason','RESPONSE_EXPIRED') FROM expired; GET DIAGNOSTICS v_expired=ROW_COUNT; RETURN v_count+v_expired; END; $$;
CREATE OR REPLACE FUNCTION public.get_active_offer_count_for_listing(p_listing_id UUID,p_actor_profile_id UUID) RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_listing public.listings%ROWTYPE; v_owner UUID; BEGIN SELECT * INTO v_listing FROM public.listings WHERE id=p_listing_id; IF v_listing.id IS NULL THEN RETURN 0; END IF; IF v_listing.seller_type='CORPORATE' THEN SELECT owner_profile_id INTO v_owner FROM public.corporate_profiles WHERE id=v_listing.corporate_profile_id; ELSE v_owner:=v_listing.seller_profile_id; END IF; IF v_owner IS DISTINCT FROM p_actor_profile_id THEN RETURN 0; END IF; RETURN (SELECT COUNT(*) FROM public.offer_threads WHERE listing_id=p_listing_id AND status='ACTIVE'); END; $$;
CREATE OR REPLACE FUNCTION public.close_offers_for_listing(p_listing_id UUID,p_reason TEXT) RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_count BIGINT; v_title TEXT; BEGIN SELECT title INTO v_title FROM public.listings WHERE id=p_listing_id; CREATE TEMP TABLE IF NOT EXISTS pg_temp.closed_offer_threads(id UUID,buyer_profile_id UUID,seller_profile_id UUID) ON COMMIT DROP; TRUNCATE pg_temp.closed_offer_threads; WITH closed AS (UPDATE public.offer_threads SET status='CLOSED',close_reason=p_reason,turn_profile_id=NULL,updated_at=NOW() WHERE listing_id=p_listing_id AND status='ACTIVE' RETURNING id,buyer_profile_id,seller_profile_id) INSERT INTO pg_temp.closed_offer_threads SELECT * FROM closed; GET DIAGNOSTICS v_count=ROW_COUNT; INSERT INTO public.offer_events(thread_id,event_type,metadata) SELECT id,'THREAD_CLOSED',jsonb_build_object('reason',p_reason) FROM pg_temp.closed_offer_threads; INSERT INTO public.notifications(recipient_profile_id,user_id,type,title,message,entity_type,entity_id,metadata) SELECT participant.id,participant.user_id,'OFFER_ACTIVITY','Teklif görüşmesi kapandı',CASE WHEN p_reason='LISTING_REMOVED_BY_ADMIN' THEN 'İlan yönetim tarafından yayından kaldırıldı. Bu teklif görüşmesi artık devam ettirilemez.' ELSE COALESCE(v_title,'İlan')||' yayında olmadığı için bu teklif kapandı.' END,'offer',closed.id,jsonb_build_object('offerThreadId',closed.id,'eventType','THREAD_CLOSED','reason',p_reason) FROM pg_temp.closed_offer_threads closed CROSS JOIN LATERAL (SELECT p.id,p.user_id FROM public.character_profiles p WHERE p.id IN(closed.buyer_profile_id,closed.seller_profile_id)) participant; RETURN v_count; END; $$;
CREATE OR REPLACE FUNCTION public.record_offer_listing_price_change(p_listing_id UUID,p_old_price BIGINT,p_new_price BIGINT) RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_count BIGINT; v_title TEXT; BEGIN SELECT title INTO v_title FROM public.listings WHERE id=p_listing_id; WITH affected AS (SELECT id,buyer_profile_id,seller_profile_id FROM public.offer_threads WHERE listing_id=p_listing_id AND status='ACTIVE'), events AS (INSERT INTO public.offer_events(thread_id,event_type,metadata) SELECT id,'LISTING_PRICE_CHANGED',jsonb_build_object('oldPrice',p_old_price,'newPrice',p_new_price) FROM affected RETURNING thread_id) INSERT INTO public.notifications(recipient_profile_id,user_id,type,title,message,entity_type,entity_id,metadata) SELECT participant.id,participant.user_id,'OFFER_ACTIVITY','İlan fiyatı değişti',COALESCE(v_title,'İlan')||' fiyatı güncellendi.','offer',affected.id,jsonb_build_object('offerThreadId',affected.id,'eventType','LISTING_PRICE_CHANGED','oldPrice',p_old_price,'newPrice',p_new_price) FROM affected CROSS JOIN LATERAL (SELECT p.id,p.user_id FROM public.character_profiles p WHERE p.id IN(affected.buyer_profile_id,affected.seller_profile_id)) participant; GET DIAGNOSTICS v_count=ROW_COUNT; UPDATE public.offer_threads SET updated_at=NOW() WHERE listing_id=p_listing_id AND status='ACTIVE'; RETURN v_count/2; END; $$;
CREATE OR REPLACE FUNCTION public.close_listing_with_offers(p_listing_id UUID,p_actor_profile_id UUID,p_status TEXT,p_admin BOOLEAN DEFAULT FALSE) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_listing public.listings%ROWTYPE; v_reason TEXT; v_owner UUID; BEGIN SELECT * INTO v_listing FROM public.listings WHERE id=p_listing_id FOR UPDATE; IF v_listing.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','İlan bulunamadı.'); END IF; IF v_listing.seller_type='CORPORATE' THEN SELECT owner_profile_id INTO v_owner FROM public.corporate_profiles WHERE id=v_listing.corporate_profile_id AND moderation_status='ACTIVE' AND deleted_at IS NULL; ELSE v_owner:=v_listing.seller_profile_id; END IF; IF NOT p_admin AND v_owner IS DISTINCT FROM p_actor_profile_id THEN RETURN jsonb_build_object('success',false,'error','Bu işlem için yetkiniz yok.'); END IF; IF v_listing.status<>'ACTIVE' OR v_listing.expires_at<=NOW() THEN RETURN jsonb_build_object('success',false,'error','Yalnızca yayındaki ilanlar kapatılabilir.'); END IF; IF p_status NOT IN('SOLD','REMOVED') THEN RETURN jsonb_build_object('success',false,'error','Geçersiz ilan durumu.'); END IF; UPDATE public.listings SET status=p_status,updated_at=NOW() WHERE id=p_listing_id; v_reason:=CASE WHEN p_status='SOLD' THEN 'LISTING_SOLD' WHEN p_admin THEN 'LISTING_REMOVED_BY_ADMIN' ELSE 'LISTING_REMOVED_BY_SELLER' END; PERFORM public.close_offers_for_listing(p_listing_id,v_reason); RETURN jsonb_build_object('success',true,'listing',(SELECT to_jsonb(l) FROM public.listings l WHERE l.id=p_listing_id)); END; $$;

REVOKE ALL ON FUNCTION public.create_offer_thread(UUID,UUID,BIGINT),public.act_on_offer_thread(UUID,UUID,TEXT,BIGINT),public.mark_offer_thread_read(UUID,UUID),public.get_offer_unread_count(UUID),public.get_active_offer_count_for_listing(UUID,UUID),public.expire_stale_offer_threads(),public.close_offers_for_listing(UUID,TEXT),public.record_offer_listing_price_change(UUID,BIGINT,BIGINT),public.close_listing_with_offers(UUID,UUID,TEXT,BOOLEAN) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_offer_thread(UUID,UUID,BIGINT),public.act_on_offer_thread(UUID,UUID,TEXT,BIGINT),public.mark_offer_thread_read(UUID,UUID),public.get_offer_unread_count(UUID),public.get_active_offer_count_for_listing(UUID,UUID),public.expire_stale_offer_threads(),public.close_offers_for_listing(UUID,TEXT),public.record_offer_listing_price_change(UUID,BIGINT,BIGINT),public.close_listing_with_offers(UUID,UUID,TEXT,BOOLEAN) TO service_role;

COMMIT;