import { runExpiryLifecycle } from '../src/lib/lifecycle/expiry';

export async function runScheduledExpiryLifecycle(options: { quiet?: boolean } = {}) {
  const result = await runExpiryLifecycle();
  if (!options.quiet) {
    console.log(
      `Expiry lifecycle: ${result.expiredListings} listings, ${result.expiredSubscriptions} subscriptions, ${result.closedOffers} offers.`,
    );
  }
  return result;
}

if (process.argv[1]?.endsWith('expiry-lifecycle.ts')) {
  runScheduledExpiryLifecycle()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Expiry lifecycle failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}