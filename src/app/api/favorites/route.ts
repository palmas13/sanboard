import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';
import { getServerSession } from '@/lib/auth/session';

// Toggle favorite (POST)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const listingId = body.listingId;

    // Cryptographically verified session (rejects raw UUID spoofing)
    const session = await getServerSession(req);
    const sessionUserId = session?.userId;

    if (!sessionUserId) {
      return NextResponse.json(
        { error: 'Yetkisiz erişim. Lütfen giriş yapın.' },
        { status: 401 }
      );
    }

    if (!listingId) {
      return NextResponse.json(
        { error: 'listingId parametresi zorunludur.' },
        { status: 400 }
      );
    }

    const repo = getListingRepository();
    const result = await repo.toggleFavorite(listingId, sessionUserId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Bir hata oluştu.' },
      { status: 500 }
    );
  }
}

// Check favorite status and total count (GET)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const listingId = searchParams.get('listingId');

    // Cryptographically verified session
    const session = await getServerSession(req);
    const sessionUserId = session?.userId;

    if (!listingId) {
      return NextResponse.json({ error: 'listingId parametresi zorunludur.' }, { status: 400 });
    }

    const repo = getListingRepository();
    const { listing } = await repo.getListingById(listingId, session?.profileId, sessionUserId);

    if (!listing) {
      return NextResponse.json({ error: 'İlan bulunamadı.' }, { status: 404 });
    }

    return NextResponse.json({
      listingId,
      isFavorited: Boolean((listing as any).is_favorited),
      count: listing.favorite_count || 0,
    });
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
    const session = await getServerSession(req);
    const sessionUserId = session?.userId;

    if (!sessionUserId) {
      return NextResponse.json(
        { error: 'Yetkisiz erişim. Lütfen giriş yapın.' },
        { status: 401 }
      );
    }

    if (!listingId) {
      return NextResponse.json(
        { error: 'listingId parametresi zorunludur.' },
        { status: 400 }
      );
    }

    const repo = getListingRepository();
    const result = await repo.removeFavorite(listingId, sessionUserId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Favoriden çıkarılamadı.' },
      { status: 500 }
    );
  }
}
