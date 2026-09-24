import { getStorageProvider } from './index';
import { extractObjectKey } from '@/lib/media/url';
import { getSupabaseAdminClient } from '@/lib/db/supabase-client';

const ALLOWED_DELETE_PREFIXES = [
  'avatars/',
  'listings/',
  'dealers/logos/',
  'dealers/banners/',
];

export type MediaCleanupReason =
  | 'AVATAR_REPLACED'
  | 'AVATAR_UPLOAD_ROLLBACK'
  | 'LISTING_SOLD'
  | 'LISTING_DELETED'
  | 'LISTING_IMAGE_REMOVED'
  | 'LISTING_IMAGE_REPLACED'
  | 'LISTING_UPLOAD_ROLLBACK'
  | 'CORPORATE_LOGO_REPLACED'
  | 'CORPORATE_BANNER_REPLACED'
  | 'ORPHAN_GC';

/**
 * Validates that an object key belongs to an allowed Sanboard storage prefix
 * and contains no path traversal attacks.
 */
export function isValidSanboardStorageKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  if (key.includes('..') || key.includes('\\')) return false;

  const normalized = key.replace(/^\/+/, '');
  return ALLOWED_DELETE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
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

  if (process.env.DATA_STORE === 'supabase') {
    try {
      const client = getSupabaseAdminClient();
      if (client) {
        await client.from('media_cleanup_jobs').insert({
          object_key: cleanKey,
          media_type: mediaType,
          reason,
          status: 'PENDING',
          attempt_count: 1,
          last_error: errorMsg || null,
          next_attempt_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min retry
        });
        return true;
      }
    } catch {
      // Non-blocking fallback
    }
  }

  return true;
}

export type MediaType =
  | 'AVATAR'
  | 'LISTING_IMAGE'
  | 'VEHICLE_IMAGE'
  | 'PROPERTY_IMAGE'
  | 'CORPORATE_LOGO'
  | 'CORPORATE_BANNER';

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

  // If external URL (e.g. Unsplash), do nothing
  if (pathOrUrl.includes('images.unsplash.com') || pathOrUrl.startsWith('data:')) {
    return true;
  }

  const cleanKey = extractObjectKey(pathOrUrl);
  if (!cleanKey || !isValidSanboardStorageKey(cleanKey)) {
    return false;
  }

  try {
    const provider = getStorageProvider();
    const result = await provider.delete(cleanKey);

    if (!result.success) {
      // Queue for background retry
      await queueMediaCleanup(cleanKey, mediaType, reason, result.error);
      return false;
    }

    return true;
  } catch (err: any) {
    await queueMediaCleanup(cleanKey, mediaType, reason, err?.message);
    return false;
  }
}

/**
 * Processes pending media cleanup retry jobs.
 */
export async function processMediaCleanupJobs(limit = 20): Promise<{ processed: number; succeeded: number }> {
  if (process.env.DATA_STORE !== 'supabase') {
    return { processed: 0, succeeded: 0 };
  }

  const client = getSupabaseAdminClient();
  if (!client) return { processed: 0, succeeded: 0 };

  const { data: jobs } = await client
    .from('media_cleanup_jobs')
    .select('*')
    .eq('status', 'PENDING')
    .lte('next_attempt_at', new Date().toISOString())
    .limit(limit);

  if (!jobs || jobs.length === 0) {
    return { processed: 0, succeeded: 0 };
  }

  const provider = getStorageProvider();
  let succeeded = 0;

  for (const job of jobs) {
    try {
      const res = await provider.delete(job.object_key);
      if (res.success) {
        await client
          .from('media_cleanup_jobs')
          .update({ status: 'DONE', updated_at: new Date().toISOString() })
          .eq('id', job.id);
        succeeded++;
      } else {
        const nextAttempt = new Date(Date.now() + Math.min(24 * 60, Math.pow(2, job.attempt_count) * 5) * 60 * 1000);
        await client
          .from('media_cleanup_jobs')
          .update({
            attempt_count: job.attempt_count + 1,
            last_error: res.error,
            next_attempt_at: nextAttempt.toISOString(),
            status: job.attempt_count >= 5 ? 'FAILED' : 'PENDING',
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    } catch (err: any) {
      await client
        .from('media_cleanup_jobs')
        .update({
          attempt_count: job.attempt_count + 1,
          last_error: err?.message,
          status: job.attempt_count >= 5 ? 'FAILED' : 'PENDING',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }
  }

  return { processed: jobs.length, succeeded };
}
