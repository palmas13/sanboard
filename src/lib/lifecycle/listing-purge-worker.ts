import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { getStorageProvider } from '@/lib/storage';
import { isValidSanboardStorageKey } from '@/lib/storage/lifecycle';
import { errorMessage, rows, rpc, type RpcClient } from './worker-utils';
import type { StorageProvider } from '@/lib/storage/types';

export interface ListingPurgeCounts { discovered: number; claimed: number; completed: number; retried: number; failed: number; cancelled: number; referenced: number; mediaDeleted: number; dbPurged: number }
export interface ListingPurgeDependencies { client: RpcClient; storage: StorageProvider }
const limitOf = (value?: number) => Math.max(1, Math.min(100, Math.floor(value || 25)));

export async function runListingPurgeWorker(options: { batchSize?: number; dependencies?: ListingPurgeDependencies } = {}): Promise<ListingPurgeCounts> {
  const limit = limitOf(options.batchSize);
  const client = options.dependencies?.client || getSupabaseAdminClient();
  if (!client) throw new Error('SUPABASE_SECRET_KEY is required for listing purge.');
  const storage = options.dependencies?.storage || getStorageProvider();
  const counts: ListingPurgeCounts = { discovered: 0, claimed: 0, completed: 0, retried: 0, failed: 0, cancelled: 0, referenced: 0, mediaDeleted: 0, dbPurged: 0 };
  const workerId = `listing-purge:${process.pid}:${Date.now()}`;

  counts.discovered = Number(await rpc(client, 'discover_listing_purge_jobs', { n: limit }) || 0);
  const jobs = rows(await rpc(client, 'claim_listing_purge_jobs', { w: workerId, n: limit, s: 300 }));
  counts.claimed = jobs.length;

  for (const job of jobs) {
    const jobId = job.id || job.job_id;
    try {
      if (!jobId) throw new Error('Claimed purge job has no id.');
      if (!job.lock_token) throw new Error('Claimed purge job has no lock token.');
      const keys = [job.storage_path, ...(Array.isArray(job.storage_paths) ? job.storage_paths : []), ...(Array.isArray(job.media_keys) ? job.media_keys : [])]
        .filter((key): key is string => typeof key === 'string' && isValidSanboardStorageKey(key));
      const uniqueKeys = [...new Set(keys)];
      for (const key of uniqueKeys) {
        const referenced = await rpc(client, 'is_media_key_referenced', { k: key, x: job.listing_id });
        if (referenced) {
          counts.referenced++;
          throw new Error(`Purge media key is referenced outside the listing: ${key}`);
        }
      }
      const deleteResults = storage.deleteMany
        ? (await storage.deleteMany(uniqueKeys)).results
        : await Promise.all(uniqueKeys.map(async (key) => ({ key, ...(await storage.delete(key)) })));
      for (const result of deleteResults) {
        if (!result.success) throw new Error(result.error || `Storage deletion failed: ${result.key}`);
        const recorded = await rpc(client, 'complete_listing_purge_media_key', { i: jobId, t: job.lock_token, k: result.key });
        if (!recorded) throw new Error(`Purge media completion could not be recorded: ${result.key}`);
        counts.mediaDeleted++;
      }
      const result = await rpc(client, 'finalize_listing_purge', { i: jobId, t: job.lock_token }) as Record<string, unknown>;
      if (result?.result === 'CANCELLED_STALE' || result?.result === 'CANCELLED_MISSING') {
        counts.cancelled++;
      } else if (result?.success) {
        counts.completed++;
        counts.dbPurged++;
      } else {
        throw new Error(`Purge finalization did not converge: ${String(result?.result || 'unknown')}`);
      }
    } catch (error) {
      if (jobId && job.lock_token) {
        await rpc(client, 'retry_listing_purge_job', { i: jobId, t: job.lock_token, e: errorMessage(error) });
        if (Number(job.attempts || 0) >= Number(job.max_attempts || 12)) counts.failed++;
        else counts.retried++;
      }
    }
  }
  console.info('listing_purge_worker', counts);
  return counts;
}
