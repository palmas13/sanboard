-- Read-only verification for the Sanboard Supabase Cron lifecycle scheduler.
-- This script intentionally reads Vault secret names only, never decrypted values.

WITH expected(jobname, schedule) AS (
  VALUES
    ('sanboard-listing-purge', '*/5 * * * *'),
    ('sanboard-media-cleanup', '*/5 * * * *'),
    ('sanboard-expiry-lifecycle', '*/10 * * * *')
),
checks AS (
  SELECT 'pg_cron extension exists' AS check_name,
         EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS passed
  UNION ALL
  SELECT 'pg_net extension exists',
         EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
  UNION ALL
  SELECT 'expected three cron jobs exist exactly once',
         (SELECT count(*) FROM cron.job WHERE jobname IN (SELECT jobname FROM expected)) = 3
         AND NOT EXISTS (
           SELECT 1 FROM expected e
           WHERE (SELECT count(*) FROM cron.job j WHERE j.jobname = e.jobname) <> 1
         )
  UNION ALL
  SELECT 'listing purge schedule = */5 * * * *',
         EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sanboard-listing-purge' AND schedule = '*/5 * * * *')
  UNION ALL
  SELECT 'media cleanup schedule = */5 * * * *',
         EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sanboard-media-cleanup' AND schedule = '*/5 * * * *')
  UNION ALL
  SELECT 'expiry lifecycle schedule = */10 * * * *',
         EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sanboard-expiry-lifecycle' AND schedule = '*/10 * * * *')
  UNION ALL
  SELECT 'all expected jobs are active',
         (SELECT count(*) FROM cron.job WHERE jobname IN (SELECT jobname FROM expected) AND active) = 3
  UNION ALL
  SELECT 'job commands resolve named Vault secrets',
         (SELECT count(*) FROM cron.job
          WHERE jobname IN (SELECT jobname FROM expected)
            AND command LIKE '%vault.decrypted_secrets%'
            AND command LIKE '%SANBOARD_PRODUCTION_URL%'
            AND command LIKE '%SANBOARD_CRON_SECRET%') = 3
  UNION ALL
  SELECT 'job commands contain no literal HTTPS production origin',
         NOT EXISTS (
           SELECT 1 FROM cron.job
           WHERE jobname IN (SELECT jobname FROM expected)
             AND command ~ 'https://[^'']+'
         )
  UNION ALL
  SELECT 'expected Vault secret names exist exactly once',
         (SELECT count(*) FROM vault.secrets WHERE name = 'SANBOARD_PRODUCTION_URL') = 1
         AND (SELECT count(*) FROM vault.secrets WHERE name = 'SANBOARD_CRON_SECRET') = 1
  UNION ALL
  SELECT 'no duplicate Sanboard lifecycle cron jobs',
         NOT EXISTS (
           SELECT jobname FROM cron.job
           WHERE jobname LIKE 'sanboard-%'
             AND jobname IN (SELECT jobname FROM expected)
           GROUP BY jobname HAVING count(*) > 1
         )
),
overall AS (
  SELECT bool_and(passed) AS passed FROM checks
)
SELECT CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result, check_name
FROM checks
UNION ALL
SELECT CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END, 'OVERALL'
FROM overall
ORDER BY check_name;

-- Recent scheduler status summary. Absence of runs is informational for a new install.
SELECT
  j.jobname,
  r.status,
  count(*) AS run_count,
  max(r.start_time) AS latest_start_time,
  max(r.end_time) AS latest_end_time
FROM cron.job AS j
LEFT JOIN cron.job_run_details AS r ON r.jobid = j.jobid
WHERE j.jobname IN (
  'sanboard-listing-purge',
  'sanboard-media-cleanup',
  'sanboard-expiry-lifecycle'
)
GROUP BY j.jobname, r.status
ORDER BY j.jobname, r.status;