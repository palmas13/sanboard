BEGIN;

DROP FUNCTION IF EXISTS public.act_on_offer_thread(UUID,UUID,TEXT,BIGINT);

CREATE OR REPLACE FUNCTION public.act_on_offer_thread(
  p_actor_profile_id UUID,
  p_thread_id UUID,
  p_action TEXT,
  p_amount BIGINT DEFAULT NULL,
  p_proposal_event_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_t public.offer_threads%ROWTYPE;
  v_l public.listings%ROWTYPE;
  v_other UUID;
  v_other_user UUID;
  v_now TIMESTAMPTZ:=NOW();
  v_event TEXT;
  v_current_proposal_id UUID;
  v_listing_id UUID;
BEGIN
  SELECT listing_id INTO v_listing_id FROM public.offer_threads WHERE id=p_thread_id;
  IF v_listing_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Teklif bulunamadı.'); END IF;

  SELECT * INTO v_l FROM public.listings WHERE id=v_listing_id FOR UPDATE;
  SELECT * INTO v_t FROM public.offer_threads WHERE id=p_thread_id FOR UPDATE;
  IF v_t.id IS NULL OR p_actor_profile_id NOT IN (v_t.buyer_profile_id,v_t.seller_profile_id) THEN RETURN jsonb_build_object('success',false,'error','Teklif bulunamadı.'); END IF;

  IF v_t.status='ACTIVE' AND v_t.expires_at<=v_now THEN
    UPDATE public.offer_threads SET status='EXPIRED',turn_profile_id=NULL,updated_at=v_now WHERE id=v_t.id RETURNING * INTO v_t;
    INSERT INTO public.offer_events(thread_id,event_type,metadata) VALUES(v_t.id,'THREAD_CLOSED',jsonb_build_object('reason','RESPONSE_EXPIRED'));
    RETURN jsonb_build_object('success',false,'code','EXPIRED','error','Teklifin süresi doldu.');
  END IF;
  IF v_l.status<>'ACTIVE' OR v_l.expires_at<=v_now OR v_t.status<>'ACTIVE' THEN RETURN jsonb_build_object('success',false,'error','Bu teklif artık aktif değil.'); END IF;

  v_other:=CASE WHEN p_actor_profile_id=v_t.buyer_profile_id THEN v_t.seller_profile_id ELSE v_t.buyer_profile_id END;
  SELECT user_id INTO v_other_user FROM public.character_profiles WHERE id=v_other;

  IF p_action='WITHDRAW' THEN
    IF p_actor_profile_id<>v_t.buyer_profile_id THEN RETURN jsonb_build_object('success',false,'error','Yalnız alıcı teklifi geri çekebilir.'); END IF;
    v_event:='WITHDRAWN';
    UPDATE public.offer_threads SET status='WITHDRAWN',turn_profile_id=NULL,updated_at=v_now WHERE id=v_t.id RETURNING * INTO v_t;
  ELSE
    IF v_t.turn_profile_id IS DISTINCT FROM p_actor_profile_id THEN RETURN jsonb_build_object('success',false,'error','Bu teklifte yanıt sırası sizde değil.'); END IF;
    SELECT id INTO v_current_proposal_id FROM public.offer_events WHERE thread_id=v_t.id AND event_type IN ('OFFER_CREATED','COUNTER_OFFER_CREATED') ORDER BY created_at DESC,id DESC LIMIT 1;
    IF p_proposal_event_id IS NULL OR p_proposal_event_id IS DISTINCT FROM v_current_proposal_id THEN RETURN jsonb_build_object('success',false,'code','STALE_PROPOSAL','error','Teklif güncellendi. Lütfen son teklifi tekrar inceleyin.'); END IF;

    IF p_action='COUNTER' THEN
      IF v_t.movement_count>=6 THEN RETURN jsonb_build_object('success',false,'code','MOVEMENT_LIMIT','error','Bu teklif görüşmesinde maksimum karşı teklif sayısına ulaşıldı.'); END IF;
      IF p_amount IS NULL OR p_amount<=0 OR p_amount>9000000000000000 OR (v_l.minimum_offer_amount IS NOT NULL AND p_amount<v_l.minimum_offer_amount) THEN RETURN jsonb_build_object('success',false,'error','Geçerli bir karşı teklif tutarı girin.'); END IF;
      v_event:='COUNTER_OFFER_CREATED';
      UPDATE public.offer_threads SET current_amount=p_amount,movement_count=movement_count+1,turn_profile_id=v_other,expires_at=LEAST(v_now+INTERVAL '24 hours',v_l.expires_at),updated_at=v_now WHERE id=v_t.id RETURNING * INTO v_t;
    ELSIF p_action IN ('ACCEPT','REJECT') THEN
      v_event:=CASE WHEN p_action='ACCEPT' THEN 'ACCEPTED' ELSE 'REJECTED' END;
      UPDATE public.offer_threads SET status=v_event,turn_profile_id=NULL,updated_at=v_now WHERE id=v_t.id RETURNING * INTO v_t;
    ELSE
      RETURN jsonb_build_object('success',false,'error','Geçersiz teklif aksiyonu.');
    END IF;
  END IF;

  INSERT INTO public.offer_events(thread_id,actor_profile_id,event_type,amount) VALUES(v_t.id,p_actor_profile_id,v_event,CASE WHEN v_event IN ('COUNTER_OFFER_CREATED','ACCEPTED') THEN v_t.current_amount ELSE NULL END);
  INSERT INTO public.notifications(recipient_profile_id,user_id,type,title,message,entity_type,entity_id,metadata)
  VALUES(v_other,v_other_user,'OFFER_ACTIVITY',CASE WHEN v_event='ACCEPTED' THEN 'Teklif kabul edildi' ELSE 'Teklif güncellendi' END,CASE WHEN v_event='ACCEPTED' THEN v_l.title||' ilanındaki '||v_t.current_amount||' tutarındaki teklif kabul edildi.' ELSE v_l.title||' ilanındaki teklif görüşmesinde yeni hareket var.' END,'offer',v_t.id,jsonb_build_object('offerThreadId',v_t.id,'eventType',v_event,'listingId',v_t.listing_id,'acceptedAmount',CASE WHEN v_event='ACCEPTED' THEN v_t.current_amount ELSE NULL END,'actorProfileId',p_actor_profile_id,'recipientProfileId',v_other));
  RETURN jsonb_build_object('success',true,'thread',to_jsonb(v_t));
END;
$$;

REVOKE ALL ON FUNCTION public.act_on_offer_thread(UUID,UUID,TEXT,BIGINT,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.act_on_offer_thread(UUID,UUID,TEXT,BIGINT,UUID) TO service_role;

COMMIT;