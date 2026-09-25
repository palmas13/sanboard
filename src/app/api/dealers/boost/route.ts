import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { getDealerRepository, getUserRepository } from '@/lib/db/repositories';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const { dealerId, listingId } = await req.json().catch(() => ({}));
    if (!dealerId || !listingId) {
      return NextResponse.json({ error: 'dealerId ve listingId zorunludur.' }, { status: 400 });
    }

    const activeProfileId = session.profileId || req.cookies.get('sanboard_profile_id')?.value;
    if (!activeProfileId) {
      return NextResponse.json({ error: 'Aktif karakter profili bulunamadı.' }, { status: 401 });
    }

    const dealerRepo = getDealerRepository();
    const dealer = await dealerRepo.getDealerById(dealerId);

    if (!dealer) {
      return NextResponse.json({ error: 'Kurumsal mağaza bulunamadı.' }, { status: 404 });
    }

    // Verify character ownership (Section 10)
    const isOwner = dealer.owner_profile_id === activeProfileId || dealer.profile_id === activeProfileId;
    if (!isOwner) {
      return NextResponse.json({ error: 'Bu mağazanın öne çıkarma haklarını yönetme yetkiniz yok.' }, { status: 403 });
    }

    if (dealer.moderation_status && dealer.moderation_status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Kurumsal mağazanız askıya alınmış veya pasif durumdadır.' }, { status: 403 });
    }

    if (dealer.subscription_status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Kurumsal üyeliğiniz aktif değil veya süresi dolmuş. Öne çıkarma hakkı kullanamazsınız.' },
        { status: 400 }
      );
    }

    if (!dealer.boost_credits || dealer.boost_credits <= 0) {
      return NextResponse.json(
        { error: 'Bu abonelik dönemi için öne çıkarma hakkınız tükenmiştir.' },
        { status: 400 }
      );
    }

    if (typeof dealerRepo.boostListing !== 'function') {
      return NextResponse.json({ error: 'Öne çıkarma servisi kullanılamıyor.' }, { status: 500 });
    }

    const result = await dealerRepo.boostListing(dealerId, listingId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'İlan öne çıkarılamadı.' }, { status: 400 });
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
    return NextResponse.json({ error: error?.message || 'Öne çıkarma işlemi gerçekleştirilemedi.' }, { status: 500 });
  }
}
