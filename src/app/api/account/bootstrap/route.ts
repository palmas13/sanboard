import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { db } from '@/lib/db/store';
import { ServerTiming } from '@/lib/performance/server-timing';
import { resolveCorporateEligibility } from '@/lib/dealers/eligibility';
import { getListingCoverPath } from '@/lib/listings/images';

function toUpcomingPersonalListings(listings: any[], now: number) {
  return listings
    .filter((listing) => listing.status === 'ACTIVE' && Boolean(listing.expires_at) && new Date(listing.expires_at).getTime() > now)
    .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())
    .slice(0, 3)
    .map((listing) => ({
      id: listing.id,
      public_id: listing.public_id || null,
      title: listing.title,
      expires_at: listing.expires_at,
      cover_image: getListingCoverPath(listing.listing_images || listing.images) || null,
    }));
}

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
      const [listingsRes, favsCountRes, creditRes, corpRes, ticketCountRes, corporateEligibility] =
        await timing.measure('bootstrap', () => Promise.all([
          client
            .from('listings')
            .select('id, public_id, title, status, expires_at, listing_images(id, listing_id, storage_path, sort_order, is_cover, size_bytes, created_at)')
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
          resolveCorporateEligibility(profileId),
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
      const corporateCredits = corporateEligibility.eligible && corporateStoreId
        ? availableCreditRows.filter((credit: any) => credit.credit_type === 'CORPORATE' && credit.corporate_profile_id === corporateStoreId).length
        : 0;
      const availableCredits = individualCredits + corporateCredits;
      const upcomingPersonalListings = toUpcomingPersonalListings(personalListings, now);
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
        upcomingPersonalListings,
        corporate: {
          isDealer: corporateEligibility.eligible,
          dealerProfile: corpRes.data || null,
          eligibility: { eligible: corporateEligibility.eligible, reason: corporateEligibility.reason },
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
    const corporateEligibility = await resolveCorporateEligibility(profileId);
    const corporateCredits = corporateEligibility.eligible && corpStore
      ? availableCreditRows.filter((credit) => credit.credit_type === 'CORPORATE' && credit.corporate_profile_id === corpStore.id).length
      : 0;
    const availableCredits = individualCredits + corporateCredits;
    const upcomingPersonalListings = toUpcomingPersonalListings(personalListings, now);
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
      upcomingPersonalListings,
      corporate: {
        isDealer: corporateEligibility.eligible,
        dealerProfile: corpStore || null,
        eligibility: { eligible: corporateEligibility.eligible, reason: corporateEligibility.reason },
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
