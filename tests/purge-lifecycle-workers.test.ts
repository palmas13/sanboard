import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runListingPurgeWorker } from '@/lib/lifecycle/listing-purge-worker';
import { runMediaCleanupWorker } from '@/lib/lifecycle/media-cleanup-worker';
import { runCorporatePurgeWorker } from '@/lib/lifecycle/corporate-purge-worker';
import { MockStorageProvider } from '@/lib/storage/mock-provider';

function clientFor(handlers: Record<string, (args: Record<string, unknown>) => unknown>) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    client: {
      async rpc(name: string, args: Record<string, unknown> = {}) {
        calls.push({ name, args });
        try { return { data: handlers[name]?.(args) ?? null, error: null }; }
        catch (error) { return { data: null, error: { message: error instanceof Error ? error.message : String(error) } }; }
      },
    },
  };
}

describe('durable purge workers', () => {
  test('listing purge deletes media, records the media phase, then purges DB', async () => {
    const storage = new MockStorageProvider();
    await storage.upload(Buffer.from('x'), { fileName: 'x.webp', category: 'listing', contentType: 'image/webp', key: 'listings/a/x.webp' });
    const mock = clientFor({
      discover_listing_purge_jobs: () => 1,
      claim_listing_purge_jobs: () => [{ id: 'job', listing_id: 'listing', lock_token: 'lock', media_keys: ['listings/a/x.webp'], attempts: 1, max_attempts: 3 }],
      is_media_key_referenced: () => false,
      complete_listing_purge_media_key: () => true,
      finalize_listing_purge: () => ({ success: true, result: 'DONE' }),
    });
    const counts = await runListingPurgeWorker({ dependencies: { client: mock.client, storage } });
    assert.equal(counts.mediaDeleted, 1);
    assert.equal(counts.dbPurged, 1);
    assert.deepEqual(mock.calls.map((call) => call.name), [
      'discover_listing_purge_jobs', 'claim_listing_purge_jobs', 'is_media_key_referenced',
      'complete_listing_purge_media_key', 'finalize_listing_purge',
    ]);
  });

  test('listing purge canonicalizes and deduplicates mixed key representations', async () => {
    const key = 'listings/abc/file.webp';
    const storage = new MockStorageProvider();
    await storage.upload(Buffer.from('x'), { fileName: 'file.webp', category: 'listing', contentType: 'image/webp', key });
    let deletes = 0;
    const originalDeleteMany = storage.deleteMany.bind(storage);
    storage.deleteMany = async (keys) => { deletes++; assert.deepEqual(keys, [key]); return originalDeleteMany(keys); };
    const mock = clientFor({
      discover_listing_purge_jobs: () => 0,
      claim_listing_purge_jobs: () => [{
        id: 'job', listing_id: 'listing', lock_token: 'lock', attempts: 1, max_attempts: 3,
        media_keys: [key, `https://cdn.sanboard.xyz/${key}`, `https://cdn.sanboard.xyz/${key}?v=123`],
      }],
      is_media_key_referenced: () => false,
      complete_listing_purge_media_key: ({ k }) => k === key,
      finalize_listing_purge: () => ({ success: true, result: 'DONE' }),
    });
    const counts = await runListingPurgeWorker({ dependencies: { client: mock.client, storage } });
    assert.equal(deletes, 1);
    assert.equal(counts.mediaDeleted, 1);
    assert.equal(counts.dbPurged, 1);
  });

  test('listing purge rejects an external URL instead of treating it as an R2 key', async () => {
    const storage = new MockStorageProvider();
    let deletes = 0;
    storage.deleteMany = async () => { deletes++; return { success: true, results: [] }; };
    const mock = clientFor({
      discover_listing_purge_jobs: () => 0,
      claim_listing_purge_jobs: () => [{ id: 'job', listing_id: 'listing', lock_token: 'lock', media_keys: ['https://example.com/listings/abc/file.webp'], attempts: 1, max_attempts: 3 }],
      retry_listing_purge_job: () => true,
    });
    const counts = await runListingPurgeWorker({ dependencies: { client: mock.client, storage } });
    assert.equal(deletes, 0);
    assert.equal(counts.retried, 1);
    assert.equal(mock.calls.some((call) => call.name === 'finalize_listing_purge'), false);
  });

  test('shared reference prevents deletion and schedules retry', async () => {
    const storage = new MockStorageProvider();
    let deletes = 0;
    const original = storage.deleteMany.bind(storage);
    storage.deleteMany = async (keys) => { deletes++; return original(keys); };
    const mock = clientFor({
      discover_listing_purge_jobs: () => 0,
      claim_listing_purge_jobs: () => [{ id: 'job', listing_id: 'listing', lock_token: 'lock', media_keys: ['listings/a/x.webp'], attempts: 1, max_attempts: 3 }],
      is_media_key_referenced: () => true,
      retry_listing_purge_job: () => true,
    });
    const counts = await runListingPurgeWorker({ dependencies: { client: mock.client, storage } });
    assert.equal(deletes, 0);
    assert.equal(counts.referenced, 1);
    assert.equal(counts.retried, 1);
  });

  test('stale lifecycle is counted as cancelled, not retried', async () => {
    const mock = clientFor({
      discover_listing_purge_jobs: () => 0,
      claim_listing_purge_jobs: () => [{ id: 'job', listing_id: 'listing', lock_token: 'lock', media_keys: [] }],
      finalize_listing_purge: () => ({ success: false, result: 'CANCELLED_STALE' }),
    });
    const counts = await runListingPurgeWorker({ dependencies: { client: mock.client, storage: new MockStorageProvider() } });
    assert.equal(counts.cancelled, 1);
    assert.equal(counts.retried, 0);
  });

  test('media failure retries and max-attempt failure is observable', async () => {
    const storage = new MockStorageProvider({ failDeletesFor: ['avatars/a.webp'] });
    const mock = clientFor({
      claim_media_cleanup_jobs: () => [{ id: 'media', lock_token: 'lock', object_key: 'avatars/a.webp', attempt_count: 12, max_attempts: 12 }],
      is_media_key_referenced: () => false,
      retry_media_cleanup_job: () => true,
    });
    const counts = await runMediaCleanupWorker({ dependencies: { client: mock.client, storage } });
    assert.equal(counts.failed, 1);
    assert.equal(counts.completed, 0);
  });

  test('media worker never deletes a key that became referenced again', async () => {
    const storage = new MockStorageProvider();
    let deletes = 0;
    storage.delete = async () => { deletes++; return { success: true }; };
    const mock = clientFor({
      claim_media_cleanup_jobs: () => [{ id: 'media', lock_token: 'lock', object_key: 'avatars/current.webp', attempt_count: 1, max_attempts: 12 }],
      is_media_key_referenced: () => true,
      retry_media_cleanup_job: () => true,
    });
    const counts = await runMediaCleanupWorker({ dependencies: { client: mock.client, storage } });
    assert.equal(deletes, 0);
    assert.equal(counts.referenced, 1);
    assert.equal(counts.retried, 1);
  });

  test('corporate purge deletes exact logo/banner snapshots before physical DB purge', async () => {
    const storage = new MockStorageProvider();
    await storage.upload(Buffer.from('logo'), { fileName: 'logo.webp', category: 'corporate_logo', contentType: 'image/webp', key: 'dealers/logos/store/logo.webp' });
    await storage.upload(Buffer.from('banner'), { fileName: 'banner.webp', category: 'corporate_banner', contentType: 'image/webp', key: 'dealers/banners/store/banner.webp' });
    const mock = clientFor({
      discover_corporate_purge_jobs: () => 1,
      claim_corporate_purge_jobs: () => [{ id: 'corporate-job', corporate_profile_id: 'store', lock_token: 'lock', media_keys: ['dealers/logos/store/logo.webp', 'dealers/banners/store/banner.webp'], attempts: 1, max_attempts: 12 }],
      is_corporate_purge_media_key_referenced: () => false,
      complete_corporate_purge_media_key: () => true,
      finalize_corporate_profile_purge: () => ({ success: true, result: 'DONE' }),
    });
    const counts = await runCorporatePurgeWorker({ dependencies: { client: mock.client, storage } });
    assert.equal(counts.mediaDeleted, 2);
    assert.equal(counts.dbPurged, 1);
    assert.deepEqual(mock.calls.map((call) => call.name), [
      'discover_corporate_purge_jobs', 'claim_corporate_purge_jobs',
      'is_corporate_purge_media_key_referenced', 'is_corporate_purge_media_key_referenced',
      'complete_corporate_purge_media_key', 'complete_corporate_purge_media_key',
      'finalize_corporate_profile_purge',
    ]);
  });

  test('corporate purge treats already-absent objects idempotently and retries while listings remain', async () => {
    const mock = clientFor({
      discover_corporate_purge_jobs: () => 0,
      claim_corporate_purge_jobs: () => [{ id: 'corporate-job', corporate_profile_id: 'store', lock_token: 'lock', media_keys: ['dealers/logos/store/missing.webp'], attempts: 1, max_attempts: 12 }],
      is_corporate_purge_media_key_referenced: () => false,
      complete_corporate_purge_media_key: () => true,
      finalize_corporate_profile_purge: () => ({ success: false, result: 'LISTINGS_PENDING' }),
      retry_corporate_purge_job: () => true,
    });
    const counts = await runCorporatePurgeWorker({ dependencies: { client: mock.client, storage: new MockStorageProvider() } });
    assert.equal(counts.mediaDeleted, 1);
    assert.equal(counts.blockedByListings, 1);
    assert.equal(counts.retried, 1);
  });

  test('corporate purge never deletes media referenced by another store', async () => {
    const storage = new MockStorageProvider();
    let deletes = 0;
    storage.deleteMany = async () => { deletes++; return { success: true, results: [] }; };
    const mock = clientFor({
      discover_corporate_purge_jobs: () => 0,
      claim_corporate_purge_jobs: () => [{ id: 'corporate-job', corporate_profile_id: 'store', lock_token: 'lock', media_keys: ['dealers/logos/shared.webp'], attempts: 1, max_attempts: 12 }],
      is_corporate_purge_media_key_referenced: () => true,
      retry_corporate_purge_job: () => true,
    });
    const counts = await runCorporatePurgeWorker({ dependencies: { client: mock.client, storage } });
    assert.equal(deletes, 0);
    assert.equal(counts.retried, 1);
  });
});

