-- Read-only scheduler diagnostics. No Vault values are selected.

SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname IN (
  'sanboard-listing-purge',
  'sanboard-media-cleanup',
  'sanboard-expiry-lifecycle'
)
ORDER BY jobname;

SELECT
  j.jobname,
  r.jobid,
  r.runid,
  r.status,
  r.start_time,
  r.end_time,
  r.return_message
FROM cron.job_run_details AS r
JOIN cron.job AS j ON j.jobid = r.jobid
WHERE j.jobname IN (
  'sanboard-listing-purge',
  'sanboard-media-cleanup',
  'sanboard-expiry-lifecycle'
)
ORDER BY r.start_time DESC
LIMIT 20;

-- pg_net retains responses for a limited time (six hours by default).
-- Use a request id returned in cron.job_run_details.return_message when available:
-- SELECT id, status_code, timed_out, error_msg, created
-- FROM net._http_response
-- WHERE id = <request_id>;
--
-- Pending requests can be inspected without exposing headers or URLs:
-- SELECT id, method, timeout_milliseconds
-- FROM net.http_request_queue
-- ORDER BY id DESC
-- LIMIT 20;