import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { db } from '@/lib/db/store';
import { extractObjectKey } from '@/lib/media/url';
import { getStorageProvider } from '@/lib/storage';
import type { StorageProvider } from '@/lib/storage/types';

export type ListingMediaFinalizeStatus = 'FINALIZED' | 'ALREADY_FINALIZED' | 'SKIPPED' | 'FAILED';
export interface ListingMediaFinalizeItem {
  imageId: string;
  sourceKey?: string;
  destinationKey?: string;
  status: ListingMediaFinalizeStatus;
  error?: string;
}
export interface ListingMediaFinalizeReport {
  listingId: string;
  finalizedCount: number;
  alreadyFinalizedCount: number;
  skippedCount: number;
  failedCount: number;
  results: ListingMediaFinalizeItem[];
}

interface ImageRow { id: string; listing_id: string; storage_path: string }
interface FinalizeDependencies {
  storage?: StorageProvider;
  loadImages?: (listingId: string) => Promise<ImageRow[]>;
  commit?: (args: { imageId: string; listingId: string; oldKey: string; newKey: string; newStoragePath: string }) => Promise<string>;
}

function destinationFor(listingId: string, sourceKey: string): string | null {
  const filename = sourceKey.split('/').at(-1);
  if (!filename || filename === '.' || filename === '..') return null;
  return `listings/${listingId}/${filename}`;
}

function isAllowedTemporarySource(sourceKey: string, listingId: string, uploadOwnerId?: string): boolean {
  if (!sourceKey.startsWith('listings/') || sourceKey.endsWith('/')) return false;
  if (sourceKey.startsWith(`listings/${listingId}/`)) return true;
  const scope = sourceKey.split('/')[1];
  return Boolean(scope?.startsWith('pending-') || (uploadOwnerId && scope === uploadOwnerId));
}

async function defaultLoadImages(listingId: string): Promise<ImageRow[]> {
  if (process.env.DATA_STORE !== 'supabase') {
    const listing = db.listings.find((item) => item.id === listingId);
    return (listing?.images || []).map((image) => ({ id: image.id, listing_id: listingId, storage_path: image.storage_path }));
  }
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase admin credentials are required for listing media finalization.');
  const { data, error } = await client.from('listing_images').select('id,listing_id,storage_path').eq('listing_id', listingId).order('sort_order');
  if (error) throw new Error(`Listing images could not be loaded: ${error.message}`);
  return (data || []) as ImageRow[];
}

async function defaultCommit(args: { imageId: string; listingId: string; oldKey: string; newKey: string; newStoragePath: string }): Promise<string> {
  if (process.env.DATA_STORE !== 'supabase') {
    const listing = db.listings.find((item) => item.id === args.listingId);
    const image = listing?.images?.find((item) => item.id === args.imageId);
    if (!image) return 'NOT_FOUND';
    const currentKey = extractObjectKey(image.storage_path);
    if (currentKey === args.newKey) return 'ALREADY_FINALIZED';
    if (currentKey !== args.oldKey) return 'STALE';
    image.storage_path = args.newStoragePath;
    return 'FINALIZED';
  }
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase admin credentials are required for listing media finalization.');
  const { data, error } = await client.rpc('finalize_listing_media_image', {
    p_image_id: args.imageId,
    p_listing_id: args.listingId,
    p_expected_old_key: args.oldKey,
    p_new_key: args.newKey,
    p_new_storage_path: args.newStoragePath,
  });
  if (error) throw new Error(`Listing image finalization failed: ${error.message}`);
  return String(data);
}

export async function finalizeListingMedia(
  listingId: string,
  options: { uploadOwnerId?: string; dependencies?: FinalizeDependencies } = {}
): Promise<ListingMediaFinalizeReport> {
  const storage = options.dependencies?.storage || getStorageProvider();
  const images = await (options.dependencies?.loadImages || defaultLoadImages)(listingId);
  const commit = options.dependencies?.commit || defaultCommit;
  const results: ListingMediaFinalizeItem[] = [];

  for (const image of images) {
    const sourceKey = extractObjectKey(image.storage_path);
    if (!sourceKey || image.listing_id !== listingId || !isAllowedTemporarySource(sourceKey, listingId, options.uploadOwnerId)) {
      results.push({ imageId: image.id, sourceKey: sourceKey || undefined, status: 'SKIPPED' });
      continue;
    }
    const destinationKey = destinationFor(listingId, sourceKey);
    if (!destinationKey) {
      results.push({ imageId: image.id, sourceKey, status: 'FAILED', error: 'Invalid source filename.' });
      continue;
    }
    if (sourceKey === destinationKey) {
      results.push({ imageId: image.id, sourceKey, destinationKey, status: 'ALREADY_FINALIZED' });
      continue;
    }

    try {
      if (!storage.copy) throw new Error('Storage provider does not support exact-object copy.');
      const copied = await storage.copy(sourceKey, destinationKey);
      if (!copied.success || !copied.destinationExists) throw new Error(copied.error || 'Destination verification failed.');
      const state = await commit({ imageId: image.id, listingId, oldKey: sourceKey, newKey: destinationKey, newStoragePath: destinationKey });
      if (state === 'FINALIZED') results.push({ imageId: image.id, sourceKey, destinationKey, status: 'FINALIZED' });
      else if (state === 'ALREADY_FINALIZED') results.push({ imageId: image.id, sourceKey, destinationKey, status: 'ALREADY_FINALIZED' });
      else throw new Error(`Database compare-and-swap rejected the update: ${state}`);
    } catch (error) {
      results.push({ imageId: image.id, sourceKey, destinationKey, status: 'FAILED', error: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    listingId,
    finalizedCount: results.filter((item) => item.status === 'FINALIZED').length,
    alreadyFinalizedCount: results.filter((item) => item.status === 'ALREADY_FINALIZED').length,
    skippedCount: results.filter((item) => item.status === 'SKIPPED').length,
    failedCount: results.filter((item) => item.status === 'FAILED').length,
    results,
  };
}