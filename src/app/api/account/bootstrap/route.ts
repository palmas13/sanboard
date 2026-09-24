import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { getSupabaseAdminClient } from '@/lib/db/supabase-client';
import { db } from '@/lib/db/store';
import { resolveUserId, resolveProfileId } from '@/lib/db/id-mapper';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/bootstrap
 * Single consolidated account bootstrap endpoint to eliminate frontend network waterfalls.
 * Resolves session once and fetches profile, stats, credits, corporate, and support in parallel.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Yetkisiz erişim. Lütfen giriş yapın.' },
        { status: 401 }
      );
    }

    const userId = resolveUserId(session.userId);
    const profileId = session.profileId ? resolveProfileId(session.profileId) : undefined;

    if (process.env.DATA_STORE === 'supabase') {
      const client = getSupabaseAdminClient();
      if (!client) {
        return NextResponse.json({ error: 'Veritabanı bağlantısı kurulamadı.' }, { status: 500 });
      }

      // Parallel execution of all independent metrics
      const [profileRes, listingsRes, favsCountRes, creditRes, corpRes, ticketCountRes] =
        await Promise.all([
          profileId
            ? client.from('character_profiles').select('*').eq('id', profileId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          client
            .from('listings')
            .select('id, status, favorite_count')
            .eq('user_id', userId)
            .eq('seller_type', 'INDIVIDUAL'),
          client
            .from('favorites')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId),
          profileId
            ? client
                .from('listing_credits')
                .select('balance')
                .eq('profile_id', profileId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          profileId
            ? client
                .from('corporate_profiles')
                .select('id, company_name, status, public_id')
                .eq('profile_id', profileId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          client
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'OPEN'),
        ]);

      const personalListings = listingsRes.data || [];
      const activeListings = personalListings.filter((l) => l.status === 'ACTIVE').length;
      const expiredListings = personalListings.filter((l) => l.status === 'EXPIRED').length;
      const totalReceivedFavorites = personalListings.reduce(
        (sum, l) => sum + (l.favorite_count || 0),
        0
      );

      const availableCredits = creditRes.data?.balance || 0;
      const favoritesCount = favsCountRes.count || 0;
      const openTickets = ticketCountRes.count || 0;

      return NextResponse.json({
        success: true,
        profile: profileRes.data || null,
        stats: {
          activeListings,
          expiredListings,
          favoritesCount,
          favorites: favoritesCount,
          totalReceivedFavorites,
        },
        credits: {
          availableCredits,
        },
        corporate: {
          isDealer: Boolean(corpRes.data && corpRes.data.status === 'APPROVED'),
          dealerProfile: corpRes.data || null,
        },
        support: {
          openTickets,
        },
      });
    }

    // Memory Store Implementation
    const memProfile = db.profiles.find(
      (p) =>
        p.id === profileId ||
        p.id === session.profileId ||
        p.user_id === userId ||
        p.user_id === session.userId ||
        (userId === '33333333-3333-3333-3333-333333333333' && p.user_id === 'usr-user-2') ||
        (userId === '22222222-2222-2222-2222-222222222222' && p.user_id === 'usr-admin-1')
    );
    const userProfiles = db.profiles.filter(
      (p) =>
        p.id === profileId ||
        p.id === session.profileId ||
        p.user_id === userId ||
        p.user_id === session.userId ||
        (userId === '33333333-3333-3333-3333-333333333333' && p.user_id === 'usr-user-2') ||
        (userId === '22222222-2222-2222-2222-222222222222' && p.user_id === 'usr-admin-1')
    );
    const profileIds = new Set(userProfiles.map((p) => p.id));
    if (profileId) profileIds.add(profileId);

    const personalListings = db.listings.filter(
      (l) => profileIds.has(l.seller_profile_id) && l.seller_type !== 'CORPORATE'
    );
    const activeListings = personalListings.filter((l) => l.status === 'ACTIVE').length;
    const expiredListings = personalListings.filter((l) => l.status === 'EXPIRED').length;
    const totalReceivedFavorites = personalListings.reduce(
      (sum, l) => sum + (l.favorite_count || 0),
      0
    );

    const favoritesCount = db.favorites.filter((f) => f.user_id === userId).length;
    const availableCredits = db.credits.filter(
      (c) => c.profile_id === profileId && c.status === 'AVAILABLE'
    ).length;
    const corpStore = db.dealers.find((d) => d.profile_id === profileId);
    const openTickets = db.tickets.filter(
      (t) => (profileIds.has(t.profile_id) || t.profile_id === profileId) && t.status === 'OPEN'
    ).length;

    return NextResponse.json({
      success: true,
      profile: memProfile || null,
      stats: {
        activeListings,
        expiredListings,
        favoritesCount,
        favorites: favoritesCount,
        totalReceivedFavorites,
      },
      credits: {
        availableCredits,
      },
      corporate: {
        isDealer: Boolean(corpStore && corpStore.status === 'APPROVED'),
        dealerProfile: corpStore || null,
      },
      support: {
        openTickets,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Hesap verileri yüklenemedi.' },
      { status: 500 }
    );
  }
}
