-- Add persisted property alarm and positive room/unit number fields without
-- assigning invented values to historical listings. Also carry both fields
-- through the canonical credit-consuming listing creation RPC.
BEGIN;

ALTER TABLE public.property_details
  ADD COLUMN IF NOT EXISTS room_number INTEGER,
  ADD COLUMN IF NOT EXISTS alarm BOOLEAN;

ALTER TABLE public.property_details
  DROP CONSTRAINT IF EXISTS property_details_room_number_check;

ALTER TABLE public.property_details
  ADD CONSTRAINT property_details_room_number_check
    CHECK (room_number IS NULL OR room_number > 0);

CREATE OR REPLACE FUNCTION public.create_listing_with_credit(
  p_profile_id UUID, p_seller_type TEXT, p_corporate_profile_id UUID,
  p_listing JSONB, p_details JSONB, p_images JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_credit public.listing_credits%ROWTYPE; v_listing public.listings%ROWTYPE;
  v_store public.corporate_profiles%ROWTYPE; v_days INTEGER; v_now TIMESTAMPTZ := NOW(); v_attempt INTEGER := 0;
BEGIN
  IF p_seller_type NOT IN ('INDIVIDUAL', 'CORPORATE') THEN RAISE EXCEPTION 'Desteklenmeyen satıcı tipi: %', p_seller_type; END IF;
  IF p_listing->>'category' NOT IN ('vehicle', 'property') THEN RAISE EXCEPTION 'Desteklenmeyen ilan kategorisi'; END IF;
  IF jsonb_typeof(p_images) <> 'array' THEN RAISE EXCEPTION 'İlan fotoğrafları dizi formatında olmalıdır.'; END IF;
  IF jsonb_array_length(p_images) < 1 THEN RAISE EXCEPTION 'En az 1 fotoğraf yüklenmelidir.'; END IF;
  IF p_listing->>'category' = 'vehicle' AND jsonb_array_length(p_images) > 3 THEN RAISE EXCEPTION 'Araç ilanlarında en fazla 3 fotoğraf kullanılabilir.'; END IF;
  IF p_listing->>'category' = 'property' AND jsonb_array_length(p_images) > 5 THEN RAISE EXCEPTION 'Mülk ilanlarında en fazla 5 fotoğraf kullanılabilir.'; END IF;
  IF p_listing->>'category' = 'property' AND COALESCE((p_details->>'room_number')::INTEGER, 0) <= 0 THEN RAISE EXCEPTION 'Oda no 0’dan büyük bir tam sayı olmalıdır.'; END IF;
  IF p_listing->>'category' = 'property' AND COALESCE(jsonb_typeof(p_details->'alarm'), 'missing') <> 'boolean' THEN RAISE EXCEPTION 'Alarm bilgisi boolean olmalıdır.'; END IF;

  IF p_seller_type = 'CORPORATE' THEN
    SELECT * INTO v_store FROM public.corporate_profiles WHERE id = p_corporate_profile_id
      AND owner_profile_id = p_profile_id AND status = 'APPROVED' AND moderation_status = 'ACTIVE'
      AND subscription_status = 'ACTIVE' AND subscription_expires_at > v_now FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Kurumsal mağaza ilan yayınlamaya uygun değil.'); END IF;
    SELECT * INTO v_credit FROM public.listing_credits WHERE profile_id = p_profile_id AND status = 'AVAILABLE'
      AND credit_type = 'CORPORATE' AND corporate_profile_id = p_corporate_profile_id
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
    v_days := 14;
  ELSE
    SELECT * INTO v_credit FROM public.listing_credits WHERE profile_id = p_profile_id AND status = 'AVAILABLE'
      AND credit_type = 'INDIVIDUAL' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
    v_days := 7;
  END IF;
  IF v_credit.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Uygun yayın hakkı bulunamadı.'); END IF;

  LOOP
    v_attempt := v_attempt + 1;
    BEGIN
      INSERT INTO public.listings (public_id, listing_number, seller_profile_id, seller_type, corporate_profile_id,
        category, subcategory, title, description, price, offers_enabled, minimum_offer_amount, location, status, published_at, expires_at)
      VALUES (public.generate_listing_public_id(), p_listing->>'listing_number', p_profile_id, p_seller_type,
        CASE WHEN p_seller_type = 'CORPORATE' THEN p_corporate_profile_id ELSE NULL END,
        p_listing->>'category', p_listing->>'subcategory', p_listing->>'title', p_listing->>'description',
        (p_listing->>'price')::BIGINT, COALESCE((p_listing->>'offers_enabled')::BOOLEAN, TRUE),
        (p_listing->>'minimum_offer_amount')::BIGINT, NULLIF(p_listing->>'location', ''), 'ACTIVE', v_now,
        v_now + make_interval(days => v_days)) RETURNING * INTO v_listing;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 10 THEN RAISE; END IF;
    END;
  END LOOP;

  IF v_listing.category = 'vehicle' THEN
    INSERT INTO public.vehicle_details (listing_id, vehicle_category, brand, model, plate, mileage, engine_upgrade,
      transmission_upgrade, brake_upgrade, turbo, subwoofer, trade_available, lock_level, alarm_level,
      anti_theft_level, engine_health, suspension, fuel_type, factory_price)
    VALUES (v_listing.id, p_details->>'vehicle_category', COALESCE(p_details->>'brand',''), COALESCE(p_details->>'model',''),
      COALESCE(p_details->>'plate','LS-TEMP'), COALESCE((p_details->>'mileage')::INTEGER,0),
      COALESCE((p_details->>'engine_upgrade')::INTEGER,0), COALESCE((p_details->>'transmission_upgrade')::INTEGER,0),
      COALESCE((p_details->>'brake_upgrade')::INTEGER,0), COALESCE((p_details->>'turbo')::BOOLEAN,false),
      COALESCE((p_details->>'subwoofer')::BOOLEAN,false), COALESCE((p_details->>'trade_available')::BOOLEAN,false),
      (p_details->>'lock_level')::INTEGER, (p_details->>'alarm_level')::INTEGER, (p_details->>'anti_theft_level')::INTEGER,
      (p_details->>'engine_health')::INTEGER, NULLIF(p_details->>'suspension',''), NULLIF(p_details->>'fuel_type',''),
      (p_details->>'factory_price')::BIGINT);
  ELSE
    INSERT INTO public.property_details (listing_id, property_type, floor, room_count, room_number, furnished, alarm,
      market_value, furniture_value, building_type, balcony)
    VALUES (v_listing.id, p_details->>'property_type', COALESCE((p_details->>'floor')::INTEGER,1),
      COALESCE(p_details->>'room_count','1+1'), (p_details->>'room_number')::INTEGER,
      COALESCE((p_details->>'furnished')::BOOLEAN,false), (p_details->>'alarm')::BOOLEAN,
      (p_details->>'market_value')::BIGINT,
      CASE WHEN COALESCE((p_details->>'furnished')::BOOLEAN,false) THEN (p_details->>'furniture_value')::BIGINT ELSE NULL END,
      COALESCE(p_details->>'building_type','Normal'), COALESCE((p_details->>'balcony')::BOOLEAN,false));
  END IF;

  INSERT INTO public.listing_images (listing_id, storage_path, sort_order, is_cover, size_bytes)
  SELECT v_listing.id, image->>'storage_path', COALESCE((image->>'sort_order')::SMALLINT, 0),
    COALESCE((image->>'is_cover')::BOOLEAN, false), COALESCE((image->>'size_bytes')::INTEGER, 0)
  FROM jsonb_array_elements(p_images) image;
  UPDATE public.listing_credits SET status = 'USED', used_listing_id = v_listing.id, used_at = v_now WHERE id = v_credit.id;
  RETURN jsonb_build_object('success', true, 'listing', to_jsonb(v_listing));
END;
$$;

REVOKE ALL ON FUNCTION public.create_listing_with_credit(UUID, TEXT, UUID, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_listing_with_credit(UUID, TEXT, UUID, JSONB, JSONB, JSONB) TO service_role;

COMMIT;