import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';

// Get current authenticated user's favorites (GET)
export async function GET(req: NextRequest) {
  try {
    // SERVER-SIDE ONLY: extract authenticated account user_id from verified session token
    // Reject plain unverified query params or raw cookies to prevent user spoofing
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const repo = getListingRepository();
    const favorites = await repo.getUserFavorites(actor.profileId);
    return NextResponse.json(favorites);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Favoriler getirilemedi.' },
      { status: 500 }
    );
  }
}
