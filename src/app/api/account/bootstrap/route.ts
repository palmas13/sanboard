import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { db } from '@/lib/db/store';
import { ServerTiming } from '@/lib/performance/server-timing';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/bootstrap
 * Single consolidated account bootstrap endpoint to eliminate frontend network waterfalls.
 * Resolves session once and fetches profile, stats, credits, corporate, and support in parallel.
 */
export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  try {
    const actor = await timing.measure('actor', () => resolveOwnedActiveProfile(req));
    if (!actor.ok) return timing.respond(NextResponse.json({ error: actor.error }, { status: actor.status }));
    const profileId = actor.profileId;

    if (process.env.DATA_STORE === 'supabase') {
      const client = getSupabaseAdminClient();
      if (!client) {
        return timing.respond(NextResponse.json({ error: 'Veritabanı bağlantısı kurulamadı.' }, { status: 500 }));
      }

      // Parallel execution of all independent metrics
      const [listingsRes, favsCountRes, creditRes, corpRes, ticketCountRes] =
        await timing.measure('bootstrap', () => Promise.all([
          client
            .from('listings')
            .select('id, status, expires_at')
            .eq('seller_profile_id', profileId)
            .eq('seller_type', 'INDIVIDUAL')
            .is('corporate_profile_id', null),
          client
            .from('favorites')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profileId),
          client
            .from('listing_credits')
            .select('credit_type, corporate_profile_id')
            .eq('profile_id', profileId)
            .eq('status', 'AVAILABLE'),
          client
            .from('corporate_profiles')
            .select('id, company_name, status, moderation_status, public_id, owner_profile_id')
            .eq('owner_profile_id', profileId)
            .neq('moderation_status', 'DELETED')
            .is('deleted_at', null)
            .maybeSingle(),
          client
            .from('support_tickets')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profileId)
            .eq('status', 'OPEN'),
        ]));

      const personalListings = listingsRes.data || [];
      const now = Date.now();
      const activeListings = personalListings.filter((l) => l.status === 'ACTIVE' && (!l.expires_at || new Date(l.expires_at).getTime() > now)).length;
      const expiredListings = personalListings.filter((l) => l.status === 'EXPIRED' || (l.status === 'ACTIVE' && Boolean(l.expires_at) && new Date(l.expires_at!).getTime() <= now)).length;
      
      let totalReceivedFavorites = 0;
      const personalListingIds = personalListings.map((l) => l.id);
      if (personalListingIds.length > 0) {
        const { count } = await timing.measure('favorites', async () => {
          return await client
            .from('favorites')
            .select('*', { count: 'exact', head: true })
            .in('listing_id', personalListingIds);
        });
        totalReceivedFavorites = count || 0;
      }

      const availableCreditRows = creditRes.data || [];
      const individualCredits = availableCreditRows.filter((credit: any) => credit.credit_type === 'INDIVIDUAL' || !credit.credit_type).length;
      const corporateStoreId = corpRes.data?.id;
      const corporateCredits = corporateStoreId
        ? availableCreditRows.filter((credit: any) => credit.credit_type === 'CORPORATE' && credit.corporate_profile_id === corporateStoreId).length
        : 0;
      const availableCredits = individualCredits + corporateCredits;
      const favoritesCount = favsCountRes.count || 0;
      const openTickets = ticketCountRes.count || 0;

      return timing.respond(NextResponse.json({
        success: true,
        profile: actor.profile,
        stats: {
          activeListings,
          expiredListings,
          favoritesCount,
          favorites: favoritesCount,
          totalReceivedFavorites,
        },
        credits: {
          availableCredits,
          individualCredits,
          corporateCredits,
        },
        corporate: {
          isDealer: Boolean(corpRes.data && (corpRes.data.status === 'APPROVED' || corpRes.data.moderation_status === 'ACTIVE')),
          dealerProfile: corpRes.data || null,
        },
        support: {
          openTickets,
        },
      }));
    }

    // Memory Store Implementation
    const personalListings = db.listings.filter(
      (l) => l.seller_profile_id === profileId && l.seller_type === 'INDIVIDUAL' && !l.corporate_profile_id
    );
    const now = Date.now();
    const activeListings = personalListings.filter((l) => l.status === 'ACTIVE' && (!l.expires_at || new Date(l.expires_at).getTime() > now)).length;
    const expiredListings = personalListings.filter((l) => l.status === 'EXPIRED' || (l.status === 'ACTIVE' && Boolean(l.expires_at) && new Date(l.expires_at!).getTime() <= now)).length;
    const personalListingIds = new Set(personalListings.map((l) => l.id));
    const totalReceivedFavorites = db.favorites.filter((f) => personalListingIds.has(f.listing_id)).length;

    const favoritesCount = db.favorites.filter((f) => f.profile_id === profileId).length;
    const corpStore = (db.dealers || []).find(
      (d) => (d.owner_profile_id === profileId || d.profile_id === profileId) && d.moderation_status !== 'DELETED' && !d.deleted_at
    );
    const availableCreditRows = db.credits.filter((c) => c.profile_id === profileId && c.status === 'AVAILABLE');
    const individualCredits = availableCreditRows.filter((credit) => credit.credit_type === 'INDIVIDUAL' || !credit.credit_type).length;
    const corporateCredits = corpStore
      ? availableCreditRows.filter((credit) => credit.credit_type === 'CORPORATE' && credit.corporate_profile_id === corpStore.id).length
      : 0;
    const availableCredits = individualCredits + corporateCredits;
    const openTickets = db.tickets.filter(
      (t) => t.profile_id === profileId && t.status === 'OPEN'
    ).length;

    return timing.respond(NextResponse.json({
      success: true,
      profile: actor.profile,
      stats: {
        activeListings,
        expiredListings,
        favoritesCount,
        favorites: favoritesCount,
        totalReceivedFavorites,
      },
      credits: {
        availableCredits,
        individualCredits,
        corporateCredits,
      },
      corporate: {
        isDealer: Boolean(corpStore && corpStore.status === 'APPROVED'),
        dealerProfile: corpStore || null,
      },
      support: {
        openTickets,
      },
    }));
  } catch (error: any) {
    return timing.respond(NextResponse.json(
      { error: error?.message || 'Hesap verileri yüklenemedi.' },
      { status: 500 }
    ));
  }
}