describe('corporate hard purge migration contract', () => {
  const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261003030000_corporate_profile_hard_purge_lifecycle.sql'), 'utf8');

  test('replaces unconditional owner uniqueness with one-live-store partial uniqueness', () => {
    assert.match(migration, /DROP CONSTRAINT IF EXISTS uq_corporate_profiles_owner_profile_id/);
    assert.match(migration, /CREATE UNIQUE INDEX uq_corporate_profiles_active_owner[\s\S]*WHERE deleted_at IS NULL AND moderation_status <> 'DELETED'/);
    assert.match(migration, /WHERE owner_profile_id = v_profile\.id[\s\S]*deleted_at IS NULL[\s\S]*moderation_status <> 'DELETED'/);
  });

  test('terminalizes immediately, clears owner links and entitlements, and reuses listing purge jobs', () => {
    assert.match(migration, /request_corporate_profile_purge/);
    assert.match(migration, /moderation_status = 'DELETED'/);
    assert.match(migration, /subscription_status = 'INACTIVE'/);
    assert.match(migration, /monthly_boost_credits = 0, purchased_boost_credits = 0, boost_credits = 0/);
    assert.match(migration, /SET is_dealer = false, dealer_id = NULL/);
    assert.match(migration, /enqueue_listing_purge_job\(l\.id, 'CORPORATE_PROFILE_PURGE'\)/);
  });

  test('preserves protected history, purges followers, and deletes the store only after media and listings', () => {
    assert.match(migration, /historical_corporate_profile_id/);
    assert.match(migration, /historical_seller_corporate_profile_id/);
    assert.match(migration, /seller_corporate_snapshot/);
    assert.match(migration, /is_corporate_purge_media_key_referenced/);
    assert.match(migration, /LISTINGS_PENDING/);
    assert.match(migration, /MEDIA_INCOMPLETE/);
    assert.match(migration, /DELETE FROM public\.corporate_followers/);
    assert.match(migration, /DELETE FROM public\.corporate_profiles/);
    assert.doesNotMatch(migration, /DELETE FROM public\.(payments|listing_credits|offer_threads|audit_logs|notifications)/);
  });

  test('reconciles existing deleted rows without blind migration-time deletion and keeps purge RPCs service-role only', () => {
    assert.match(migration, /discover_corporate_purge_jobs/);
    assert.match(migration, /CORPORATE_PROFILE_RECONCILIATION/);
    assert.match(migration, /UPDATE public\.listings SET status = 'REMOVED'[\s\S]*WHERE corporate_profile_id = c\.id AND status = 'ACTIVE'/);
    assert.doesNotMatch(migration.split('CREATE OR REPLACE FUNCTION public.finalize_corporate_profile_purge')[0], /DELETE FROM public\.corporate_profiles/);
    assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.request_corporate_profile_purge[\s\S]*TO service_role/);
  });
});

