BEGIN;

ALTER TABLE public.offer_events
  ALTER COLUMN created_at SET DEFAULT clock_timestamp();

CREATE OR REPLACE FUNCTION public.mark_offer_thread_read(
  p_actor_profile_id UUID,
  p_thread_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t public.offer_threads%ROWTYPE;
  v_count BIGINT;
  v_read_at TIMESTAMPTZ;
BEGIN
  SELECT *
  INTO v_t
  FROM public.offer_threads
  WHERE id = p_thread_id
  FOR UPDATE;

  IF p_actor_profile_id IS NULL
     OR v_t.id IS NULL
     OR p_actor_profile_id NOT IN (v_t.buyer_profile_id, v_t.seller_profile_id) THEN
    RETURN jsonb_build_object('success', false, 'unreadCount', 0, 'error', 'Teklif bulunamadı.');
  END IF;

  SELECT MAX(e.created_at)
  INTO v_read_at
  FROM public.offer_events e
  WHERE e.thread_id = v_t.id
    AND e.actor_profile_id IS DISTINCT FROM p_actor_profile_id;

  IF p_actor_profile_id = v_t.buyer_profile_id THEN
    UPDATE public.offer_threads
    SET buyer_last_read_at = CASE
      WHEN v_read_at IS NULL THEN buyer_last_read_at
      ELSE GREATEST(COALESCE(buyer_last_read_at, '-infinity'::TIMESTAMPTZ), v_read_at)
    END
    WHERE id = v_t.id;
  ELSE
    UPDATE public.offer_threads
    SET seller_last_read_at = CASE
      WHEN v_read_at IS NULL THEN seller_last_read_at
      ELSE GREATEST(COALESCE(seller_last_read_at, '-infinity'::TIMESTAMPTZ), v_read_at)
    END
    WHERE id = v_t.id;
  END IF;

  SELECT public.get_offer_unread_count(p_actor_profile_id) INTO v_count;
  RETURN jsonb_build_object('success', true, 'unreadCount', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.hide_offer_thread(
  p_actor_profile_id UUID,
  p_thread_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t public.offer_threads%ROWTYPE;
  v_count BIGINT;
  v_read_at TIMESTAMPTZ;
BEGIN
  SELECT *
  INTO v_t
  FROM public.offer_threads
  WHERE id = p_thread_id
  FOR UPDATE;

  IF p_actor_profile_id IS NULL
     OR v_t.id IS NULL
     OR p_actor_profile_id NOT IN (v_t.buyer_profile_id, v_t.seller_profile_id) THEN
    RETURN jsonb_build_object('success', false, 'unreadCount', 0, 'error', 'Teklif bulunamadı.');
  END IF;

  SELECT MAX(e.created_at)
  INTO v_read_at
  FROM public.offer_events e
  WHERE e.thread_id = v_t.id
    AND e.actor_profile_id IS DISTINCT FROM p_actor_profile_id;

  IF p_actor_profile_id = v_t.buyer_profile_id THEN
    UPDATE public.offer_threads
    SET buyer_hidden_at = clock_timestamp(),
        buyer_last_read_at = CASE
          WHEN v_read_at IS NULL THEN buyer_last_read_at
          ELSE GREATEST(COALESCE(buyer_last_read_at, '-infinity'::TIMESTAMPTZ), v_read_at)
        END
    WHERE id = v_t.id;
  ELSE
    UPDATE public.offer_threads
    SET seller_hidden_at = clock_timestamp(),
        seller_last_read_at = CASE
          WHEN v_read_at IS NULL THEN seller_last_read_at
          ELSE GREATEST(COALESCE(seller_last_read_at, '-infinity'::TIMESTAMPTZ), v_read_at)
        END
    WHERE id = v_t.id;
  END IF;

  SELECT public.get_offer_unread_count(p_actor_profile_id) INTO v_count;
  RETURN jsonb_build_object('success', true, 'unreadCount', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.close_offers_for_listing(
  p_listing_id UUID,
  p_reason TEXT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
  v_title TEXT;
BEGIN
  SELECT title INTO v_title FROM public.listings WHERE id = p_listing_id;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.closed_offer_threads(
    id UUID,
    buyer_profile_id UUID,
    seller_profile_id UUID
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.closed_offer_threads;

  INSERT INTO pg_temp.closed_offer_threads(id, buyer_profile_id, seller_profile_id)
  SELECT t.id, t.buyer_profile_id, t.seller_profile_id
  FROM public.offer_threads t
  WHERE t.listing_id = p_listing_id
    AND t.status = 'ACTIVE'
  ORDER BY t.id
  FOR UPDATE OF t;

  SELECT COUNT(*) INTO v_count FROM pg_temp.closed_offer_threads;

  UPDATE public.offer_threads t
  SET status = 'CLOSED',
      close_reason = p_reason,
      turn_profile_id = NULL,
      updated_at = NOW()
  FROM pg_temp.closed_offer_threads closed
  WHERE t.id = closed.id
    AND t.status = 'ACTIVE';

  INSERT INTO public.offer_events(thread_id, event_type, metadata)
  SELECT id, 'THREAD_CLOSED', jsonb_build_object('reason', p_reason)
  FROM pg_temp.closed_offer_threads
  ORDER BY id;

  INSERT INTO public.notifications(
    recipient_profile_id,
    user_id,
    type,
    title,
    message,
    entity_type,
    entity_id,
    metadata
  )
  SELECT participant.id,
         participant.user_id,
         'OFFER_ACTIVITY',
         'Teklif görüşmesi kapandı',
         CASE
           WHEN p_reason = 'LISTING_REMOVED_BY_ADMIN' THEN
             'İlan yönetim tarafından yayından kaldırıldı. Bu teklif görüşmesi artık devam ettirilemez.'
           ELSE COALESCE(v_title, 'İlan') || ' yayında olmadığı için bu teklif kapandı.'
         END,
         'offer',
         closed.id,
         jsonb_build_object('offerThreadId', closed.id, 'eventType', 'THREAD_CLOSED', 'reason', p_reason)
  FROM pg_temp.closed_offer_threads closed
  CROSS JOIN LATERAL (
    SELECT p.id, p.user_id
    FROM public.character_profiles p
    WHERE p.id IN (closed.buyer_profile_id, closed.seller_profile_id)
  ) participant;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_offer_listing_price_change(
  p_listing_id UUID,
  p_old_price BIGINT,
  p_new_price BIGINT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
  v_title TEXT;
BEGIN
  SELECT title INTO v_title FROM public.listings WHERE id = p_listing_id;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.price_changed_offer_threads(
    id UUID,
    buyer_profile_id UUID,
    seller_profile_id UUID
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.price_changed_offer_threads;

  INSERT INTO pg_temp.price_changed_offer_threads(id, buyer_profile_id, seller_profile_id)
  SELECT t.id, t.buyer_profile_id, t.seller_profile_id
  FROM public.offer_threads t
  WHERE t.listing_id = p_listing_id
    AND t.status = 'ACTIVE'
  ORDER BY t.id
  FOR UPDATE OF t;

  SELECT COUNT(*) INTO v_count FROM pg_temp.price_changed_offer_threads;

  INSERT INTO public.offer_events(thread_id, event_type, metadata)
  SELECT id,
         'LISTING_PRICE_CHANGED',
         jsonb_build_object('oldPrice', p_old_price, 'newPrice', p_new_price)
  FROM pg_temp.price_changed_offer_threads
  ORDER BY id;

  INSERT INTO public.notifications(
    recipient_profile_id,
    user_id,
    type,
    title,
    message,
    entity_type,
    entity_id,
    metadata
  )
  SELECT participant.id,
         participant.user_id,
         'OFFER_ACTIVITY',
         'İlan fiyatı değişti',
         COALESCE(v_title, 'İlan') || ' fiyatı güncellendi.',
         'offer',
         affected.id,
         jsonb_build_object(
           'offerThreadId', affected.id,
           'eventType', 'LISTING_PRICE_CHANGED',
           'oldPrice', p_old_price,
           'newPrice', p_new_price
         )
  FROM pg_temp.price_changed_offer_threads affected
  CROSS JOIN LATERAL (
    SELECT p.id, p.user_id
    FROM public.character_profiles p
    WHERE p.id IN (affected.buyer_profile_id, affected.seller_profile_id)
  ) participant;

  UPDATE public.offer_threads t
  SET updated_at = NOW()
  FROM pg_temp.price_changed_offer_threads affected
  WHERE t.id = affected.id;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_offer_threads()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT := 0;
  v_listing RECORD;
  v_expired BIGINT;
BEGIN
  FOR v_listing IN
    SELECT DISTINCT t.listing_id
    FROM public.offer_threads t
    JOIN public.listings l ON l.id = t.listing_id
    WHERE t.status = 'ACTIVE'
      AND (l.status <> 'ACTIVE' OR l.expires_at <= NOW())
    ORDER BY t.listing_id
  LOOP
    SELECT public.close_offers_for_listing(v_listing.listing_id, 'LISTING_EXPIRED')
    INTO v_expired;
    v_count := v_count + v_expired;
  END LOOP;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.expired_offer_threads(id UUID) ON COMMIT DROP;
  TRUNCATE pg_temp.expired_offer_threads;

  INSERT INTO pg_temp.expired_offer_threads(id)
  SELECT t.id
  FROM public.offer_threads t
  WHERE t.status = 'ACTIVE'
    AND t.expires_at <= NOW()
  ORDER BY t.id
  FOR UPDATE OF t;

  UPDATE public.offer_threads t
  SET status = 'EXPIRED',
      turn_profile_id = NULL,
      updated_at = NOW()
  FROM pg_temp.expired_offer_threads expired
  WHERE t.id = expired.id
    AND t.status = 'ACTIVE';

  GET DIAGNOSTICS v_expired = ROW_COUNT;

  INSERT INTO public.offer_events(thread_id, event_type, metadata)
  SELECT id, 'THREAD_CLOSED', jsonb_build_object('reason', 'RESPONSE_EXPIRED')
  FROM pg_temp.expired_offer_threads
  ORDER BY id;

  RETURN v_count + v_expired;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_offer_box_read(
  p_actor_profile_id UUID,
  p_box TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT := 0;
BEGIN
  IF p_actor_profile_id IS NULL OR p_box IS NULL OR p_box NOT IN ('received', 'sent') THEN
    RETURN jsonb_build_object('success', false, 'count', 0, 'error', 'Geçersiz teklif kutusu.');
  END IF;

  IF p_box = 'received' THEN
    PERFORM 1
    FROM public.offer_threads t
    WHERE t.seller_profile_id = p_actor_profile_id
      AND t.seller_hidden_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.offer_events e
        WHERE e.thread_id = t.id
          AND e.actor_profile_id IS DISTINCT FROM p_actor_profile_id
          AND e.created_at > COALESCE(t.seller_last_read_at, 'epoch'::TIMESTAMPTZ)
      )
    ORDER BY t.id
    FOR UPDATE;

    WITH unread_cursors AS (
      SELECT t.id, MAX(e.created_at) AS read_at
      FROM public.offer_threads t
      JOIN public.offer_events e ON e.thread_id = t.id
      WHERE t.seller_profile_id = p_actor_profile_id
        AND t.seller_hidden_at IS NULL
        AND e.actor_profile_id IS DISTINCT FROM p_actor_profile_id
        AND e.created_at > COALESCE(t.seller_last_read_at, 'epoch'::TIMESTAMPTZ)
      GROUP BY t.id
    ), updated AS (
      UPDATE public.offer_threads t
      SET seller_last_read_at = u.read_at
      FROM unread_cursors u
      WHERE t.id = u.id
      RETURNING t.id
    )
    SELECT COUNT(*) INTO v_count FROM updated;
  ELSE
    PERFORM 1
    FROM public.offer_threads t
    WHERE t.buyer_profile_id = p_actor_profile_id
      AND t.buyer_hidden_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.offer_events e
        WHERE e.thread_id = t.id
          AND e.actor_profile_id IS DISTINCT FROM p_actor_profile_id
          AND e.created_at > COALESCE(t.buyer_last_read_at, 'epoch'::TIMESTAMPTZ)
      )
    ORDER BY t.id
    FOR UPDATE;

    WITH unread_cursors AS (
      SELECT t.id, MAX(e.created_at) AS read_at
      FROM public.offer_threads t
      JOIN public.offer_events e ON e.thread_id = t.id
      WHERE t.buyer_profile_id = p_actor_profile_id
        AND t.buyer_hidden_at IS NULL
        AND e.actor_profile_id IS DISTINCT FROM p_actor_profile_id
        AND e.created_at > COALESCE(t.buyer_last_read_at, 'epoch'::TIMESTAMPTZ)
      GROUP BY t.id
    ), updated AS (
      UPDATE public.offer_threads t
      SET buyer_last_read_at = u.read_at
      FROM unread_cursors u
      WHERE t.id = u.id
      RETURNING t.id
    )
    SELECT COUNT(*) INTO v_count FROM updated;
  END IF;

  RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_offer_box_read(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_offer_box_read(UUID, TEXT) TO service_role;

COMMIT;