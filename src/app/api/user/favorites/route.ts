import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId') || req.cookies.get('sanboard_profile_id')?.value;
    const userId = searchParams.get('userId') || req.cookies.get('sanboard_user_id')?.value || undefined;

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId gereklidir.' },
        { status: 400 }
      );
    }

    const repo = getListingRepository();
    const favorites = await repo.getUserFavorites(profileId, userId);
    return NextResponse.json(favorites);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Favoriler getirilemedi.' },
      { status: 500 }
    );
  }
}
