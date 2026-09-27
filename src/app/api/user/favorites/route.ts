import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { ServerTiming } from '@/lib/performance/server-timing';

// Get current authenticated user's favorites (GET)
export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  try {
    // SERVER-SIDE ONLY: extract authenticated account user_id from verified session token
    // Reject plain unverified query params or raw cookies to prevent user spoofing
    const actor = await timing.measure('actor', () => resolveOwnedActiveProfile(req));
    if (!actor.ok) return timing.respond(NextResponse.json({ error: actor.error }, { status: actor.status }));

    const repo = getListingRepository();
    const favorites = await timing.measure('favorites', () => repo.getUserFavorites(actor.profileId));
    return timing.respond(NextResponse.json(favorites));
  } catch (error: any) {
    return timing.respond(NextResponse.json(
      { error: error?.message || 'Favoriler getirilemedi.' },
      { status: 500 }
    ));
  }
}
