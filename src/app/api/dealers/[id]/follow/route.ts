import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { getDealerRepository, getUserRepository } from '@/lib/db/repositories';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealerId } = await params;
    const session = await getServerSession(req);

    if (!session?.userId) {
      return NextResponse.json({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const { profileId } = await req.json().catch(() => ({}));
    const activeProfileId = profileId || session.profileId;

    if (!activeProfileId) {
      return NextResponse.json({ error: 'Takip işlemi için aktif bir karakter profili seçilmelidir.' }, { status: 400 });
    }

    // Verify profile belongs to authenticated user
    const userRepo = getUserRepository();
    const userProfiles = await userRepo.getProfilesByUserId(session.userId);
    const hasProfile = userProfiles.some((p) => p.id === activeProfileId);

    if (!hasProfile && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Bu karakter profili adına işlem yapamazsınız.' }, { status: 403 });
    }

    const dealerRepo = getDealerRepository();
    if (typeof dealerRepo.toggleFollow !== 'function') {
      return NextResponse.json({ error: 'Takipçi servisi kullanılamıyor.' }, { status: 500 });
    }

    const result = await dealerRepo.toggleFollow(activeProfileId, dealerId);
    return NextResponse.json({
      success: true,
      isFollowing: result.isFollowing,
      followerCount: result.count,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Takip işlemi gerçekleştirilemedi.' }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealerId } = await params;
    const session = await getServerSession(req);
    const profileId = req.nextUrl.searchParams.get('profileId') || session?.profileId;

    const dealerRepo = getDealerRepository();
    let isFollowing = false;
    if (profileId && typeof dealerRepo.isFollowing === 'function') {
      isFollowing = await dealerRepo.isFollowing(profileId, dealerId);
    }

    let followerCount = 0;
    if (typeof dealerRepo.getFollowers === 'function') {
      const list = await dealerRepo.getFollowers(dealerId);
      followerCount = list.length;
    }

    return NextResponse.json({
      success: true,
      isFollowing,
      followerCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Takip durumu sorgulanamadı.' }, { status: 500 });
  }
}
