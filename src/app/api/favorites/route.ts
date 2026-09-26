import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';
import { getServerSession } from '@/lib/auth/session';
import { resolveUserId } from '@/lib/db/id-mapper';

async function getOwnedActiveProfileId(req: NextRequest): Promise<
  | { profileId: string; error?: never }
  | { profileId?: never; error: NextResponse }
> {
  const session = await getServerSession(req);
  if (!session?.userId) {
    return {
      error: NextResponse.json(
        { error: 'Yetkisiz erişim. Lütfen giriş yapın.' },
        { status: 401 }
      ),
    };
  }

  if (!session.profileId) {
    return {
      error: NextResponse.json(
        { error: 'Aktif bir karakter profili seçilmedi. Lütfen bir karakter seçin.' },
        { status: 400 }
      ),
    };
  }

  const { getUserRepository } = await import('@/lib/db/repositories');
  const profile = await getUserRepository().getProfileById(session.profileId);
  if (!profile || resolveUserId(profile.user_id) !== resolveUserId(session.userId)) {
    return {
      error: NextResponse.json(
        { error: 'Aktif karakter profili bu hesaba ait değil.' },
        { status: 403 }
      ),
    };
  }

  return { profileId: profile.id };
}

// Set favorite state deterministically (POST)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const listingId = body.listingId;
    const desiredState = body.isFavorited;

    // Cryptographically verified session (rejects raw UUID spoofing)
    const activeProfile = await getOwnedActiveProfileId(req);
    if (activeProfile.error) return activeProfile.error;

    if (!listingId) {
      return NextResponse.json(
        { error: 'listingId parametresi zorunludur.' },
        { status: 400 }
      );
    }

    if (typeof desiredState !== 'boolean') {
      return NextResponse.json(
        { error: 'isFavorited boolean parametresi zorunludur.' },
        { status: 400 }
      );
    }

    const repo = getListingRepository();
    const result = await repo.setFavorite(listingId, activeProfile.profileId, desiredState);
    return NextResponse.json({
      success: true,
      isFavorited: result.isFavorited,
      count: result.count,
    });
  } catch (error: any) {
    const msg = error?.message || 'Bir hata oluştu.';
    const isSelfAbuse = msg.includes('favorilere ekleyemezsiniz');
    return NextResponse.json(
      { error: msg },
      { status: isSelfAbuse ? 400 : 500 }
    );
  }
}

// Check favorite status and total count (GET)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const listingIds = (searchParams.get('listingIds') || searchParams.get('listingId') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 100);

    // Cryptographically verified session
    const session = await getServerSession(req);
    const activeProfileId = session?.profileId;

    if (listingIds.length === 0) {
      return NextResponse.json({ error: 'listingId veya listingIds parametresi zorunludur.' }, { status: 400 });
    }

    const repo = getListingRepository();
    const states = await repo.getFavoriteStates(listingIds, activeProfileId);
    if (searchParams.has('listingIds')) return NextResponse.json({ states, profileId: activeProfileId || null });

    const listingId = listingIds[0];
    const state = states[listingId] || { isFavorited: false, count: 0 };
    return NextResponse.json({ listingId, ...state });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Favori durumu alınamadı.' },
      { status: 500 }
    );
  }
}

// Remove favorite (DELETE)
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);
    const listingId = body.listingId || searchParams.get('listingId');

    // Cryptographically verified session
    const activeProfile = await getOwnedActiveProfileId(req);
    if (activeProfile.error) return activeProfile.error;

    if (!listingId) {
      return NextResponse.json(
        { error: 'listingId parametresi zorunludur.' },
        { status: 400 }
      );
    }

    const repo = getListingRepository();
    const result = await repo.removeFavorite(listingId, activeProfile.profileId);
    return NextResponse.json({
      success: true,
      isFavorited: false,
      count: result.count,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Favoriden çıkarılamadı.' },
      { status: 500 }
    );
  }
}
