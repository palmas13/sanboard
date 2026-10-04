BEGIN;

CREATE OR REPLACE FUNCTION public.canonical_sanboard_media_key(v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT btrim(v) AS value
  ), candidate AS (
    SELECT CASE
      WHEN value IS NULL OR value = '' OR value LIKE 'data:%' THEN NULL
      WHEN value ~ '^/?(avatars/|listings/|dealers/logos/|dealers/banners/)' THEN
        regexp_replace(split_part(split_part(value, '?', 1), '#', 1), '^/+', '')
      WHEN value ~* '^https?://([^/]*\.r2\.dev|sanboard-media\.esin18457\.workers\.dev|cdn\.sanboard\.xyz)/(avatars/|listings/|dealers/logos/|dealers/banners/)' THEN
        regexp_replace(split_part(split_part(value, '?', 1), '#', 1), '^https?://[^/]+/', '', 'i')
      ELSE NULL
    END AS key
    FROM normalized
  )
  SELECT CASE
    WHEN key IS NULL OR key = '' OR key LIKE '%/' OR key LIKE '%..%' OR strpos(key, chr(92)) > 0 THEN NULL
    ELSE key
  END
  FROM candidate
$$;

CREATE OR REPLACE FUNCTION public.enqueue_media_cleanup_job(k text, t text, r text, i text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_key text := public.canonical_sanboard_media_key(k);
  job_id uuid;
BEGIN
  IF clean_key IS NULL OR nullif(btrim(i), '') IS NULL THEN
    RAISE EXCEPTION 'canonical media key and idempotency key required';
  END IF;

  INSERT INTO public.media_cleanup_jobs(object_key, media_type, reason, idempotency_key)
  VALUES(clean_key, t, r, i)
  ON CONFLICT(idempotency_key) DO UPDATE
  SET object_key = excluded.object_key,
      updated_at = now()
  RETURNING id INTO job_id;

  RETURN job_id;
END
$$;

CREATE OR REPLACE FUNCTION public.enqueue_listing_purge_job(lid uuid, r text DEFAULT 'RETENTION')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_row public.listings%rowtype;
  anchor_at timestamptz;
  purge_at timestamptz;
  keys jsonb;
  job_id uuid;
BEGIN
  SELECT * INTO listing_row FROM public.listings WHERE id = lid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'listing not found'; END IF;

  IF listing_row.status = 'REMOVED' THEN
    anchor_at := coalesce(listing_row.closed_at, listing_row.updated_at);
    purge_at := anchor_at;
  ELSIF listing_row.status = 'SOLD' THEN
    anchor_at := listing_row.closed_at;
    purge_at := anchor_at + interval '24 hours';
  ELSIF listing_row.status = 'EXPIRED' THEN
    anchor_at := listing_row.expires_at;
    purge_at := anchor_at + interval '7 days';
  ELSE
    RAISE EXCEPTION 'not purgeable';
  END IF;
  IF anchor_at IS NULL THEN RAISE EXCEPTION 'anchor null'; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.listing_images
    WHERE listing_id = lid
      AND nullif(btrim(storage_path), '') IS NOT NULL
      AND public.canonical_sanboard_media_key(storage_path) IS NULL
  ) THEN
    RAISE EXCEPTION 'listing contains noncanonical media reference';
  END IF;

  SELECT coalesce(jsonb_agg(key ORDER BY key), '[]'::jsonb)
  INTO keys
  FROM (
    SELECT DISTINCT public.canonical_sanboard_media_key(storage_path) AS key
    FROM public.listing_images
    WHERE listing_id = lid
  ) canonical
  WHERE key IS NOT NULL;

  INSERT INTO public.listing_purge_jobs(
    listing_id, expected_status, reason, retention_anchor, purge_after,
    media_keys, next_attempt_at, idempotency_key
  ) VALUES (
    lid, listing_row.status, r, anchor_at, purge_at,
    keys, purge_at, 'purge:' || lid || ':' || listing_row.status || ':' || anchor_at
  )
  ON CONFLICT(idempotency_key) DO UPDATE
  SET updated_at = now()
  RETURNING id INTO job_id;

  PERFORM public.enqueue_media_cleanup_job(
    key, 'LISTING_IMAGE', 'LISTING_PURGE', 'purge:' || job_id || ':' || key
  )
  FROM jsonb_array_elements_text(keys) key;

  RETURN job_id;
END
$$;

DO $$
DECLARE
  purge_job public.listing_purge_jobs%rowtype;
  listing_row public.listings%rowtype;
  canonical_keys jsonb;
  canonical_key text;
  cleanup_survivor uuid;
  cleanup_done boolean;
  cleanup_attempts integer;
  cleanup_max_attempts integer;
