import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { getDealerRepository, getListingRepository } from '@/lib/db/repositories';

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const dealerRepo = getDealerRepository();
    const dealer = await dealerRepo.getDealerByProfileId(actor.profileId);

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
