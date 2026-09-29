import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { getAuditRepository, getDealerRepository } from '@/lib/db/repositories';
import { canBypassTestPayment } from '@/lib/auth/test-login';

export async function POST(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });

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
    const dealerOwnerId = dealer.owner_profile_id || dealer.profile_id;
    if (dealerOwnerId !== actor.profileId) {
      return NextResponse.json({ error: 'Bu mağazanın aboneliğini yalnızca mağaza sahibi karakter aktif edebilir.' }, { status: 403 });
    }

    if (dealer.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Yalnızca onaylanmış kurumsal mağazalar üyelik aktif edebilir.' }, { status: 400 });
    }

    const testActivationBypass = await canBypassTestPayment({ userId: actor.userId, profile: actor.profile });
    if (testActivationBypass) {
      if (typeof dealerRepo.activateSubscription !== 'function') {
        return NextResponse.json({ error: 'Üyelik aktivasyonu kullanılamıyor.' }, { status: 503 });
      }
      const result = await dealerRepo.activateSubscription(dealer.id);
      if (!result.success || !result.dealer) {
        return NextResponse.json({ error: result.error || 'Üyelik aktif edilemedi.' }, { status: 500 });
      }
      try {
        await getAuditRepository().recordEvent({
          eventType: 'TEST_CORPORATE_SUBSCRIPTION_BYPASS',
          userId: actor.userId,
          profileId: actor.profileId,
          metadata: { dealerId: dealer.id, paymentSource: 'TEST_BYPASS', charged: false },
        });
      } catch (auditError) {
        console.error('Failed to record test corporate subscription bypass audit:', auditError);
      }
      return NextResponse.json({ success: true, dealer: result.dealer, testActivationBypass: true });
    }

    return NextResponse.json(
      { error: 'Doğrudan üyelik aktivasyonu kapatıldı. Üyelik Fleeca ödeme akışı üzerinden etkinleştirilmelidir.' },
      { status: 409 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Abonelik işlemi gerçekleştirilemedi.' }, { status: 500 });
  }
}
