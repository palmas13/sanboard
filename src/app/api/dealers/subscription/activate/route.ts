import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { getDealerRepository, getUserRepository } from '@/lib/db/repositories';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' }, { status: 401 });
    }

    const { dealerId } = await req.json().catch(() => ({}));
    if (!dealerId) {
      return NextResponse.json({ error: 'dealerId parametresi zorunludur.' }, { status: 400 });
    }

    const dealerRepo = getDealerRepository();
    const dealer = await dealerRepo.getDealerById(dealerId);

    if (!dealer) {
      return NextResponse.json({ error: 'Kurumsal mağaza bulunamadı.' }, { status: 404 });
    }

    // Verify ownership: active character profile must strictly own the dealer store (Section 28)
    const activeProfileId = session.profileId;
    if (!activeProfileId) {
      return NextResponse.json({ error: 'Abonelik işlemi için aktif bir karakter seçilmelidir.' }, { status: 400 });
    }

    const dealerOwnerId = dealer.owner_profile_id || dealer.profile_id;
    if (dealerOwnerId !== activeProfileId && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Bu mağazanın aboneliğini yalnızca mağaza sahibi karakter aktif edebilir.' }, { status: 403 });
    }

    if (dealer.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Yalnızca onaylanmış kurumsal mağazalar üyelik aktif edebilir.' }, { status: 400 });
    }

    if (typeof dealerRepo.activateSubscription !== 'function') {
      return NextResponse.json({ error: 'Abonelik aktivasyon servisi kullanılamıyor.' }, { status: 500 });
    }

    const result = await dealerRepo.activateSubscription(dealerId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Abonelik aktif edilemedi.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      dealer: result.dealer,
      message: 'Kurumsal mağaza aboneliğiniz 30 gün boyunca aktif edildi. 3 adet öne çıkarma hakkı tanımlandı.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Abonelik işlemi gerçekleştirilemedi.' }, { status: 500 });
  }
}
