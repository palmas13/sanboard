import { getSupabaseAdminClient } from '@/lib/db/supabase-client';

export interface ExpiryLifecycleResult {
  expiredListings: number;
  expiredSubscriptions: number;
  blockedSubscriptions: number;
  frozenMembershipListings: number;
  closedOffers: number;
}

/**
 * Materializes time-derived expiry states in one database transaction.
 * Public visibility already fails closed on timestamps; this job keeps durable
 * statuses, offer state, dashboards, and operational queries in agreement.
 */
export async function runExpiryLifecycle(): Promise<ExpiryLifecycleResult> {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('Supabase admin credentials are required for expiry lifecycle.');

  const { data, error } = await client.rpc('run_expiry_lifecycle');
  if (error) throw new Error(`Expiry lifecycle failed: ${error.message}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.success !== true) throw new Error('Expiry lifecycle returned an invalid result.');

  return {
    expiredListings: Number(result.expired_listings || 0),
    expiredSubscriptions: Number(result.expired_subscriptions || 0),
    blockedSubscriptions: Number(result.blocked_subscriptions || 0),
    frozenMembershipListings: Number(result.frozen_membership_listings || 0),
    closedOffers: Number(result.closed_offers || 0),
  };
}
