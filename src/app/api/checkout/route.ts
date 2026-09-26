import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRepository, getDealerRepository } from '@/lib/db/repositories';
import {
  FleecaProviderNotConfiguredError,
  getFleecaPaymentProvider,
  validateExternalPayment,
} from '@/lib/integrations/fleeca';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const orderId = new URL(req.url).searchParams.get('orderId');
    if (!orderId) return NextResponse.json({ error: 'orderId zorunludur.' }, { status: 400 });
    const payment = await getPaymentRepository().getPaymentOrder(orderId);
    if (!payment) return NextResponse.json({ error: 'Ödeme kaydı bulunamadı.' }, { status: 404 });
    if (payment.profile_id !== actor.profileId) {
      return NextResponse.json({ error: 'Bu ödeme siparişini görüntüleme yetkiniz yok.' }, { status: 403 });
    }
    return NextResponse.json({
      orderId: payment.order_id,
      amount: payment.amount,
      status: payment.status,
      entitlementType: payment.entitlement_type || 'LISTING_CREDIT',
      packageName: payment.entitlement_type === 'CORPORATE_SUBSCRIPTION'
        ? '30 Günlük Kurumsal Üyelik'
        : payment.corporate_profile_id
          ? '14 Günlük Kurumsal İlan'
          : '7 Günlük Standart İlan',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Sipariş bilgisi alınamadı.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    const body = await req.json().catch(() => ({}));
    const requestedPackage = body.packageCode || 'STANDARD_7_DAY';
    const idempotencyKey = req.headers.get('idempotency-key') || body.idempotencyKey;

    // Do not trust raw profileId submitted from browser; resolve from signed session
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const activeProfileId = actor.profileId;

    let chargeProfileId = activeProfileId;
    let corporateProfileId: string | null = null;

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
      corporateProfileId = eligibility.dealer.id;
    } else if (requestedPackage === 'CORPORATE_SUBSCRIPTION_30_DAY') {
      const dealerRepo = getDealerRepository();
      const dealer = await dealerRepo.getDealerByProfileId(activeProfileId, true);
      if (!dealer || (dealer.owner_profile_id || dealer.profile_id) !== activeProfileId) {
        return NextResponse.json({ error: 'Kurumsal mağaza bulunamadı.' }, { status: 403 });
      }
      if (dealer.status !== 'APPROVED' || dealer.moderation_status === 'DELETED') {
        return NextResponse.json({ error: 'Bu mağaza için üyelik satın alınamaz.' }, { status: 403 });
      }
      corporateProfileId = dealer.id;
    }

    // Backend determines price from packageCode strictly via payment repository
    const repo = getPaymentRepository();
    const order = await repo.createPaymentOrder(chargeProfileId, requestedPackage, {
      idempotencyKey,
      corporateProfileId,
    });

    // Also notify Fleeca provider
    const fleeca = getFleecaPaymentProvider();
    await fleeca.createOrder({
      orderId: order.orderId,
      profileId: chargeProfileId,
      characterName: 'Kullanıcı',
      packageCode: requestedPackage,
      amount: order.amount,
      currency: 'GTA_DOLLAR',
    });

    return NextResponse.json({
      orderId: order.orderId,
      amount: order.amount,
      packageName: order.packageName || (requestedPackage === 'CORPORATE_14_DAY' ? '14 Günlük Kurumsal İlan' : '7 Günlük Standart İlan'),
      entitlementType: order.entitlementType,
    });
  } catch (error: any) {
    if (error instanceof FleecaProviderNotConfiguredError) {
      return NextResponse.json(
        { error: 'Fleeca ödeme sağlayıcısı henüz kullanıma hazır değil.', code: 'provider_not_configured' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: error?.message || 'Sipariş oluşturulamadı.' },
      { status: 500 }
    );
  }
}

// Server-side provider verification endpoint. Browser fields never prove payment.
export async function PUT(req: NextRequest) {
  try {
    const actor = await resolveOwnedActiveProfile(req);
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId zorunludur.' },
        { status: 400 }
      );
    }

    const repo = getPaymentRepository();
    const payment = await repo.getPaymentOrder(orderId);
    if (!payment) return NextResponse.json({ error: 'Ödeme kaydı bulunamadı.' }, { status: 404 });
    if (payment.profile_id !== actor.profileId) {
      return NextResponse.json({ error: 'Bu ödeme siparişini tamamlama yetkiniz yok.' }, { status: 403 });
    }

    const fleeca = getFleecaPaymentProvider();
    const transaction = await fleeca.verifyPayment(orderId);
    const verification = validateExternalPayment(transaction, {
      orderReference: payment.order_id,
      payerReference: payment.profile_id,
      amount: payment.amount,
      currency: 'GTA_DOLLAR',
      purposeReference: requestedPackageCode(payment),
    });

    if (!verification.verified) {
      return NextResponse.json(
        { success: false, error: 'Ödeme sağlayıcı tarafından doğrulanamadı.', reason: verification.reason },
        { status: 400 }
      );
    }

    // Mark as completed in database and issue listing credit via repository
    const completion = await repo.completePayment(orderId, verification.transaction.externalTransactionId);

    if (!completion.success) {
      return NextResponse.json(
        { success: false, error: completion.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transactionId: verification.transaction.externalTransactionId,
      credit: completion.credit,
      entitlementType: payment.entitlement_type || 'LISTING_CREDIT',
    });
  } catch (error: any) {
    if (error instanceof FleecaProviderNotConfiguredError) {
      return NextResponse.json(
        { success: false, error: 'Fleeca ödeme doğrulaması henüz kullanıma hazır değil.', code: 'provider_not_configured' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: error?.message || 'Ödeme işlenemedi.' },
      { status: 500 }
    );
  }
}

function requestedPackageCode(payment: any): string {
  if (payment.entitlement_type === 'CORPORATE_SUBSCRIPTION') return 'CORPORATE_SUBSCRIPTION_30_DAY';
  return payment.corporate_profile_id ? 'CORPORATE_14_DAY' : 'STANDARD_7_DAY';
}