BEGIN
  FOR purge_job IN
    SELECT j.*
    FROM public.listing_purge_jobs j
    WHERE j.status IN ('PENDING', 'RETRY', 'FAILED')
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(j.media_keys) value
        WHERE public.canonical_sanboard_media_key(value) IS DISTINCT FROM value
          AND public.canonical_sanboard_media_key(value) IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(j.media_keys) value
        WHERE nullif(btrim(value), '') IS NOT NULL
          AND public.canonical_sanboard_media_key(value) IS NULL
      )
    FOR UPDATE
  LOOP
    IF purge_job.status = 'FAILED' THEN
      IF purge_job.last_error IS DISTINCT FROM 'Purge finalization did not converge: MEDIA_INCOMPLETE' THEN
        CONTINUE;
      END IF;

      SELECT * INTO listing_row FROM public.listings WHERE id = purge_job.listing_id FOR UPDATE;
      IF NOT FOUND
        OR listing_row.status IS DISTINCT FROM purge_job.expected_status
        OR (CASE listing_row.status
              WHEN 'REMOVED' THEN coalesce(listing_row.closed_at, listing_row.updated_at)
              WHEN 'SOLD' THEN listing_row.closed_at
              WHEN 'EXPIRED' THEN listing_row.expires_at
            END) IS DISTINCT FROM purge_job.retention_anchor
        OR now() < purge_job.purge_after THEN
        CONTINUE;
      END IF;
    END IF;

    SELECT coalesce(jsonb_agg(key ORDER BY key), '[]'::jsonb)
    INTO canonical_keys
    FROM (
      SELECT DISTINCT public.canonical_sanboard_media_key(value) AS key
      FROM jsonb_array_elements_text(purge_job.media_keys) value
      WHERE public.canonical_sanboard_media_key(value) IS NOT NULL
    ) normalized;

    FOR canonical_key IN SELECT jsonb_array_elements_text(canonical_keys)
    LOOP
      SELECT m.id
      INTO cleanup_survivor
      FROM public.media_cleanup_jobs m
      WHERE m.idempotency_key = 'purge:' || purge_job.id || ':' || canonical_key
         OR (
           m.idempotency_key LIKE 'purge:' || purge_job.id || ':%'
           AND public.canonical_sanboard_media_key(m.object_key) = canonical_key
         )
      ORDER BY (m.idempotency_key = 'purge:' || purge_job.id || ':' || canonical_key) DESC,
               (m.status = 'DONE') DESC,
               m.updated_at DESC
      LIMIT 1
      FOR UPDATE;

      SELECT coalesce(bool_or(m.status = 'DONE'), false),
             coalesce(max(m.attempt_count), 0),
             coalesce(max(m.max_attempts), 12)
      INTO cleanup_done, cleanup_attempts, cleanup_max_attempts
      FROM public.media_cleanup_jobs m
      WHERE m.idempotency_key LIKE 'purge:' || purge_job.id || ':%'
        AND public.canonical_sanboard_media_key(m.object_key) = canonical_key;

      IF cleanup_survivor IS NULL THEN
        INSERT INTO public.media_cleanup_jobs(
          object_key, media_type, reason, idempotency_key, status, next_attempt_at
        ) VALUES (
          canonical_key, 'LISTING_IMAGE', 'LISTING_PURGE',
          'purge:' || purge_job.id || ':' || canonical_key, 'PENDING', now()
        );
      ELSE
        DELETE FROM public.media_cleanup_jobs m
        WHERE m.id <> cleanup_survivor
          AND m.idempotency_key LIKE 'purge:' || purge_job.id || ':%'
          AND public.canonical_sanboard_media_key(m.object_key) = canonical_key;

        UPDATE public.media_cleanup_jobs
        SET object_key = canonical_key,
            media_type = 'LISTING_IMAGE',
            reason = 'LISTING_PURGE',
            idempotency_key = 'purge:' || purge_job.id || ':' || canonical_key,
            status = CASE WHEN cleanup_done THEN 'DONE' ELSE 'PENDING' END,
            attempt_count = cleanup_attempts,
            max_attempts = cleanup_max_attempts,
            next_attempt_at = CASE WHEN cleanup_done THEN next_attempt_at ELSE now() END,
            lease_until = NULL,
            worker_id = NULL,
            lock_token = NULL,
            last_error = CASE WHEN cleanup_done THEN NULL ELSE last_error END,
            completed_at = CASE WHEN cleanup_done THEN coalesce(completed_at, now()) ELSE NULL END,
            updated_at = now()
        WHERE id = cleanup_survivor;
      END IF;
    END LOOP;

    UPDATE public.listing_purge_jobs
    SET media_keys = canonical_keys,
        status = 'RETRY',
        attempts = least(attempts, max_attempts - 1),
        next_attempt_at = now(),
        lease_until = NULL,
        worker_id = NULL,
        lock_token = NULL,
        last_error = NULL,
        completed_at = NULL,
        updated_at = now()
    WHERE id = purge_job.id;
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.canonical_sanboard_media_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_sanboard_media_key(text) TO service_role;
REVOKE ALL ON FUNCTION public.enqueue_media_cleanup_job(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_media_cleanup_job(text, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.enqueue_listing_purge_job(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_listing_purge_job(uuid, text) TO service_role;

COMMIT;
