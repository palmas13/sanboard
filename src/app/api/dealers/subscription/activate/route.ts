import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { getDealerRepository } from '@/lib/db/repositories';

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

    return NextResponse.json(
      { error: 'Doğrudan üyelik aktivasyonu kapatıldı. Üyelik Fleeca ödeme akışı üzerinden etkinleştirilmelidir.' },
      { status: 409 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Abonelik işlemi gerçekleştirilemedi.' }, { status: 500 });
  }
}
