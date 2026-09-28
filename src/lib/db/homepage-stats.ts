import { getSupabaseAdminClient } from './supabase-client';
import { db } from './store';

export interface HomepageStats {
  activeListings: number;
  totalOffers: number;
  totalSellers: number;
}

export async function getHomepageStats(activeListings: number): Promise<HomepageStats> {
  if (process.env.DATA_STORE === 'supabase') {
    const client = getSupabaseAdminClient();
    if (client) {
      const [offersResult, usersResult] = await Promise.all([
        client.from('offer_threads').select('*', { count: 'exact', head: true }),
        client.from('users').select('*', { count: 'exact', head: true }),
      ]);

      if (offersResult.error) throw new Error(`Homepage teklif sayısı alınamadı: ${offersResult.error.message}`);
      if (usersResult.error) throw new Error(`Homepage kullanıcı sayısı alınamadı: ${usersResult.error.message}`);

      return {
        activeListings,
        totalOffers: offersResult.count || 0,
        totalSellers: usersResult.count || 0,
      };
    }
  }

  return {
    activeListings,
    totalOffers: db.offerThreads.length,
    totalSellers: db.users.length,
  };
}