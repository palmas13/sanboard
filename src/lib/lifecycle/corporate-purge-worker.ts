import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { getStorageProvider } from '@/lib/storage';
import { isValidSanboardStorageKey } from '@/lib/storage/lifecycle';
import type { StorageProvider } from '@/lib/storage/types';
import { errorMessage, rows, rpc, type RpcClient } from './worker-utils';

export interface CorporatePurgeCounts { discovered: number; claimed: number; completed: number; retried: number; failed: number; mediaDeleted: number; dbPurged: number; blockedByListings: number }
export interface CorporatePurgeDependencies { client: RpcClient; storage: StorageProvider }

export async function runCorporatePurgeWorker(options: { batchSize?: number; dependencies?: CorporatePurgeDependencies } = {}): Promise<CorporatePurgeCounts> {
  const limit = Math.max(1, Math.min(100, Math.floor(options.batchSize || 25)));
  const client = options.dependencies?.client || getSupabaseAdminClient();
  if (!client) throw new Error('SUPABASE_SECRET_KEY is required for corporate purge.');
  const storage = options.dependencies?.storage || getStorageProvider();
  const counts: CorporatePurgeCounts = { discovered: 0, claimed: 0, completed: 0, retried: 0, failed: 0, mediaDeleted: 0, dbPurged: 0, blockedByListings: 0 };
  const workerId = `corporate-purge:${process.pid}:${Date.now()}`;
  counts.discovered = Number(await rpc(client, 'discover_corporate_purge_jobs', { n: limit }) || 0);
  const jobs = rows(await rpc(client, 'claim_corporate_purge_jobs', { w: workerId, n: limit, s: 300 }));
  counts.claimed = jobs.length;

  for (const job of jobs) {
    const id = job.id || job.job_id;
    try {
      if (!id || !job.lock_token) throw new Error('Claimed corporate purge job is missing its lease identity.');
      const keys = [...new Set((Array.isArray(job.media_keys) ? job.media_keys : []).filter((key): key is string => typeof key === 'string' && isValidSanboardStorageKey(key)))];
      for (const key of keys) {
        if (await rpc(client, 'is_corporate_purge_media_key_referenced', { k: key, x: job.corporate_profile_id })) {
          throw new Error(`Corporate purge media key is referenced outside the deleted store: ${key}`);
        }
      }
      const deleted = storage.deleteMany ? (await storage.deleteMany(keys)).results : await Promise.all(keys.map(async (key) => ({ key, ...(await storage.delete(key)) })));
      for (const result of deleted) {
        if (!result.success) throw new Error(result.error || `Storage deletion failed: ${result.key}`);
        if (!await rpc(client, 'complete_corporate_purge_media_key', { i: id, t: job.lock_token, k: result.key })) throw new Error(`Corporate media completion could not be recorded: ${result.key}`);
        counts.mediaDeleted++;
      }
      const result = await rpc(client, 'finalize_corporate_profile_purge', { i: id, t: job.lock_token }) as Record<string, unknown>;
      if (result?.success) { counts.completed++; counts.dbPurged++; }
      else if (result?.result === 'LISTINGS_PENDING') { counts.blockedByListings++; throw new Error('Corporate listings are still awaiting canonical purge.'); }
      else throw new Error(`Corporate purge did not converge: ${String(result?.result || 'unknown')}`);
    } catch (error) {
      if (id && job.lock_token) {
        await rpc(client, 'retry_corporate_purge_job', { i: id, t: job.lock_token, e: errorMessage(error) });
        if (Number(job.attempts || 0) >= Number(job.max_attempts || 12)) counts.failed++; else counts.retried++;
      }
    }
  }
  console.info('corporate_purge_worker', counts);
  return counts;
}