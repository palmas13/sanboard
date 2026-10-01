BEGIN;

CREATE OR REPLACE FUNCTION public.enqueue_orphan_media_cleanup_job(k text, t text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_key text := public.canonical_sanboard_media_key(k);
  expected_type text;
  existing public.media_cleanup_jobs%rowtype;
BEGIN
  IF clean_key IS NULL OR clean_key <> k OR clean_key LIKE '%/' THEN
    RAISE EXCEPTION 'invalid orphan media key';
  END IF;

  expected_type := CASE
    WHEN clean_key LIKE 'avatars/%' THEN 'AVATAR'
    WHEN clean_key LIKE 'listings/%' THEN 'LISTING_IMAGE'
    WHEN clean_key LIKE 'dealers/logos/%' THEN 'CORPORATE_LOGO'
    WHEN clean_key LIKE 'dealers/banners/%' THEN 'CORPORATE_BANNER'
  END;

  IF t IS DISTINCT FROM expected_type THEN
    RAISE EXCEPTION 'invalid orphan media type';
  END IF;

  IF public.is_media_key_referenced(clean_key) THEN
    RETURN 'REFERENCED';
  END IF;

  SELECT *
  INTO existing
  FROM public.media_cleanup_jobs
  WHERE idempotency_key = 'orphan:' || clean_key
  FOR UPDATE;

  IF FOUND THEN
    IF existing.status IN ('PENDING', 'PROCESSING', 'RETRY', 'FAILED') THEN
      RETURN 'ALREADY_QUEUED';
    END IF;

    UPDATE public.media_cleanup_jobs
    SET object_key = clean_key,
        media_type = t,
        reason = 'ORPHAN_RECONCILIATION',
        status = 'PENDING',
        attempt_count = 0,
        next_attempt_at = now(),
        lease_until = NULL,
        worker_id = NULL,
        lock_token = NULL,
        last_error = NULL,
        completed_at = NULL,
        updated_at = now()
    WHERE id = existing.id;

    RETURN 'ENQUEUED';
  END IF;

  INSERT INTO public.media_cleanup_jobs (
    object_key,
    media_type,
    reason,
    idempotency_key
  ) VALUES (
    clean_key,
    t,
    'ORPHAN_RECONCILIATION',
    'orphan:' || clean_key
  );

  RETURN 'ENQUEUED';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'ALREADY_QUEUED';
END
$$;

REVOKE ALL ON FUNCTION public.enqueue_orphan_media_cleanup_job(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_orphan_media_cleanup_job(text, text) TO service_role;

COMMIT;