describe('purge migration contract', () => {
  const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261002030000_durable_listing_purge_and_media_jobs.sql'), 'utf8');
  test('contains exact retention rules and atomic claims', () => {
    assert.match(migration, /closed_at<=now\(\)-interval '24 hours'/);
    assert.match(migration, /expires_at<=now\(\)-interval '7 days'/);
    assert.match(migration, /FOR UPDATE SKIP LOCKED/g);
    assert.match(migration, /'FAILED','CANCELLED'/);
    assert.match(migration, /idempotency_key text NOT NULL UNIQUE/);
  });
  test('preserves protected history and hard-purges operational listing data', () => {
    assert.match(migration, /original_listing_id/);
    assert.match(migration, /historical_listing_id/);
    assert.match(migration, /historical_target_listing_id/);
    assert.match(migration, /ON DELETE SET NULL/);
    assert.match(migration, /DELETE FROM listing_price_history/);
    assert.match(migration, /DELETE FROM listings WHERE id=l\.id/);
    assert.doesNotMatch(migration, /DELETE FROM payments/);
    assert.doesNotMatch(migration, /DELETE FROM offer_threads/);
    assert.doesNotMatch(migration, /DELETE FROM reports/);
    assert.match(migration, /UPDATE offer_threads SET original_listing_id=coalesce\(original_listing_id,l\.id\),listing_snapshot=coalesce\(listing_snapshot,snap\),listing_id=NULL WHERE listing_id=l\.id/);
  });

  test('listing image replacement reads the locked database category and enforces canonical limits', () => {
    assert.match(migration, /replace_listing_images_atomic\(p_listing_id uuid,p_images jsonb\)/);
    assert.match(migration, /SELECT \* INTO l FROM listings WHERE id=p_listing_id FOR UPDATE/);
    assert.match(migration, /image_count:=jsonb_array_length\(p_images\)/);
    assert.match(migration, /IF image_count<1 THEN RAISE EXCEPTION 'invalid images'/);
    assert.match(migration, /IF l\.category='vehicle'AND image_count>3 THEN RAISE EXCEPTION 'invalid images'/);
    assert.match(migration, /IF l\.category='property'AND image_count>5 THEN RAISE EXCEPTION 'invalid images'/);
    assert.doesNotMatch(migration, /jsonb_array_length\([^)]*\)NOT BETWEEN 1 AND 20/);
  });

  test('listing image replacement accepts only category-valid counts with exactly one cover', () => {
    const accepted = (category: 'vehicle' | 'property', imageCount: number, coverCount: number) =>
      imageCount >= 1 && imageCount <= (category === 'vehicle' ? 3 : 5) && coverCount === 1;

    assert.equal(accepted('vehicle', 1, 1), true);
    assert.equal(accepted('vehicle', 3, 1), true);
    assert.equal(accepted('vehicle', 4, 1), false);
    assert.equal(accepted('property', 1, 1), true);
    assert.equal(accepted('property', 5, 1), true);
    assert.equal(accepted('property', 6, 1), false);
    assert.equal(accepted('vehicle', 0, 0), false);
    assert.equal(accepted('property', 0, 0), false);
    assert.equal(accepted('vehicle', 2, 2), false);
    assert.equal(accepted('property', 2, 0), false);
    assert.match(migration, /SELECT count\(\*\)FROM jsonb_array_elements\(p_images\)x WHERE coalesce\(\(x->>'is_cover'\)::boolean,false\)\)<>1/);
  });
});

