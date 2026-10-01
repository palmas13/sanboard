import { getStorageProvider } from './index';
import { extractObjectKey } from '@/lib/media/url';
import { getSupabaseAdminClient } from '@/lib/db/supabase-client';

const ALLOWED_DELETE_PREFIXES = ['avatars/', 'listings/', 'dealers/logos/', 'dealers/banners/'];

export type MediaCleanupReason =
  | 'AVATAR_REPLACED'
  | 'AVATAR_UPLOAD_ROLLBACK'
  | 'LISTING_SOLD'
  | 'LISTING_REMOVED'
  | 'LISTING_DELETED'
  | 'LISTING_IMAGE_REMOVED'
  | 'LISTING_IMAGE_REPLACED'
  | 'LISTING_UPLOAD_ROLLBACK'
  | 'CORPORATE_LOGO_REPLACED'
  | 'CORPORATE_BANNER_REPLACED'
  | 'ORPHAN_GC';

export type MediaType =
  | 'AVATAR'
  | 'LISTING_IMAGE'
  | 'VEHICLE_IMAGE'
  | 'PROPERTY_IMAGE'
  | 'CORPORATE_LOGO'
  | 'CORPORATE_BANNER';

/**
 * Validates that an object key belongs to an allowed Sanboard storage prefix
 * and contains no path traversal attacks.
 */
export function isValidSanboardStorageKey(key: string): boolean {
  if (!key || typeof key !== 'string' || key.includes('..') || key.includes('\\')) return false;
  const normalized = key.replace(/^\/+/, '');
  return ALLOWED_DELETE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export async function isMediaKeyReferenced(objectKey: string): Promise<boolean> {
  const cleanKey = extractObjectKey(objectKey) || objectKey.replace(/^\/+/, '');
  if (!isValidSanboardStorageKey(cleanKey)) return true;
  if (process.env.DATA_STORE !== 'supabase') return false;
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase admin credentials are required for media reference checks.');
  const { data, error } = await client.rpc('is_media_key_referenced', { k: cleanKey });
  if (error) throw new Error(`Media reference check failed: ${error.message}`);
  return Boolean(data);
}

/**
 * Persists a failed or asynchronous cleanup job to Supabase media_cleanup_jobs.
 */
export async function queueMediaCleanup(
  objectKey: string,
  mediaType: string,
  reason: MediaCleanupReason,
  errorMsg?: string
): Promise<boolean> {
  const cleanKey = extractObjectKey(objectKey) || objectKey.replace(/^\/+/, '');
  if (!isValidSanboardStorageKey(cleanKey)) {
    return false;
  }

  if (process.env.DATA_STORE !== 'supabase') return true;
  const client = getSupabaseAdminClient();
  if (!client) return false;
  const { data, error } = await client.rpc('enqueue_media_cleanup_job', {
    k: cleanKey,
    t: mediaType,
    r: errorMsg ? `${reason}: ${errorMsg}`.slice(0, 1000) : reason,
    i: `media:${cleanKey}`,
  });
  if (error) throw new Error(`Media cleanup could not be queued: ${error.message}`);
  return Boolean(data);
}

/**
 * Safely deletes a file from Cloudflare R2:
 * 1. Checks key security & prefix authorization.
 * 2. Attempts immediate delete from R2.
 * 3. If delete fails, queues a cleanup job so the user action is not blocked.
 */
export async function deleteMediaSafely(
  pathOrUrl: string,
  mediaType: MediaType,
  reason: MediaCleanupReason
): Promise<boolean> {
  if (!pathOrUrl) return true;

  if (pathOrUrl.includes('images.unsplash.com') || pathOrUrl.startsWith('data:')) {
    return true;
  }

  const cleanKey = extractObjectKey(pathOrUrl);
  if (!cleanKey || !isValidSanboardStorageKey(cleanKey)) {
    return false;
  }

  try {
    if (await isMediaKeyReferenced(cleanKey)) return true;
    const provider = getStorageProvider();
    const result = await provider.delete(cleanKey);

    if (!result.success) {
      if (!(await queueMediaCleanup(cleanKey, mediaType, reason, result.error))) {
        throw new Error(result.error || 'Media cleanup could not be persisted.');
      }
      return false;
    }

    return true;
  } catch (err: any) {
    if (!(await queueMediaCleanup(cleanKey, mediaType, reason, err?.message))) throw err;
    return false;
  }
}

/**
 * Processes pending media cleanup retry jobs.
 */
export async function processMediaCleanupJobs(limit = 20): Promise<{ processed: number; succeeded: number }> {
  const { runMediaCleanupWorker } = await import('@/lib/lifecycle/media-cleanup-worker');
  const result = await runMediaCleanupWorker({ batchSize: limit });
  return { processed: result.claimed, succeeded: result.completed };
}
