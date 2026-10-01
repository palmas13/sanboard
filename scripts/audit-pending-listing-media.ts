import { getSupabaseAdminClient } from '../src/lib/db/supabase-client';
import { extractObjectKey } from '../src/lib/media/url';

export async function auditPendingListingMedia() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('SUPABASE_SECRET_KEY is required for the read-only listing media audit.');
  const { data, error } = await client
    .from('listing_images')
    .select('id,listing_id,storage_path,listings!inner(status)')
    .eq('listings.status', 'ACTIVE');
  if (error) throw new Error(`Listing media audit failed: ${error.message}`);
  return (data || []).flatMap((row: any) => {
    const key = extractObjectKey(row.storage_path);
    return key?.startsWith('listings/pending-')
      ? [{ listingId: row.listing_id, imageId: row.id, storagePath: row.storage_path, canonicalKey: key, status: row.listings?.status || 'ACTIVE' }]
      : [];
  });
}

if (process.argv[1]?.includes('audit-pending-listing-media')) {
  auditPendingListingMedia()
    .then((rows) => console.log(JSON.stringify({ count: rows.length, rows }, null, 2)))
    .catch((error) => { console.error(error); process.exitCode = 1; });
}