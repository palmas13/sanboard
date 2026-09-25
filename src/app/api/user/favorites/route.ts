import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';
import { getServerSession } from '@/lib/auth/session';

// Get current authenticated user's favorites (GET)
export async function GET(req: NextRequest) {
  try {
    // SERVER-SIDE ONLY: extract authenticated account user_id from verified session token
    // Reject plain unverified query params or raw cookies to prevent user spoofing
    const session = await getServerSession(req);
    const activeProfileId = session?.profileId;

    if (!session?.userId || !activeProfileId) {
      return NextResponse.json(
        { error: 'Yetkisiz erişim. Lütfen giriş yapın ve bir karakter seçin.' },
        { status: 401 }
      );
    }

    const repo = getListingRepository();
    const favorites = await repo.getUserFavorites(activeProfileId);
    return NextResponse.json(favorites);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Favoriler getirilemedi.' },
      { status: 500 }
    );
  }
}
