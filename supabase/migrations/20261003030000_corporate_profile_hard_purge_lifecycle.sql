-- Durable corporate-profile hard purge lifecycle.
-- Forward-only migration prepared on 2026-10-03. Do not apply automatically.
BEGIN;

-- Production drift left this unconditional rule installed alongside the intended partial rule.
ALTER TABLE public.corporate_profiles
  DROP CONSTRAINT IF EXISTS uq_corporate_profiles_owner_profile_id;
DROP INDEX IF EXISTS public.uq_corporate_profiles_owner_profile_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.corporate_profiles
    WHERE deleted_at IS NULL AND moderation_status <> 'DELETED'
    GROUP BY owner_profile_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot install live-owner uniqueness: duplicate live corporate owners exist';
  END IF;
END $$;

DROP INDEX IF EXISTS public.uq_corporate_profiles_active_owner;
CREATE UNIQUE INDEX uq_corporate_profiles_active_owner
  ON public.corporate_profiles(owner_profile_id)
  WHERE deleted_at IS NULL AND moderation_status <> 'DELETED';

ALTER TABLE public.corporate_profiles
  ADD COLUMN IF NOT EXISTS purge_requested_at timestamptz;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS historical_corporate_profile_id uuid,
  ADD COLUMN IF NOT EXISTS corporate_profile_snapshot jsonb;
ALTER TABLE public.listing_credits
  ADD COLUMN IF NOT EXISTS historical_corporate_profile_id uuid,
  ADD COLUMN IF NOT EXISTS corporate_profile_snapshot jsonb;
ALTER TABLE public.offer_threads
  ADD COLUMN IF NOT EXISTS historical_seller_corporate_profile_id uuid,
  ADD COLUMN IF NOT EXISTS seller_corporate_snapshot jsonb;

UPDATE public.payments p
SET historical_corporate_profile_id = p.corporate_profile_id,
    corporate_profile_snapshot = COALESCE(p.corporate_profile_snapshot, jsonb_build_object(
      'id', c.id, 'owner_profile_id', c.owner_profile_id, 'company_name', c.company_name,
      'slug', c.slug, 'public_id', c.public_id
    ))
FROM public.corporate_profiles c
WHERE p.corporate_profile_id = c.id
  AND p.historical_corporate_profile_id IS NULL;

UPDATE public.listing_credits lc
SET historical_corporate_profile_id = lc.corporate_profile_id,
    corporate_profile_snapshot = COALESCE(lc.corporate_profile_snapshot, jsonb_build_object(
      'id', c.id, 'owner_profile_id', c.owner_profile_id, 'company_name', c.company_name,
      'slug', c.slug, 'public_id', c.public_id
    ))
FROM public.corporate_profiles c
WHERE lc.corporate_profile_id = c.id
  AND lc.historical_corporate_profile_id IS NULL;

UPDATE public.offer_threads ot
SET historical_seller_corporate_profile_id = ot.seller_corporate_profile_id,
    seller_corporate_snapshot = COALESCE(ot.seller_corporate_snapshot, jsonb_build_object(
      'id', c.id, 'owner_profile_id', c.owner_profile_id, 'company_name', c.company_name,
      'slug', c.slug, 'public_id', c.public_id
    ))
FROM public.corporate_profiles c
WHERE ot.seller_corporate_profile_id = c.id
  AND ot.historical_seller_corporate_profile_id IS NULL;

