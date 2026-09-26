import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { revalidatePath } from 'next/cache';

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const repo = getListingRepository();
    const listings = await repo.getUserListings(actor.profileId);
    return NextResponse.json(listings);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İlanlar getirilemedi.' },
      { status: 500 }
    );
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