describe('lifecycle scheduler contract', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'));
  const workflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/lifecycle-workers.yml'), 'utf8');
  const cronMigration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261002040000_supabase_cron_lifecycle_workers.sql'), 'utf8');
  const postflight = fs.readFileSync(path.join(process.cwd(), 'supabase/scripts/supabase_cron_lifecycle_postflight.sql'), 'utf8');
  const diagnostics = fs.readFileSync(path.join(process.cwd(), 'supabase/scripts/supabase_cron_lifecycle_diagnostics.sql'), 'utf8');

  test('Vercel Hobby keeps only the daily orphan reconciliation cron', () => {
    assert.deepEqual(vercel.crons, [
      { path: '/api/internal/orphan-reconciliation', schedule: '17 3 * * *' },
    ]);
  });

  test('GitHub Actions is a manual-only fallback for all lifecycle workers', () => {
    assert.match(workflow, /corporate-purge:[\s\S]*\/api\/internal\/corporate-purge/);
    assert.match(workflow, /workflow_dispatch:/);
    assert.doesNotMatch(workflow, /^\s*schedule:/m);
    assert.doesNotMatch(workflow, /github\.event\.schedule/);
    assert.match(workflow, /listing-purge:[\s\S]*\/api\/internal\/listing-purge/);
    assert.match(workflow, /media-cleanup:[\s\S]*\/api\/internal\/media-cleanup/);
    assert.match(workflow, /expiry-lifecycle:[\s\S]*\/api\/internal\/expiry-lifecycle/);
    assert.equal((workflow.match(/--request GET/g) || []).length, 4);
    assert.equal((workflow.match(/curl --fail-with-body --silent --show-error/g) || []).length, 4);
    assert.equal((workflow.match(/Authorization: Bearer \$CRON_SECRET/g) || []).length, 4);
    assert.equal((workflow.match(/vars\.SANBOARD_PRODUCTION_URL/g) || []).length, 4);
    assert.equal((workflow.match(/secrets\.CRON_SECRET/g) || []).length, 4);
    assert.doesNotMatch(workflow, /https:\/\/[^$"\s]+\/api\/internal/);
  });

  test('Supabase Cron independently schedules all workers through pg_net and Vault', () => {
    assert.match(cronMigration, /CREATE EXTENSION IF NOT EXISTS pg_cron/);
    assert.match(cronMigration, /CREATE EXTENSION IF NOT EXISTS pg_net/);
    assert.match(cronMigration, /cron\.schedule\(\s*'sanboard-listing-purge',\s*'\*\/5 \* \* \* \*'/);
    assert.match(cronMigration, /cron\.schedule\(\s*'sanboard-media-cleanup',\s*'\*\/5 \* \* \* \*'/);
    assert.match(cronMigration, /cron\.schedule\(\s*'sanboard-expiry-lifecycle',\s*'\*\/10 \* \* \* \*'/);
    assert.equal((cronMigration.match(/net\.http_get/g) || []).length, 3);
    assert.equal((cronMigration.match(/vault\.decrypted_secrets/g) || []).length, 8);
    assert.equal((cronMigration.match(/timeout_milliseconds := 30000/g) || []).length, 3);
    assert.equal((cronMigration.match(/'Accept', 'application\/json'/g) || []).length, 3);
    assert.match(cronMigration, /'Authorization', 'Bearer ' \|\|/);
    assert.doesNotMatch(cronMigration, /'https:\/\/[^']+'/);
    assert.doesNotMatch(cronMigration, /Bearer [A-Za-z0-9_-]{16,}/);
  });

  test('scheduler verification scripts are read-only and never decrypt Vault values', () => {
    const executablePostflight = postflight.replace(/^\s*--.*$/gm, '');
    const executableDiagnostics = diagnostics.replace(/^\s*--.*$/gm, '');
    assert.match(postflight, /'OVERALL'/);
    assert.match(postflight, /cron\.job_run_details/);
    assert.match(diagnostics, /LIMIT 20/);
    assert.match(executablePostflight, /FROM vault\.secrets/);
    assert.doesNotMatch(executablePostflight, /SELECT\s+decrypted_secret/i);
    assert.doesNotMatch(executableDiagnostics, /SELECT\s+decrypted_secret/i);
    assert.doesNotMatch(executablePostflight, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|PERFORM)\b/i);
    assert.doesNotMatch(executableDiagnostics, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|PERFORM)\b/i);
  });
});

describe('orphan reconciliation queue migration contract', () => {
  const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261002050000_orphan_reconciliation_queue.sql'), 'utf8');

  test('deduplicates exact keys and rechecks references before queue mutation', () => {
    assert.match(migration, /canonical_sanboard_media_key\(k\)/);
    assert.match(migration, /is_media_key_referenced\(clean_key\)/);
    assert.match(migration, /idempotency_key = 'orphan:' \|\| clean_key/);
    assert.match(migration, /status IN \('PENDING', 'PROCESSING', 'RETRY', 'FAILED'\)/);
    assert.match(migration, /RETURN 'ALREADY_QUEUED'/);
    assert.match(migration, /reason = 'ORPHAN_RECONCILIATION'/);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.enqueue_orphan_media_cleanup_job\(text, text\) TO service_role/);
  });
});

describe('listing purge media-key reconciliation migration contract', () => {
  const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261004020000_listing_purge_media_key_reconciliation.sql'), 'utf8');

  test('canonicalizes enqueue snapshots, query-string URLs, and cleanup identities', () => {
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.canonical_sanboard_media_key/);
    assert.match(migration, /split_part\(split_part\(value, '\?', 1\), '#', 1\)/);
    assert.match(migration, /SELECT DISTINCT public\.canonical_sanboard_media_key\(storage_path\) AS key/);
    assert.match(migration, /jsonb_agg\(key ORDER BY key\)/);
    assert.match(migration, /RAISE EXCEPTION 'listing contains noncanonical media reference'/);
    assert.match(migration, /'purge:' \|\| job_id \|\| ':' \|\| key/);
    assert.match(migration, /object_key = canonical_key/);
    assert.match(migration, /idempotency_key = 'purge:' \|\| purge_job\.id \|\| ':' \|\| canonical_key/);
  });

  test('repairs retry jobs and only lifecycle-safe MEDIA_INCOMPLETE failures', () => {
    assert.match(migration, /j\.status IN \('PENDING', 'RETRY', 'FAILED'\)/);
    assert.match(migration, /last_error IS DISTINCT FROM 'Purge finalization did not converge: MEDIA_INCOMPLETE'/);
    assert.match(migration, /listing_row\.status IS DISTINCT FROM purge_job\.expected_status/);
    assert.match(migration, /retention_anchor/);
    assert.match(migration, /now\(\) < purge_job\.purge_after/);
    assert.match(migration, /status = 'RETRY'/);
    assert.match(migration, /attempts = least\(attempts, max_attempts - 1\)/);
    assert.match(migration, /next_attempt_at = now\(\)/);
  });

  test('does not normalize unrecognized external URLs or weaken purge finalization', () => {
    assert.match(migration, /canonical_sanboard_media_key\(value\) IS NULL/);
    assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION public\.finalize_listing_purge/);
    const original = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261002030000_durable_listing_purge_and_media_jobs.sql'), 'utf8');
    assert.match(original, /'MEDIA_INCOMPLETE'/);
  });

  test('preserves cleanup completion and attempts while collapsing duplicate representations', () => {
    assert.match(migration, /bool_or\(m\.status = 'DONE'\)/);
    assert.match(migration, /max\(m\.attempt_count\)/);
    assert.match(migration, /m\.id <> cleanup_survivor/);
    assert.match(migration, /CASE WHEN cleanup_done THEN 'DONE' ELSE 'PENDING' END/);
  });
});
