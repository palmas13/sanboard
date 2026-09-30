ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS close_reason TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE public.sold_listing_audit
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS price BIGINT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS chk_listings_close_reason;
ALTER TABLE public.listings ADD CONSTRAINT chk_listings_close_reason
  CHECK (close_reason IS NULL OR close_reason IN ('SOLD', 'CANCELLED', 'OTHER', 'ADMIN_REMOVED'));

DROP FUNCTION IF EXISTS public.close_listing_with_offers(UUID, UUID, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.close_listing_with_offers(
  p_listing_id UUID,
  p_actor_profile_id UUID,
  p_status TEXT,
  p_admin BOOLEAN DEFAULT FALSE,
  p_close_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
  v_offer_reason TEXT;
  v_owner UUID;
  v_close_reason TEXT;
BEGIN
  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF v_listing.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'İlan bulunamadı.');
  END IF;

  IF v_listing.seller_type = 'CORPORATE' THEN
    SELECT owner_profile_id INTO v_owner
    FROM public.corporate_profiles
    WHERE id = v_listing.corporate_profile_id
      AND moderation_status = 'ACTIVE'
      AND deleted_at IS NULL;
  ELSE
    v_owner := v_listing.seller_profile_id;
  END IF;

  IF NOT p_admin AND v_owner IS DISTINCT FROM p_actor_profile_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu işlem için yetkiniz yok.');
  END IF;
  IF v_listing.status <> 'ACTIVE' OR v_listing.expires_at <= NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yalnızca yayındaki ilanlar kapatılabilir.');
  END IF;
  IF p_status NOT IN ('SOLD', 'REMOVED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Geçersiz ilan durumu.');
  END IF;

  v_close_reason := CASE
    WHEN p_admin THEN 'ADMIN_REMOVED'
    WHEN p_status = 'SOLD' AND p_close_reason = 'SOLD' THEN 'SOLD'
    WHEN p_status = 'REMOVED' AND p_close_reason IN ('CANCELLED', 'OTHER') THEN p_close_reason
    ELSE NULL
  END;
  IF v_close_reason IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'İlan durumu ile kapatma nedeni uyuşmuyor.');
  END IF;

  UPDATE public.listings
  SET status = p_status,
      close_reason = v_close_reason,
      closed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_listing_id;

  v_offer_reason := CASE
    WHEN p_status = 'SOLD' THEN 'LISTING_SOLD'
    WHEN p_admin THEN 'LISTING_REMOVED_BY_ADMIN'
    ELSE 'LISTING_REMOVED_BY_SELLER'
  END;
  PERFORM public.close_offers_for_listing(p_listing_id, v_offer_reason);
  RETURN jsonb_build_object('success', true, 'listing', (SELECT to_jsonb(l) FROM public.listings l WHERE l.id = p_listing_id));
END;
$$;

REVOKE ALL ON FUNCTION public.close_listing_with_offers(UUID, UUID, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_listings_sold_cleanup
  ON public.listings (closed_at)
  WHERE status = 'SOLD';