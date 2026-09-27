import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { revalidatePath } from 'next/cache';
import { ServerTiming } from '@/lib/performance/server-timing';

export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  try {
    const actor = await timing.measure('actor', () => resolveOwnedActiveProfile(req));
    if (!actor.ok) return timing.respond(NextResponse.json({ error: actor.error }, { status: actor.status }));

    const repo = getListingRepository();
    const listingsStartedAt = performance.now();
    try {
      const listings = await repo.getUserListings(actor.profileId, (stage, duration) => {
        const metricName = stage === 'query' || stage === 'enrich' || stage === 'map'
          ? `listings_${stage}`
          : stage;
        timing.add(metricName, duration);
      });
      const response = timing.measureSync('listings_serialize', () => NextResponse.json(listings));
      timing.add('listings', performance.now() - listingsStartedAt);
      return timing.respond(response);
    } catch (error) {
      timing.add('listings', performance.now() - listingsStartedAt);
      throw error;
    }
  } catch (error: any) {
    return timing.respond(NextResponse.json(
      { error: error?.message || 'İlanlar getirilemedi.' },
      { status: 500 }
    ));
  }
}

// Mark as sold
export async function PATCH(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const { listingId, action = 'SOLD' } = await req.json();

    if (!listingId) {
      return NextResponse.json(
        { error: 'Doğrulanmış aktif karakter ve listingId gereklidir.' },
        { status: 401 }
      );
    }

    const repo = getListingRepository();
    const result = action === 'REPUBLISH'
      ? await repo.republishListing(listingId, actor.profileId)
      : await repo.markListingAsSold(listingId, actor.profileId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    revalidatePath('/');
    revalidatePath('/arac');
    revalidatePath('/mulk');
    revalidatePath(`/ilan/${listingId}`);
    revalidatePath('/hesabim/ilanlarim');
    return NextResponse.json({
      success: true,
      listing: action === 'REPUBLISH' && 'listing' in result ? result.listing : undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İşlem gerçekleştirilemedi.' },
      { status: 500 }
    );
  }
}
