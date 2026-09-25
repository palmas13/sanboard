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

import { revalidatePath } from 'next/cache';
import { getServerSession } from '@/lib/auth/session';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const session = await getServerSession(req);
    const profileId = session?.profileId || body.profileId || body.sellerProfileId || body.characterId;
    const userId = session?.userId || body.userId;
    const role = session?.role;
    const { profileId: _, sellerProfileId: ____, characterId: __, userId: ___, ...input } = body;

    if (!profileId && !userId) {
      return NextResponse.json(
        { error: 'Yetkisiz erişim. Lütfen giriş yapın.' },
        { status: 401 }
      );
    }

    const repo = getListingRepository();
    const result = await repo.updateListing(id, input, profileId, userId, role);

    if (!result.success) {
      const isForbidden = result.error?.includes('yetkiniz yok');
      return NextResponse.json({ error: result.error }, { status: isForbidden ? 403 : 400 });
    }

    // Invalidate Next.js cache so homepage, category, and detail pages update instantly
    try {
      revalidatePath('/');
      revalidatePath('/arac');
      revalidatePath('/mulk');
      revalidatePath(`/ilan/${id}`);
      revalidatePath('/hesabim/ilanlarim');
    } catch {
      // Ignore cache revalidation errors if outside request context
    }

    return NextResponse.json({ success: true, listing: result.listing });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İlan güncellenemedi.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(req);
    const profileId = session?.profileId;

    if (!session?.userId || !profileId) {
      return NextResponse.json(
        { error: 'Yetkisiz erişim. Lütfen giriş yapın ve aktif karakter seçin.' },
        { status: 401 }
      );
    }

    const repo = getListingRepository();
    if (!repo.removeListing) {
      return NextResponse.json(
        { error: 'İlan silme fonksiyonu desteklenmiyor.' },
        { status: 500 }
      );
    }

    const result = await repo.removeListing(id, profileId);
    if (!result.success) {
      const isForbidden = result.error?.includes('yetkiniz yok');
      return NextResponse.json({ error: result.error }, { status: isForbidden ? 403 : 400 });
    }

    try {
      revalidatePath('/');
      revalidatePath('/arac');
      revalidatePath('/mulk');
      revalidatePath(`/ilan/${id}`);
      revalidatePath('/hesabim/ilanlarim');
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'İlan silinemedi.' },
      { status: 500 }
    );
  }
}
