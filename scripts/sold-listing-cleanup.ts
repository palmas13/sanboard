import { runListingPurgeWorker } from '../src/lib/lifecycle/listing-purge-worker';

export async function cleanupExpiredSoldListings(options: { quiet?: boolean } = {}) {
  const counts = await runListingPurgeWorker();
  if (!options.quiet) console.log('Durable listing purge:', counts);
  return { cleaned: counts.completed, failed: counts.failed + counts.retried };
}

if (process.argv[1]?.endsWith('sold-listing-cleanup.ts')) {
  // Production uses durable claimed jobs; retain the legacy exported function for compatibility.
  runListingPurgeWorker()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Sold listing cleanup failed:', error);
      process.exit(1);
    });
}