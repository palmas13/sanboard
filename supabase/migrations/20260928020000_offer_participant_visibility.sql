BEGIN;

ALTER TABLE public.offer_threads
  ADD COLUMN IF NOT EXISTS buyer_hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seller_hidden_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.hide_offer_thread(p_actor_profile_id UUID,p_thread_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_t public.offer_threads%ROWTYPE; v_count BIGINT;
BEGIN
  SELECT * INTO v_t FROM public.offer_threads WHERE id=p_thread_id FOR UPDATE;
  IF v_t.id IS NULL OR p_actor_profile_id NOT IN(v_t.buyer_profile_id,v_t.seller_profile_id) THEN
    RETURN jsonb_build_object('success',false,'unreadCount',0,'error','Teklif bulunamadı.');
  END IF;
  IF p_actor_profile_id=v_t.buyer_profile_id THEN
    UPDATE public.offer_threads SET buyer_hidden_at=NOW(),buyer_last_read_at=NOW() WHERE id=v_t.id;
  ELSE
    UPDATE public.offer_threads SET seller_hidden_at=NOW(),seller_last_read_at=NOW() WHERE id=v_t.id;
  END IF;
  SELECT public.get_offer_unread_count(p_actor_profile_id) INTO v_count;
  RETURN jsonb_build_object('success',true,'unreadCount',v_count);
END; $$;

CREATE OR REPLACE FUNCTION public.restore_offer_thread_visibility_on_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.offer_threads SET
    buyer_hidden_at=CASE WHEN NEW.actor_profile_id IS NULL OR NEW.actor_profile_id<>buyer_profile_id THEN NULL ELSE buyer_hidden_at END,
    seller_hidden_at=CASE WHEN NEW.actor_profile_id IS NULL OR NEW.actor_profile_id<>seller_profile_id THEN NULL ELSE seller_hidden_at END
  WHERE id=NEW.thread_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS offer_event_restores_participant_visibility ON public.offer_events;
CREATE TRIGGER offer_event_restores_participant_visibility AFTER INSERT ON public.offer_events
FOR EACH ROW EXECUTE FUNCTION public.restore_offer_thread_visibility_on_event();

CREATE OR REPLACE FUNCTION public.get_offer_unread_count(p_actor_profile_id UUID) RETURNS BIGINT LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT COUNT(*) FROM public.offer_events e JOIN public.offer_threads t ON t.id=e.thread_id
  WHERE p_actor_profile_id IN(t.buyer_profile_id,t.seller_profile_id)
    AND CASE WHEN p_actor_profile_id=t.buyer_profile_id THEN t.buyer_hidden_at IS NULL ELSE t.seller_hidden_at IS NULL END
    AND e.actor_profile_id IS DISTINCT FROM p_actor_profile_id
    AND e.created_at>COALESCE(CASE WHEN p_actor_profile_id=t.buyer_profile_id THEN t.buyer_last_read_at ELSE t.seller_last_read_at END,'epoch'::timestamptz);
$$;

REVOKE ALL ON FUNCTION public.hide_offer_thread(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hide_offer_thread(UUID,UUID) TO service_role;

COMMIT;