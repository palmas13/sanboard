import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { getStorageProvider } from '@/lib/storage';
import { isValidSanboardStorageKey } from '@/lib/storage/lifecycle';
import type { StorageProvider } from '@/lib/storage/types';
import { errorMessage, rows, rpc, type RpcClient } from './worker-utils';

export interface MediaCleanupCounts { claimed: number; completed: number; retried: number; failed: number; rejected: number; referenced: number }
export interface MediaCleanupDependencies { client: RpcClient; storage: StorageProvider }
const bounded = (value?: number) => Math.max(1, Math.min(100, Math.floor(value || 50)));

export async function runMediaCleanupWorker(options: { batchSize?: number; dependencies?: MediaCleanupDependencies } = {}): Promise<MediaCleanupCounts> {
  const client = options.dependencies?.client || getSupabaseAdminClient();
  if (!client) throw new Error('SUPABASE_SECRET_KEY is required for media cleanup.');
  const storage = options.dependencies?.storage || getStorageProvider();
  const workerId = `media-cleanup:${process.pid}:${Date.now()}`;
  const jobs = rows(await rpc(client, 'claim_media_cleanup_jobs', { w: workerId, n: bounded(options.batchSize), s: 300 }));
  const counts: MediaCleanupCounts = { claimed: jobs.length, completed: 0, retried: 0, failed: 0, rejected: 0, referenced: 0 };

  for (const job of jobs) {
    const id = job.id || job.job_id;
    const key = job.storage_path || job.object_key || job.key;
    try {
      if (!id) throw new Error('Claimed media cleanup job has no id.');
      if (!job.lock_token) throw new Error('Claimed media cleanup job has no lock token.');
      if (typeof key !== 'string' || !isValidSanboardStorageKey(key)) {
        counts.rejected++;
        throw new Error('Unsafe or missing storage key.');
      }
      const referenced = await rpc(client, 'is_media_key_referenced', { k: key });
      if (referenced) {
        counts.referenced++;
        throw new Error('Media key is still referenced.');
      }
      const result = await storage.delete(key);
      if (!result.success) throw new Error(result.error || 'Storage deletion failed.');
      const completed = await rpc(client, 'complete_media_cleanup_job', { i: id, t: job.lock_token });
      if (!completed) {
        throw new Error('Media key is still referenced or the lease expired.');
      }
      counts.completed++;
    } catch (error) {
      if (id && job.lock_token) {
        await rpc(client, 'retry_media_cleanup_job', { i: id, t: job.lock_token, e: errorMessage(error) });
        if (Number(job.attempt_count || 0) >= Number(job.max_attempts || 12)) counts.failed++;
        else counts.retried++;
      }
    }
  }
  console.info('media_cleanup_worker', counts);
  return counts;
}
