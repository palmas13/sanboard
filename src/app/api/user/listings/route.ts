import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';
import { getServerSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    const profileId = session?.profileId;

    if (!profileId) {
      return NextResponse.json(
        { error: 'Doğrulanmış aktif karakter gereklidir.' },
        { status: 401 }
      );
    }

    const repo = getListingRepository();
    const listings = await repo.getUserListings(profileId);
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
    const session = await getServerSession(req);
    const profileId = session?.profileId;
    const { listingId, action = 'SOLD' } = await req.json();

    if (!listingId || !profileId) {
      return NextResponse.json(
        { error: 'Doğrulanmış aktif karakter ve listingId gereklidir.' },
        { status: 401 }
      );
    }

    const repo = getListingRepository();
    const result = action === 'REPUBLISH'
      ? await repo.republishListing(listingId, profileId)
      : await repo.markListingAsSold(listingId, profileId);
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
