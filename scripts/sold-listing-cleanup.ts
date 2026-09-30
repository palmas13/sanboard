import { getSupabaseAdminClient } from '../src/lib/db/supabase-client';
import { deleteMediaSafely } from '../src/lib/storage/lifecycle';

export async function cleanupExpiredSoldListings(options: { now?: Date; quiet?: boolean } = {}) {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('SUPABASE_SECRET_KEY is required for sold listing cleanup.');

  const cutoff = new Date((options.now || new Date()).getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: listings, error } = await client
    .from('listings')
    .select('id, category, listing_images(storage_path)')
    .eq('status', 'SOLD')
    .lte('closed_at', cutoff)
    .limit(100);
  if (error) throw new Error(error.message);

  let cleaned = 0;
  let failed = 0;
  for (const listing of listings || []) {
    const mediaType = listing.category === 'vehicle' ? 'VEHICLE_IMAGE' : 'PROPERTY_IMAGE';
    try {
      for (const image of listing.listing_images || []) {
        if (image.storage_path) await deleteMediaSafely(image.storage_path, mediaType, 'LISTING_SOLD');
      }
      await client.from('favorites').delete().eq('listing_id', listing.id).throwOnError();
      await client.from('listing_price_history').delete().eq('listing_id', listing.id).throwOnError();
      await client.from('vehicle_details').delete().eq('listing_id', listing.id).throwOnError();
      await client.from('property_details').delete().eq('listing_id', listing.id).throwOnError();
      await client.from('listing_images').delete().eq('listing_id', listing.id).throwOnError();
      await client.from('listings').delete().eq('id', listing.id).eq('status', 'SOLD').throwOnError();
      cleaned++;
    } catch (cleanupError) {
      failed++;
      console.error(`Sold listing cleanup will retry ${listing.id}:`, cleanupError);
    }
  }

  if (!options.quiet) console.log(`Sold listing cleanup: ${cleaned} cleaned, ${failed} pending retry.`);
  return { cleaned, failed };
}

if (process.argv[1]?.endsWith('sold-listing-cleanup.ts')) {
  cleanupExpiredSoldListings()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Sold listing cleanup failed:', error);
      process.exit(1);
    });
}