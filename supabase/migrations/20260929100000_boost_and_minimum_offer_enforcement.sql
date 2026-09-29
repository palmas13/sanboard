BEGIN;

-- Keep the canonical three-argument boost RPC available to PostgREST deployments.
-- The implementation remains in 20260929090000_test_actor_featured_payment_bypass.sql.
NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.create_offer_thread(
  p_actor_profile_id UUID,
  p_listing_id UUID,
  p_amount BIGINT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
  v_buyer public.character_profiles%ROWTYPE;
  v_seller UUID;
  v_seller_user UUID;
  v_existing public.offer_threads%ROWTYPE;
  v_thread public.offer_threads%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_listing FROM public.listings WHERE id=p_listing_id FOR UPDATE;
  SELECT * INTO v_buyer FROM public.character_profiles WHERE id=p_actor_profile_id;
  IF v_listing.id IS NULL OR v_buyer.id IS NULL THEN RETURN jsonb_build_object('success',false,'code','NOT_FOUND','error','İlan bulunamadı.'); END IF;
  IF v_listing.status<>'ACTIVE' OR v_listing.expires_at IS NULL OR v_listing.expires_at<=v_now THEN RETURN jsonb_build_object('success',false,'code','LISTING_INACTIVE','error','İlan yayında olmadığı için teklif verilemez.'); END IF;
  IF NOT v_listing.offers_enabled THEN RETURN jsonb_build_object('success',false,'code','OFFERS_DISABLED','error','Bu ilan tekliflere kapalı.'); END IF;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount>9000000000000000 THEN RETURN jsonb_build_object('success',false,'code','INVALID_AMOUNT','error','Geçerli bir teklif tutarı girin.'); END IF;
  IF v_listing.minimum_offer_amount IS NOT NULL AND p_amount<v_listing.minimum_offer_amount THEN
    RETURN jsonb_build_object('success',false,'code','MINIMUM_OFFER_NOT_MET','error','Bu ilan için minimum teklif tutarı $'||replace(to_char(v_listing.minimum_offer_amount,'FM999G999G999G999G999G999'),',','.')); 
  END IF;
  IF v_listing.seller_type='CORPORATE' THEN SELECT owner_profile_id INTO v_seller FROM public.corporate_profiles WHERE id=v_listing.corporate_profile_id AND moderation_status='ACTIVE' AND deleted_at IS NULL; ELSE v_seller:=v_listing.seller_profile_id; END IF;
  SELECT user_id INTO v_seller_user FROM public.character_profiles WHERE id=v_seller;
  IF v_seller IS NULL OR v_seller_user=v_buyer.user_id THEN RETURN jsonb_build_object('success',false,'code','SELF_OFFER','error','Kendi hesabınıza ait ilana teklif veremezsiniz.'); END IF;
  SELECT * INTO v_existing FROM public.offer_threads WHERE listing_id=p_listing_id AND buyer_profile_id=p_actor_profile_id AND status='ACTIVE';
  IF v_existing.id IS NOT NULL THEN RETURN jsonb_build_object('success',true,'code','EXISTING_ACTIVE','thread',to_jsonb(v_existing)); END IF;
  IF EXISTS(SELECT 1 FROM public.offer_threads WHERE listing_id=p_listing_id AND buyer_profile_id=p_actor_profile_id AND status IN ('REJECTED','WITHDRAWN','EXPIRED','CLOSED') AND updated_at>v_now-INTERVAL '30 minutes') THEN RETURN jsonb_build_object('success',false,'code','COOLDOWN','error','Bu ilan için yeni teklif vermeden önce 30 dakika beklemelisiniz.'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_profile_id::TEXT,0));
  IF (SELECT COUNT(*) FROM public.offer_threads WHERE buyer_profile_id=p_actor_profile_id AND status='ACTIVE')>=10 THEN RETURN jsonb_build_object('success',false,'code','ACTIVE_LIMIT','error','Aynı anda en fazla 10 aktif teklif görüşmeniz olabilir.'); END IF;
  IF (SELECT COUNT(*) FROM public.offer_threads WHERE buyer_profile_id=p_actor_profile_id AND created_at>v_now-INTERVAL '1 hour')>=10 THEN RETURN jsonb_build_object('success',false,'code','RATE_LIMIT','error','Saatlik yeni teklif limitine ulaştınız.'); END IF;
  INSERT INTO public.offer_threads(listing_id,buyer_profile_id,seller_profile_id,seller_corporate_profile_id,current_amount,turn_profile_id,movement_count,expires_at,buyer_last_read_at) VALUES(p_listing_id,p_actor_profile_id,v_seller,v_listing.corporate_profile_id,p_amount,v_seller,1,LEAST(v_now+INTERVAL '24 hours',v_listing.expires_at),v_now) RETURNING * INTO v_thread;
  INSERT INTO public.offer_events(thread_id,actor_profile_id,event_type,amount) VALUES(v_thread.id,p_actor_profile_id,'OFFER_CREATED',p_amount);
  INSERT INTO public.notifications(recipient_profile_id,user_id,type,title,message,entity_type,entity_id,metadata) VALUES(v_seller,v_seller_user,'OFFER_ACTIVITY','Yeni teklif geldi',v_listing.title||' ilanına yeni teklif geldi.','offer',v_thread.id,jsonb_build_object('offerThreadId',v_thread.id));
  RETURN jsonb_build_object('success',true,'thread',to_jsonb(v_thread));
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_existing FROM public.offer_threads WHERE listing_id=p_listing_id AND buyer_profile_id=p_actor_profile_id AND status='ACTIVE';
  RETURN jsonb_build_object('success',true,'code','EXISTING_ACTIVE','thread',to_jsonb(v_existing));
END;
$$;

REVOKE ALL ON FUNCTION public.create_offer_thread(UUID,UUID,BIGINT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_offer_thread(UUID,UUID,BIGINT) TO service_role;
NOTIFY pgrst, 'reload schema';

COMMIT;