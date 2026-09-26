import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { getDealerRepository } from '@/lib/db/repositories';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealerId } = await params;
    const { isFollowing } = await req.json().catch(() => ({}));
    const activeProfile = await resolveOwnedActiveProfile(req);
    if (!activeProfile.ok) {
      return NextResponse.json({ error: activeProfile.error }, { status: activeProfile.status });
    }

    const dealerRepo = getDealerRepository();
    if (typeof isFollowing !== 'boolean') {
      return NextResponse.json({ error: 'Takip durumu belirtilmelidir.' }, { status: 400 });
    }

    if (typeof dealerRepo.setFollow !== 'function') {
      return NextResponse.json({ error: 'Takipçi servisi kullanılamıyor.' }, { status: 500 });
    }

    const result = await dealerRepo.setFollow(activeProfile.profileId, dealerId, isFollowing);
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
    const resolvedProfile = session?.profileId ? await resolveOwnedActiveProfile(req) : null;
    const profileId = resolvedProfile?.ok ? resolvedProfile.profileId : undefined;

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
