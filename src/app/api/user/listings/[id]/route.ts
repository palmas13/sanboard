import { NextRequest, NextResponse } from 'next/server';
import { getListingRepository } from '@/lib/db/repositories';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { revalidatePath } from 'next/cache';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const repo = getListingRepository();
    const { listing, isOwner } = await repo.getListingById(id, actor.profileId, actor.userId);

    if (!listing) {
      return NextResponse.json({ error: 'İlan bulunamadı.' }, { status: 404 });
    }

    if (!isOwner || (listing as any).seller_profile_id !== actor.profileId) {
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
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const { profileId: _, sellerProfileId: ____, characterId: __, userId: ___, ...input } = body;

    const repo = getListingRepository();
    const result = await repo.updateListing(id, input, actor.profileId, actor.userId, actor.role);

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
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

    const repo = getListingRepository();
    if (!repo.removeListing) {
      return NextResponse.json(
        { error: 'İlan silme fonksiyonu desteklenmiyor.' },
        { status: 500 }
      );
    }

    const result = await repo.removeListing(id, actor.profileId);
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
