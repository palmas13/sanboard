import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId') || req.cookies.get('sanboard_profile_id')?.value;

    const repo = getListingRepository();
    const { listing, isOwner } = await repo.getListingById(id, profileId);

    if (!listing) {
      return NextResponse.json({ error: 'İlan bulunamadı.' }, { status: 404 });
    }

    if (!profileId || !isOwner) {
      return NextResponse.json(
        { error: 'Bu ilanı görüntüleme veya düzenleme yetkiniz yok.' },
        { status: 403 }
      );
    }

    const listingStatus = (listing as any).status;
    if (listingStatus === 'SOLD' || listingStatus === 'REMOVED') {
      return NextResponse.json(
        { error: 'Satılmış veya yayından kaldırılmış ilanlar düzenlenemez.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ listing });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İlan bilgileri getirilemedi.' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const profileId = body.profileId || body.characterId || req.cookies.get('sanboard_profile_id')?.value;
    const { profileId: _, characterId: __, ...input } = body;

    if (!profileId) {
      return NextResponse.json(
        { error: 'profileId parametresi zorunludur.' },
        { status: 400 }
      );
    }

    const repo = getListingRepository();
    const result = await repo.updateListing(id, input, profileId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, listing: result.listing });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İlan güncellenemedi.' },
      { status: 500 }
    );
  }
}
