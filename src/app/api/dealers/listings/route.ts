import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { getDealerRepository, getListingRepository } from '@/lib/db/repositories';
import { ServerTiming } from '@/lib/performance/server-timing';

export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  try {
    const actor = await timing.measure('auth', () => resolveOwnedActiveProfile(req));
    if (!actor.ok) {
      return timing.respond(NextResponse.json({ error: actor.error }, { status: actor.status }));
    }

    const dealerRepo = getDealerRepository();
    const dealer = await timing.measure('dealer', () => dealerRepo.getDealerByProfileId(actor.profileId));

    if (!dealer) {
      return timing.respond(timing.measureSync('serialize', () => NextResponse.json({ listings: [] })));
    }

    const listingRepo = getListingRepository();
    const listings = await listingRepo.getCorporateListings(dealer.id, (stage, duration) => {
      timing.add(stage, duration);
    });

    return timing.respond(timing.measureSync('serialize', () => NextResponse.json({ listings })));
  } catch (error: any) {
    return timing.respond(NextResponse.json(
      { error: error?.message || 'Mağaza ilanları getirilemedi.' },
      { status: 500 }
    ));
  }
}