ALTER TABLE public.offer_threads DROP CONSTRAINT IF EXISTS offer_threads_seller_corporate_profile_id_fkey;
ALTER TABLE public.offer_threads
  ADD CONSTRAINT offer_threads_seller_corporate_profile_id_fkey
  FOREIGN KEY (seller_corporate_profile_id) REFERENCES public.corporate_profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.corporate_profile_purge_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corporate_profile_id uuid NOT NULL,
  owner_profile_id uuid NOT NULL,
  corporate_snapshot jsonb NOT NULL,
  media_keys jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(media_keys) = 'array'),
  completed_media_keys jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(completed_media_keys) = 'array'),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','RETRY','DONE','FAILED','CANCELLED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 12 CHECK (max_attempts > 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  worker_id text,
  lock_token uuid,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  idempotency_key text NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS corporate_profile_purge_jobs_ready
  ON public.corporate_profile_purge_jobs(next_attempt_at)
  WHERE status IN ('PENDING','RETRY');
ALTER TABLE public.corporate_profile_purge_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.corporate_profile_purge_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.corporate_profile_purge_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.corporate_profile_snapshot(c public.corporate_profiles)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', c.id, 'owner_profile_id', c.owner_profile_id, 'company_name', c.company_name,
    'slug', c.slug, 'public_id', c.public_id, 'status', c.status,
    'moderation_status', c.moderation_status, 'created_at', c.created_at,
    'deleted_at', c.deleted_at
  )
$$;

CREATE OR REPLACE FUNCTION public.is_corporate_purge_media_key_referenced(k text, x uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.corporate_profiles c
    WHERE c.id <> x AND (
      public.canonical_sanboard_media_key(c.logo_path) = k OR
      public.canonical_sanboard_media_key(c.logo_url) = k OR
      public.canonical_sanboard_media_key(c.banner_path) = k OR
      public.canonical_sanboard_media_key(c.banner_url) = k
    )
  ) OR EXISTS (
    SELECT 1 FROM public.character_profiles p
    WHERE public.canonical_sanboard_media_key(p.avatar_path) = k
       OR public.canonical_sanboard_media_key(p.avatar_url) = k
  ) OR EXISTS (
    SELECT 1 FROM public.listing_images li
    WHERE public.canonical_sanboard_media_key(li.storage_path) = k
  )
$$;

