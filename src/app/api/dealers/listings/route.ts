import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { getDealerRepository, getListingRepository } from '@/lib/db/repositories';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId') || session?.profileId;

    if (!profileId) {
      return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const dealerRepo = getDealerRepository();
    const dealer = await dealerRepo.getDealerByProfileId(profileId);

    if (!dealer) {
      return NextResponse.json({ listings: [] });
    }

    const listingRepo = getListingRepository();
    const listings = await listingRepo.getCorporateListings(dealer.id);

    return NextResponse.json({ listings });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Mağaza ilanları getirilemedi.' },
      { status: 500 }
    );
  }
}
