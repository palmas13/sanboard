import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { revalidatePath } from 'next/cache';
import { ServerTiming } from '@/lib/performance/server-timing';

export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  try {
    const actor = await timing.measure('actor', () => resolveOwnedActiveProfile(req, (stage, duration) => {
      timing.add(stage, duration);
    }));
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
    const { listingId, action, closeReason } = await req.json();

    if (!listingId) {
      return NextResponse.json(
        { error: 'Doğrulanmış aktif karakter ve listingId gereklidir.' },
        { status: 401 }
      );
    }

    const repo = getListingRepository();
    if (!['SOLD', 'REMOVED', 'REPUBLISH'].includes(action)) {
      return NextResponse.json({ error: 'Geçersiz ilan işlemi.' }, { status: 400 });
    }
    if (action !== 'REPUBLISH' && !['SOLD', 'CANCELLED', 'OTHER'].includes(closeReason)) {
      return NextResponse.json({ error: 'Geçerli bir kapatma nedeni seçilmelidir.' }, { status: 400 });
    }
    if ((action === 'SOLD') !== (closeReason === 'SOLD')) {
      return NextResponse.json({ error: 'İlan durumu ile kapatma nedeni uyuşmuyor.' }, { status: 400 });
    }
    const result = action === 'REPUBLISH'
      ? await repo.republishListing(listingId, actor.profileId)
      : await repo.closeListing(listingId, actor.profileId, action, closeReason);
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
      listing: 'listing' in result ? result.listing : undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İşlem gerçekleştirilemedi.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const { status } = await req.json().catch(() => ({}));
    if (status !== 'EXPIRED' && status !== 'SOLD') {
      return NextResponse.json({ error: 'Yalnızca süresi dolan veya satılan ilan geçmişi temizlenebilir.' }, { status: 400 });
    }
    const result = await getListingRepository().clearUserListingHistory(actor.profileId, status);
    return NextResponse.json(result.success ? result : { error: result.error }, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'İlan geçmişi temizlenemedi.' }, { status: 500 });
  }
}
