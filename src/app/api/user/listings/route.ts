import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId') || req.cookies.get('sanboard_profile_id')?.value;

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId gereklidir.' },
        { status: 400 }
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
    const { listingId, profileId } = await req.json();

    if (!listingId || !profileId) {
      return NextResponse.json(
        { error: 'listingId ve profileId gereklidir.' },
        { status: 400 }
      );
    }

    const repo = getListingRepository();
    const result = await repo.markListingAsSold(listingId, profileId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İşlem gerçekleştirilemedi.' },
      { status: 500 }
    );
  }
}
