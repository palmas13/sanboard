-- SANBOARD PRODUCTION SCHEMA RECONCILIATION
-- Prepared from the 2026-09-26 read-only production audit.
-- Do not apply automatically. Review and run the documented preflights first.

BEGIN;

-- Favorites are character-scoped. RLS enforces account ownership of profile_id.
-- Active-character selection remains an application-session concern.
DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorites;
CREATE POLICY "Users can view own favorites" ON public.favorites
  FOR SELECT
  USING (profile_id IN (SELECT public.get_auth_profile_ids()));

DROP POLICY IF EXISTS "Users can insert own favorites" ON public.favorites;
CREATE POLICY "Users can insert own favorites" ON public.favorites
  FOR INSERT
  WITH CHECK (profile_id IN (SELECT public.get_auth_profile_ids()));

DROP POLICY IF EXISTS "Users can delete own favorites" ON public.favorites;
CREATE POLICY "Users can delete own favorites" ON public.favorites
  FOR DELETE
  USING (profile_id IN (SELECT public.get_auth_profile_ids()));

-- The canonical price RPC notifies character profiles, not legacy account rows.
-- notifications_type_check is intentionally not replaced here: production's
-- current definition and stored types must be reviewed with the read-only
-- preflight before a separate additive constraint change is prepared.

CREATE OR REPLACE FUNCTION public.update_listing_price(
  p_listing_id UUID,
  p_new_price BIGINT,
  p_editor_user_id UUID DEFAULT NULL,
  p_editor_profile_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
  v_editor_role TEXT;
  v_notifications_sent INTEGER := 0;
  v_recipient_profile_id UUID;
BEGIN
  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'İlan bulunamadı.');
  END IF;
  IF v_listing.status IN ('SOLD', 'REMOVED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Satılmış veya yayından kaldırılmış ilanlar düzenlenemez.');
  END IF;

  SELECT role INTO v_editor_role
  FROM public.character_profiles
  WHERE id = p_editor_profile_id
    AND user_id = p_editor_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Editör karakteri bu hesaba ait değil.', 'status', 403);
  END IF;
  IF COALESCE(v_editor_role, '') <> 'ADMIN'
     AND p_editor_profile_id <> v_listing.seller_profile_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu ilanı düzenleme yetkiniz yok.', 'status', 403);
  END IF;
  IF p_new_price IS NULL OR p_new_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'İlan fiyatı pozitif olmalıdır.');
  END IF;

  UPDATE public.listings
  SET price = p_new_price,
      title = COALESCE(p_title, title),
      description = COALESCE(p_description, description),
      location = CASE WHEN category = 'vehicle' THEN NULL ELSE location END,
      updated_at = NOW()
  WHERE id = p_listing_id;

  IF p_new_price <> v_listing.price THEN
    INSERT INTO public.listing_price_history (listing_id, old_price, new_price, changed_at)
    VALUES (p_listing_id, v_listing.price, p_new_price, NOW());

    FOR v_recipient_profile_id IN
      SELECT DISTINCT f.profile_id
      FROM public.favorites f
      WHERE f.listing_id = p_listing_id
        AND f.profile_id IS NOT NULL
        AND f.profile_id <> v_listing.seller_profile_id
    LOOP
      IF p_new_price < v_listing.price THEN
      INSERT INTO public.notifications (
        recipient_profile_id, user_id, type, title, message,
        entity_type, entity_id, metadata, created_at
      )
      SELECT
        v_recipient_profile_id,
        cp.user_id,
        'LISTING_PRICE_DROP',
        'Favori İlanınızın Fiyatı Düştü',
        v_listing.title || ' ilanının fiyatı $' || to_char(v_listing.price, 'FM999,999,999') || ' → $' || to_char(p_new_price, 'FM999,999,999') || ' olarak güncellendi.',
        'listing', p_listing_id,
        jsonb_build_object('listingId', p_listing_id, 'oldPrice', v_listing.price, 'newPrice', p_new_price),
        NOW()
      FROM public.character_profiles cp
      WHERE cp.id = v_recipient_profile_id;
      v_notifications_sent := v_notifications_sent + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'listing_id', p_listing_id,
    'old_price', v_listing.price,
    'new_price', p_new_price,
    'notifications_sent', v_notifications_sent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_listing_price(UUID, BIGINT, UUID, UUID, TEXT, TEXT) TO service_role;

COMMIT;