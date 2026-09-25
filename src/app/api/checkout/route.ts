import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRepository, getDealerRepository } from '@/lib/db/repositories';
import { getFleecaPaymentProvider } from '@/lib/integrations/fleeca';
import { getServerSession } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(req);
    const body = await req.json().catch(() => ({}));
    const requestedPackage = body.packageCode || 'STANDARD_7_DAY';

    // Do not trust raw profileId submitted from browser; resolve from signed session
    const activeProfileId = session?.profileId || body.profileId;

    if (!activeProfileId) {
      return NextResponse.json(
        { error: 'Karakter profili zorunludur. Lütfen aktif bir karakter seçiniz.' },
        { status: 400 }
      );
    }

    let chargeProfileId = activeProfileId;

    // Corporate package validation & eligibility resolution (Section 1 & 4)
    if (requestedPackage === 'CORPORATE_14_DAY') {
      const { resolveCorporateEligibility } = await import('@/lib/dealers/eligibility');
      const eligibility = await resolveCorporateEligibility(activeProfileId);
      if (!eligibility.eligible || !eligibility.dealer) {
        return NextResponse.json(
          {
            error: eligibility.message || 'Kurumsal ilan kredisi ($1.750) satın alma şartlarını sağlamıyorsunuz.',
            reason: eligibility.reason,
          },
          { status: 403 }
        );
      }
      chargeProfileId = eligibility.dealer.owner_profile_id || activeProfileId;
    }

    // Backend determines price from packageCode strictly via payment repository
    const repo = getPaymentRepository();
    const order = await repo.createPaymentOrder(chargeProfileId, requestedPackage);

    // Also notify Fleeca provider
    const fleeca = getFleecaPaymentProvider();
    await fleeca.createOrder({
      orderId: order.orderId,
      profileId: chargeProfileId,
      characterName: 'Kullanıcı',
      packageCode: requestedPackage,
      amount: order.amount,
    });

    return NextResponse.json({
      orderId: order.orderId,
      amount: order.amount,
      packageName: order.packageName || (requestedPackage === 'CORPORATE_14_DAY' ? '14 Günlük Kurumsal İlan' : '7 Günlük Standart İlan'),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Sipariş oluşturulamadı.' },
      { status: 500 }
    );
  }
}

// Process / simulate payment endpoint
export async function PUT(req: NextRequest) {
  try {
    const { orderId, simulateSuccess } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId zorunludur.' },
        { status: 400 }
      );
    }

    const fleeca = getFleecaPaymentProvider();
    const result = await fleeca.processPayment(orderId, simulateSuccess);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Ödeme başarısız oldu.' },
        { status: 400 }
      );
    }

    // Mark as completed in database and issue listing credit via repository
    const repo = getPaymentRepository();
    const completion = await repo.completePayment(orderId, result.transactionId);

    if (!completion.success) {
      return NextResponse.json(
        { success: false, error: completion.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      credit: completion.credit,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Ödeme işlenemedi.' },
      { status: 500 }
    );
  }
}
