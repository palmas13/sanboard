import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { getDealerRepository } from '@/lib/db/repositories';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const { listingId } = await req.json().catch(() => ({}));
    if (!listingId) return NextResponse.json({ error: 'listingId zorunludur.' }, { status: 400 });
    const dealerRepo = getDealerRepository();
    if (typeof dealerRepo.boostListing !== 'function') {
      return NextResponse.json({ error: 'Öne çıkarma servisi kullanılamıyor.' }, { status: 500 });
    }

    const result = await dealerRepo.boostListing(actor.profileId, listingId);
    if (!result.success) {
      const status = result.code === 'LISTING_NOT_OWNED' ? 403 : 400;
      return NextResponse.json({ error: result.error || 'İlan öne çıkarılamadı.', code: result.code }, { status });
    }

    try {
      revalidatePath('/arac');
      revalidatePath('/mulk');
      revalidatePath('/');
    } catch {}

    return NextResponse.json({
      success: true,
      remainingBoosts: result.remainingBoosts,
      featured_until: result.featured_until,
      message: 'İlanınız başarıyla 24 saat boyunca öne çıkarıldı.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Öne çıkarma işlemi gerçekleştirilemedi.' }, { status: 500 });
  }
}