CREATE OR REPLACE FUNCTION public.enqueue_corporate_profile_purge_job(p_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.corporate_profiles%rowtype;
  job_id uuid;
  keys jsonb;
BEGIN
  SELECT * INTO c FROM public.corporate_profiles WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR c.moderation_status <> 'DELETED' OR c.deleted_at IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(jsonb_agg(DISTINCT k), '[]'::jsonb) INTO keys
  FROM (VALUES
    (public.canonical_sanboard_media_key(c.logo_path)),
    (public.canonical_sanboard_media_key(c.logo_url)),
    (public.canonical_sanboard_media_key(c.banner_path)),
    (public.canonical_sanboard_media_key(c.banner_url))
  ) media(k) WHERE k IS NOT NULL;
  INSERT INTO public.corporate_profile_purge_jobs(
    corporate_profile_id, owner_profile_id, corporate_snapshot, media_keys, idempotency_key
  ) VALUES (c.id, c.owner_profile_id, public.corporate_profile_snapshot(c), keys, 'corporate-purge:' || c.id)
  ON CONFLICT (idempotency_key) DO UPDATE SET
    corporate_snapshot = EXCLUDED.corporate_snapshot,
    media_keys = EXCLUDED.media_keys,
    status = CASE WHEN corporate_profile_purge_jobs.status IN ('DONE','PROCESSING') THEN corporate_profile_purge_jobs.status ELSE 'PENDING' END,
    next_attempt_at = CASE WHEN corporate_profile_purge_jobs.status IN ('DONE','PROCESSING') THEN corporate_profile_purge_jobs.next_attempt_at ELSE now() END,
    updated_at = now()
  RETURNING id INTO job_id;
  RETURN job_id;
END $$;

CREATE OR REPLACE FUNCTION public.request_corporate_profile_purge(
  p_corporate_profile_id uuid, p_reason text, p_admin_profile_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.corporate_profiles%rowtype;
  admin_ok boolean;
  now_at timestamptz := now();
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.character_profiles WHERE id = p_admin_profile_id AND role = 'ADMIN') INTO admin_ok;
  IF NOT admin_ok THEN RETURN jsonb_build_object('success', false, 'error', 'Yönetici yetkisi doğrulanamadı.'); END IF;
  IF btrim(COALESCE(p_reason, '')) = '' THEN RETURN jsonb_build_object('success', false, 'error', 'Silme gerekçesi zorunludur.'); END IF;
  SELECT * INTO c FROM public.corporate_profiles WHERE id = p_corporate_profile_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Kurumsal mağaza bulunamadı.'); END IF;

  UPDATE public.corporate_profiles SET
    moderation_status = 'DELETED', deleted_at = COALESCE(deleted_at, now_at),
    purge_requested_at = COALESCE(purge_requested_at, now_at), deleted_by_profile_id = p_admin_profile_id,
    deletion_reason = p_reason, subscription_status = 'INACTIVE', subscription_expires_at = NULL,
    current_period_start = NULL, current_period_end = NULL,
    monthly_boost_credits = 0, purchased_boost_credits = 0, boost_credits = 0, updated_at = now_at
  WHERE id = c.id RETURNING * INTO c;

  UPDATE public.character_profiles SET is_dealer = false, dealer_id = NULL, updated_at = now_at
  WHERE id = c.owner_profile_id AND (dealer_id = c.id::text OR is_dealer = true);

  PERFORM public.close_offers_for_listing(l.id, 'LISTING_REMOVED_BY_ADMIN')
  FROM public.listings l WHERE l.corporate_profile_id = c.id AND l.status = 'ACTIVE';
  UPDATE public.listings SET status = 'REMOVED', close_reason = 'ADMIN_REMOVED', closed_at = now_at, updated_at = now_at
  WHERE corporate_profile_id = c.id AND status = 'ACTIVE';
  PERFORM public.enqueue_listing_purge_job(l.id, 'CORPORATE_PROFILE_PURGE')
  FROM public.listings l WHERE l.corporate_profile_id = c.id AND l.status = 'REMOVED';

  PERFORM public.enqueue_corporate_profile_purge_job(c.id);
  RETURN jsonb_build_object('success', true, 'corporate_profile_id', c.id);
END $$;

CREATE OR REPLACE FUNCTION public.discover_corporate_purge_jobs(n integer DEFAULT 25)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; discovered integer := 0;
BEGIN
  FOR c IN SELECT id FROM public.corporate_profiles
    WHERE moderation_status = 'DELETED' AND deleted_at IS NOT NULL
    ORDER BY deleted_at LIMIT GREATEST(1, LEAST(n, 100))
  LOOP
    UPDATE public.character_profiles SET is_dealer = false, dealer_id = NULL, updated_at = now()
    WHERE dealer_id = c.id::text;
    PERFORM public.close_offers_for_listing(l.id, 'LISTING_REMOVED_BY_ADMIN')
    FROM public.listings l WHERE l.corporate_profile_id = c.id AND l.status = 'ACTIVE';
    UPDATE public.listings SET status = 'REMOVED', close_reason = 'ADMIN_REMOVED', closed_at = now(), updated_at = now()
    WHERE corporate_profile_id = c.id AND status = 'ACTIVE';
    PERFORM public.enqueue_corporate_profile_purge_job(c.id); discovered := discovered + 1;
    PERFORM public.enqueue_listing_purge_job(l.id, 'CORPORATE_PROFILE_RECONCILIATION')
    FROM public.listings l WHERE l.corporate_profile_id = c.id AND l.status = 'REMOVED';
  END LOOP;
  RETURN discovered;
END $$;

CREATE OR REPLACE FUNCTION public.review_corporate_application(
  p_application_id UUID, p_status TEXT, p_rejection_reason TEXT DEFAULT NULL, p_reviewer_user_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_application public.corporate_applications%ROWTYPE; v_profile public.character_profiles%ROWTYPE;
  v_store public.corporate_profiles%ROWTYPE; v_now TIMESTAMPTZ := NOW(); v_reason TEXT; v_slug_base TEXT; v_slug TEXT;
BEGIN
  IF p_status NOT IN ('APPROVED', 'REJECTED') THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Geçersiz başvuru durumu.'); END IF;
  SELECT * INTO v_application FROM public.corporate_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Başvuru bulunamadı.'); END IF;
  IF v_application.status <> 'PENDING' THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Başvuru daha önce değerlendirilmiş.'); END IF;
  SELECT * INTO v_profile FROM public.character_profiles WHERE id = v_application.applicant_profile_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Başvuru sahibi karakter bulunamadı.'); END IF;
  IF p_status = 'APPROVED' THEN
    SELECT * INTO v_store FROM public.corporate_profiles
    WHERE owner_profile_id = v_profile.id AND deleted_at IS NULL AND moderation_status <> 'DELETED' FOR UPDATE;
    IF FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Bu karakterin zaten onaylanmış bir kurumsal mağazası bulunmaktadır.'); END IF;
    v_slug_base := trim(BOTH '-' FROM regexp_replace(translate(lower(v_application.company_name), 'çğıöşü', 'cgiosu'), '[^a-z0-9]+', '-', 'g'));
    IF v_slug_base = '' THEN v_slug_base := 'kurumsal-magaza'; END IF;
    v_slug := v_slug_base || '-' || left(replace(p_application_id::TEXT, '-', ''), 8);
    INSERT INTO public.corporate_profiles(owner_profile_id, company_name, slug, description, phone, email, address,
      status, subscription_status, subscription_expires_at, current_period_start, current_period_end,
      moderation_status, boost_credits, monthly_boost_credits, purchased_boost_credits, created_at, updated_at)
    VALUES(v_profile.id, v_application.company_name, v_slug, v_application.purpose, v_application.contact_phone,
      v_application.contact_email, v_application.location, 'APPROVED', 'INACTIVE', NULL, NULL, NULL, 'ACTIVE', 0, 0, 0, v_now, v_now)
    RETURNING * INTO v_store;
    UPDATE public.corporate_applications SET status = 'APPROVED', rejection_reason = NULL,
      reviewed_by = p_reviewer_user_id, reviewed_at = v_now WHERE id = v_application.id;
    UPDATE public.character_profiles SET is_dealer = TRUE, dealer_id = v_store.id, updated_at = v_now WHERE id = v_profile.id;
    INSERT INTO public.notifications(recipient_profile_id, user_id, type, title, message, entity_type, entity_id, metadata, created_at)
    VALUES(v_profile.id, v_profile.user_id, 'CORPORATE_APPLICATION_APPROVED', 'Kurumsal Profiliniz Onaylandı',
      format('"%s" adına yaptığınız kurumsal satış başvurusu onaylanmıştır.', v_application.company_name),
      'application', v_application.id, jsonb_build_object('corporateProfileId', v_store.id), v_now);
    RETURN jsonb_build_object('success', TRUE, 'dealer', to_jsonb(v_store));
  END IF;
  v_reason := COALESCE(NULLIF(btrim(p_rejection_reason), ''), 'Fiziksel işletme bilgileri doğrulanamadı.');
  UPDATE public.corporate_applications SET status = 'REJECTED', rejection_reason = v_reason,
    reviewed_by = p_reviewer_user_id, reviewed_at = v_now WHERE id = v_application.id;
  INSERT INTO public.notifications(recipient_profile_id, user_id, type, title, message, entity_type, entity_id, created_at)
  VALUES(v_profile.id, v_profile.user_id, 'CORPORATE_APPLICATION_REJECTED', 'Kurumsal Başvurunuz Reddedildi',
    format('Kurumsal hesap başvurunuz reddedildi. Neden: %s', v_reason), 'application', v_application.id, v_now);
  RETURN jsonb_build_object('success', TRUE);
END $$;

CREATE OR REPLACE FUNCTION public.claim_corporate_purge_jobs(w text, n integer DEFAULT 25, s integer DEFAULT 300)
RETURNS SETOF public.corporate_profile_purge_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY WITH candidates AS (
    SELECT id FROM public.corporate_profile_purge_jobs
    WHERE status IN ('PENDING','RETRY') AND next_attempt_at <= now()
      AND (lease_until IS NULL OR lease_until < now())
    ORDER BY next_attempt_at, created_at FOR UPDATE SKIP LOCKED LIMIT GREATEST(1, LEAST(n, 100))
  ) UPDATE public.corporate_profile_purge_jobs j SET
    status = 'PROCESSING', attempts = attempts + 1, worker_id = w,
    lock_token = gen_random_uuid(), lease_until = now() + make_interval(secs => GREATEST(30, LEAST(s, 900))),
    updated_at = now()
  FROM candidates WHERE j.id = candidates.id RETURNING j.*;
END $$;

CREATE OR REPLACE FUNCTION public.complete_corporate_purge_media_key(i uuid, t uuid, k text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated boolean;
BEGIN
  UPDATE public.corporate_profile_purge_jobs SET
    completed_media_keys = CASE WHEN completed_media_keys ? k THEN completed_media_keys ELSE completed_media_keys || to_jsonb(k) END,
    updated_at = now()
  WHERE id = i AND status = 'PROCESSING' AND lock_token = t AND lease_until >= now()
    AND media_keys ? k RETURNING true INTO updated;
  RETURN COALESCE(updated, false);
END $$;

CREATE OR REPLACE FUNCTION public.retry_corporate_purge_job(i uuid, t uuid, e text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE updated boolean;
BEGIN
  UPDATE public.corporate_profile_purge_jobs SET
    status = CASE WHEN attempts >= max_attempts THEN 'FAILED' ELSE 'RETRY' END,
    next_attempt_at = now() + make_interval(secs => LEAST(3600, (2 ^ LEAST(attempts, 10))::integer * 15)),
    last_error = left(e, 1000), lease_until = NULL, worker_id = NULL, lock_token = NULL, updated_at = now()
  WHERE id = i AND status = 'PROCESSING' AND lock_token = t RETURNING true INTO updated;
  RETURN COALESCE(updated, false);
END $$;

CREATE OR REPLACE FUNCTION public.finalize_corporate_profile_purge(i uuid, t uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.corporate_profile_purge_jobs%rowtype; c public.corporate_profiles%rowtype; snap jsonb;
BEGIN
  SELECT * INTO j FROM public.corporate_profile_purge_jobs WHERE id = i FOR UPDATE;
  IF NOT FOUND OR j.status <> 'PROCESSING' OR j.lock_token IS DISTINCT FROM t OR j.lease_until < now() THEN
    RETURN jsonb_build_object('success', false, 'result', 'INVALID_LEASE');
  END IF;
  SELECT * INTO c FROM public.corporate_profiles WHERE id = j.corporate_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE public.corporate_profile_purge_jobs SET status = 'DONE', completed_at = now(), lease_until = NULL, worker_id = NULL, lock_token = NULL WHERE id = i;
    RETURN jsonb_build_object('success', true, 'result', 'ALREADY_PURGED');
  END IF;
  IF c.moderation_status <> 'DELETED' OR c.deleted_at IS NULL THEN RETURN jsonb_build_object('success', false, 'result', 'CANCELLED_STALE'); END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(j.media_keys) key WHERE NOT (j.completed_media_keys ? key)) THEN
    RETURN jsonb_build_object('success', false, 'result', 'MEDIA_INCOMPLETE');
  END IF;
  IF EXISTS (SELECT 1 FROM public.listings WHERE corporate_profile_id = c.id) THEN
    RETURN jsonb_build_object('success', false, 'result', 'LISTINGS_PENDING');
  END IF;
  snap := COALESCE(j.corporate_snapshot, public.corporate_profile_snapshot(c));
  UPDATE public.payments SET historical_corporate_profile_id = COALESCE(historical_corporate_profile_id, c.id),
    corporate_profile_snapshot = COALESCE(corporate_profile_snapshot, snap), corporate_profile_id = NULL WHERE corporate_profile_id = c.id;
  UPDATE public.listing_credits SET historical_corporate_profile_id = COALESCE(historical_corporate_profile_id, c.id),
    corporate_profile_snapshot = COALESCE(corporate_profile_snapshot, snap), corporate_profile_id = NULL WHERE corporate_profile_id = c.id;
  UPDATE public.offer_threads SET historical_seller_corporate_profile_id = COALESCE(historical_seller_corporate_profile_id, c.id),
    seller_corporate_snapshot = COALESCE(seller_corporate_snapshot, snap), seller_corporate_profile_id = NULL WHERE seller_corporate_profile_id = c.id;
  DELETE FROM public.corporate_followers WHERE corporate_profile_id = c.id;
  UPDATE public.character_profiles SET is_dealer = false, dealer_id = NULL, updated_at = now()
    WHERE id = c.owner_profile_id AND dealer_id = c.id::text;
  DELETE FROM public.corporate_profiles WHERE id = c.id;
  UPDATE public.corporate_profile_purge_jobs SET status = 'DONE', completed_at = now(), last_error = NULL,
    lease_until = NULL, worker_id = NULL, lock_token = NULL, updated_at = now() WHERE id = i;
  RETURN jsonb_build_object('success', true, 'result', 'DONE');
END $$;

-- Deleted stores must never be publicly visible through RLS.
DROP POLICY IF EXISTS "Public can view approved corporate profiles" ON public.corporate_profiles;
CREATE POLICY "Public can view approved corporate profiles" ON public.corporate_profiles FOR SELECT USING (
  (status = 'APPROVED' AND moderation_status = 'ACTIVE' AND deleted_at IS NULL)
  OR owner_profile_id IN (SELECT public.get_auth_profile_ids()) OR public.is_admin()
);

-- Entitlement operations must reject terminal stores even before physical purge.
DO $$ DECLARE definition text; rewritten text; BEGIN
  SELECT pg_get_functiondef('public.complete_sanboard_payment(text,text)'::regprocedure) INTO definition;
  rewritten := replace(definition, 'AND status = ''APPROVED'' AND moderation_status <> ''DELETED''', 'AND status = ''APPROVED'' AND moderation_status = ''ACTIVE'' AND deleted_at IS NULL');
  IF rewritten = definition THEN RAISE EXCEPTION 'complete_sanboard_payment corporate guard was not recognized'; END IF;
  EXECUTE rewritten;
END $$;

REVOKE ALL ON FUNCTION public.corporate_profile_snapshot(public.corporate_profiles),
  public.is_corporate_purge_media_key_referenced(text,uuid),
  public.enqueue_corporate_profile_purge_job(uuid), public.request_corporate_profile_purge(uuid,text,uuid),
  public.review_corporate_application(uuid,text,text,uuid),
  public.discover_corporate_purge_jobs(integer), public.claim_corporate_purge_jobs(text,integer,integer),
  public.complete_corporate_purge_media_key(uuid,uuid,text), public.retry_corporate_purge_job(uuid,uuid,text),
  public.finalize_corporate_profile_purge(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_corporate_profile_purge(uuid,text,uuid),
  public.is_corporate_purge_media_key_referenced(text,uuid),
  public.review_corporate_application(uuid,text,text,uuid),
  public.discover_corporate_purge_jobs(integer), public.claim_corporate_purge_jobs(text,integer,integer),
  public.complete_corporate_purge_media_key(uuid,uuid,text), public.retry_corporate_purge_job(uuid,uuid,text),
  public.finalize_corporate_profile_purge(uuid,uuid) TO service_role;

DO $$
DECLARE existing_job record;
BEGIN
  FOR existing_job IN SELECT jobid FROM cron.job WHERE jobname = 'sanboard-corporate-purge' LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END $$;
SELECT cron.schedule(
  'sanboard-corporate-purge', '*/5 * * * *',
  $command$
    SELECT net.http_get(
      url := rtrim((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SANBOARD_PRODUCTION_URL'), '/') || '/api/internal/corporate-purge',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SANBOARD_CRON_SECRET'),
        'Accept', 'application/json'
      ),
      timeout_milliseconds := 30000
    );
  $command$
);

COMMIT;