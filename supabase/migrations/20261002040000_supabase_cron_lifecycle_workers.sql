BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $preconditions$
DECLARE
  production_url_count integer;
  cron_secret_count integer;
  production_url text;
  cron_secret text;
BEGIN
  SELECT count(*), min(decrypted_secret)
  INTO production_url_count, production_url
  FROM vault.decrypted_secrets
  WHERE name = 'SANBOARD_PRODUCTION_URL';

  SELECT count(*), min(decrypted_secret)
  INTO cron_secret_count, cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'SANBOARD_CRON_SECRET';

  IF production_url_count <> 1 THEN
    RAISE EXCEPTION 'Vault must contain exactly one SANBOARD_PRODUCTION_URL secret before installing Sanboard cron jobs';
  END IF;

  IF cron_secret_count <> 1 THEN
    RAISE EXCEPTION 'Vault must contain exactly one SANBOARD_CRON_SECRET secret before installing Sanboard cron jobs';
  END IF;

  IF production_url IS NULL
     OR production_url !~ '^https://[^/]+/?$'
     OR production_url ~ '[?#]'
  THEN
    RAISE EXCEPTION 'SANBOARD_PRODUCTION_URL must be a canonical HTTPS origin with no path, query, or fragment';
  END IF;

  IF cron_secret IS NULL OR btrim(cron_secret) = '' OR cron_secret ~* '^Bearer[[:space:]]' THEN
    RAISE EXCEPTION 'SANBOARD_CRON_SECRET must be the non-empty raw Vercel CRON_SECRET without a Bearer prefix';
  END IF;
END
$preconditions$;

DO $remove_existing_jobs$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'sanboard-listing-purge',
      'sanboard-media-cleanup',
      'sanboard-expiry-lifecycle'
    )
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END
$remove_existing_jobs$;

SELECT cron.schedule(
  'sanboard-listing-purge',
  '*/5 * * * *',
  $command$
    SELECT net.http_get(
      url := rtrim((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SANBOARD_PRODUCTION_URL'), '/') || '/api/internal/listing-purge',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SANBOARD_CRON_SECRET'),
        'Accept', 'application/json'
      ),
      timeout_milliseconds := 30000
    );
  $command$
);

SELECT cron.schedule(
  'sanboard-media-cleanup',
  '*/5 * * * *',
  $command$
    SELECT net.http_get(
      url := rtrim((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SANBOARD_PRODUCTION_URL'), '/') || '/api/internal/media-cleanup',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SANBOARD_CRON_SECRET'),
        'Accept', 'application/json'
      ),
      timeout_milliseconds := 30000
    );
  $command$
);

SELECT cron.schedule(
  'sanboard-expiry-lifecycle',
  '*/10 * * * *',
  $command$
    SELECT net.http_get(
      url := rtrim((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SANBOARD_PRODUCTION_URL'), '/') || '/api/internal/expiry-lifecycle',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SANBOARD_CRON_SECRET'),
        'Accept', 'application/json'
      ),
      timeout_milliseconds := 30000
    );
  $command$
);

COMMIT;