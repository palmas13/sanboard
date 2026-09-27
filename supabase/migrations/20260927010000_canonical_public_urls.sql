BEGIN;

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS public_id TEXT;

CREATE OR REPLACE FUNCTION public.generate_listing_public_id()
RETURNS TEXT LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE v_candidate TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('public.listings.public_id'));
  LOOP
    v_candidate := (floor(random() * 900000) + 100000)::INTEGER::TEXT;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.listings WHERE public_id = v_candidate);
  END LOOP;
  RETURN v_candidate;
END;
$$;

UPDATE public.listings
SET public_id = public.generate_listing_public_id()
WHERE public_id IS NULL OR public_id !~ '^[1-9][0-9]{5}$';

ALTER TABLE public.listings
  ALTER COLUMN public_id SET DEFAULT public.generate_listing_public_id(),
  ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_public_id_format_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_public_id_format_check CHECK (public_id ~ '^[1-9][0-9]{5}$');
CREATE UNIQUE INDEX IF NOT EXISTS listings_public_id_unique_idx ON public.listings(public_id);

CREATE OR REPLACE FUNCTION public.prevent_listing_public_id_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.public_id IS DISTINCT FROM NEW.public_id THEN
    RAISE EXCEPTION 'listings.public_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS listings_public_id_immutable ON public.listings;
CREATE TRIGGER listings_public_id_immutable BEFORE UPDATE OF public_id ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.prevent_listing_public_id_change();

CREATE OR REPLACE FUNCTION public.slugify_canonical(value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $$
  SELECT COALESCE(NULLIF(trim(BOTH '-' FROM regexp_replace(
    lower(translate(value, 'ÇĞİIÖŞÜçğıöşü', 'CGIIOSUcgiosu')), '[^a-z0-9]+', '-', 'g'
  )), ''), 'kurumsal');
$$;

ALTER TABLE public.corporate_profiles ALTER COLUMN slug DROP NOT NULL;
DO $$
DECLARE constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.corporate_profiles'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.corporate_profiles'::regclass AND attname = 'slug')]
  LOOP
    EXECUTE format('ALTER TABLE public.corporate_profiles DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END;
$$;
DROP INDEX IF EXISTS public.corporate_profiles_slug_unique_idx;
WITH ranked AS (
  SELECT id, public.slugify_canonical(company_name) AS base_slug,
    row_number() OVER (PARTITION BY public.slugify_canonical(company_name) ORDER BY created_at, id) AS slug_rank
  FROM public.corporate_profiles
)
UPDATE public.corporate_profiles AS profile
SET slug = CASE WHEN ranked.slug_rank = 1 THEN ranked.base_slug ELSE ranked.base_slug || '-' || ranked.slug_rank::TEXT END
FROM ranked WHERE profile.id = ranked.id;
CREATE UNIQUE INDEX IF NOT EXISTS corporate_profiles_slug_unique_idx ON public.corporate_profiles(slug);
ALTER TABLE public.corporate_profiles ALTER COLUMN slug SET NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_corporate_profile_slug()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_base TEXT; v_candidate TEXT; v_suffix INTEGER := 1;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL THEN
    NEW.slug := OLD.slug;
    RETURN NEW;
  END IF;
  v_base := public.slugify_canonical(NEW.company_name);
  PERFORM pg_advisory_xact_lock(hashtext('public.corporate_profiles.slug:' || v_base));
  v_candidate := v_base;
  WHILE EXISTS (SELECT 1 FROM public.corporate_profiles WHERE slug = v_candidate) LOOP
    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix::TEXT;
  END LOOP;
  NEW.slug := v_candidate;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS corporate_profiles_assign_slug ON public.corporate_profiles;
CREATE TRIGGER corporate_profiles_assign_slug BEFORE INSERT OR UPDATE OF slug ON public.corporate_profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_corporate_profile_slug();

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
  IF p_listing->>'category' = 'vehicle' AND jsonb_array_length(p_images) > 3 THEN RAISE EXCEPTION 'Araç ilanlarında en fazla 3 fotoğraf kullanılabilir.'; END IF;
  IF p_listing->>'category' = 'property' AND jsonb_array_length(p_images) > 5 THEN RAISE EXCEPTION 'Mülk ilanlarında en fazla 5 fotoğraf kullanılabilir.'; END IF;

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
        category, subcategory, title, description, price, location, status, published_at, expires_at)
      VALUES (public.generate_listing_public_id(), p_listing->>'listing_number', p_profile_id, p_seller_type,
        CASE WHEN p_seller_type = 'CORPORATE' THEN p_corporate_profile_id ELSE NULL END,
        p_listing->>'category', p_listing->>'subcategory', p_listing->>'title', p_listing->>'description',
        (p_listing->>'price')::BIGINT, NULLIF(p_listing->>'location', ''), 'ACTIVE', v_now,
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
    INSERT INTO public.property_details (listing_id, property_type, floor, room_count, furnished, building_type, balcony)
    VALUES (v_listing.id, p_details->>'property_type', COALESCE((p_details->>'floor')::INTEGER,1),
      COALESCE(p_details->>'room_count','1+1'), COALESCE((p_details->>'furnished')::BOOLEAN,false),
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

REVOKE EXECUTE ON FUNCTION public.generate_listing_public_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_listing_public_id() TO service_role;

COMMIT;