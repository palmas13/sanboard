BEGIN;

CREATE OR REPLACE FUNCTION public.finalize_listing_media_image(
  p_image_id uuid,
  p_listing_id uuid,
  p_expected_old_key text,
  p_new_key text,
  p_new_storage_path text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  image_row public.listing_images%rowtype;
  old_key text := public.canonical_sanboard_media_key(p_expected_old_key);
  new_key text := public.canonical_sanboard_media_key(p_new_key);
  current_key text;
BEGIN
  IF old_key IS NULL OR old_key <> p_expected_old_key OR new_key IS NULL OR new_key <> p_new_key THEN
    RAISE EXCEPTION 'invalid listing media key';
  END IF;
  IF old_key LIKE '%/' OR new_key LIKE '%/' OR new_key NOT LIKE ('listings/' || p_listing_id::text || '/%') THEN
    RAISE EXCEPTION 'invalid canonical listing media destination';
  END IF;
  IF public.canonical_sanboard_media_key(p_new_storage_path) IS DISTINCT FROM new_key THEN
    RAISE EXCEPTION 'invalid listing media storage path';
  END IF;

  SELECT * INTO image_row
  FROM public.listing_images
  WHERE id = p_image_id
  FOR UPDATE;

  IF NOT FOUND OR image_row.listing_id IS DISTINCT FROM p_listing_id THEN
    RETURN 'NOT_FOUND';
  END IF;
  current_key := public.canonical_sanboard_media_key(image_row.storage_path);
  IF current_key = new_key THEN
    RETURN 'ALREADY_FINALIZED';
  END IF;
  IF current_key IS DISTINCT FROM old_key THEN
    RETURN 'STALE';
  END IF;

  UPDATE public.listing_images
  SET storage_path = p_new_storage_path
  WHERE id = p_image_id AND listing_id = p_listing_id;

  PERFORM public.enqueue_media_cleanup_job(
    old_key,
    'LISTING_IMAGE',
    'LISTING_MEDIA_FINALIZED',
    'listing-finalize:' || p_image_id::text || ':' || old_key
  );
  RETURN 'FINALIZED';
END
$$;

REVOKE ALL ON FUNCTION public.finalize_listing_media_image(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_listing_media_image(uuid, uuid, text, text, text) TO service_role;

COMMIT;