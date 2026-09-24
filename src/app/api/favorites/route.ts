import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const listingId = body.listingId;
    const profileId = body.profileId || body.characterId || req.cookies.get('sanboard_profile_id')?.value;
    const userId = body.userId || req.cookies.get('sanboard_user_id')?.value;

    if (!listingId || !profileId) {
      return NextResponse.json(
        { error: 'listingId ve profileId gereklidir.' },
        { status: 400 }
      );
    }

    const repo = getListingRepository();
    const result = await repo.toggleFavorite(profileId, listingId, userId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Bir hata oluştu.' },
      { status: 500 }
    );
  }
}
