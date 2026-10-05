import { NextRequest, NextResponse } from 'next/server';
import { getPaymentRepository, getDealerRepository, getUserRepository } from '@/lib/db/repositories';
import {
  FleecaProviderNotConfiguredError,
  getFleecaPaymentProvider,
} from '@/lib/integrations/fleeca';
import { canRenewCorporateSubscription } from '@/lib/subscriptions/calendar-month';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { setPaymentCorrelationCookie } from '@/lib/payments/correlation';
import { getPaymentDescription, isPaymentPackageCode, type PaymentPurpose } from '@/lib/payments/pricing';
import { verifyAndFulfillPayment } from '@/lib/payments/verification';

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
    if (!isPaymentPackageCode(requestedPackage) || requestedPackage === 'LISTING_BOOST_24_HOUR') {
      return NextResponse.json({ error: 'Geçersiz ödeme paketi.' }, { status: 400 });
    }
    const idempotencyKey = req.headers.get('idempotency-key') || body.idempotencyKey;

    // Do not trust raw profileId submitted from browser; resolve from signed session
    if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
    const activeProfileId = actor.profileId;

    let chargeProfileId = activeProfileId;
    let corporateProfileId: string | null = null;
    let purpose: PaymentPurpose = 'LISTING_PUBLICATION';

    if (requestedPackage === 'STANDARD_7_DAY') {
      const creditResult = await getPaymentRepository().getUserCredits(activeProfileId);
      const hasIndividualCredit = (creditResult.credits || []).some(
        (credit: any) => credit.status === 'AVAILABLE' && credit.used_at == null && (credit.credit_type === 'INDIVIDUAL' || !credit.credit_type)
      );
      if (hasIndividualCredit) {
        return NextResponse.json(
          { error: 'Kullanılabilir bireysel ilan hakkınız bulunuyor.', code: 'ENTITLEMENT_AVAILABLE' },
          { status: 409 }
        );
      }
    }

    // Corporate package validation & eligibility resolution (Section 1 & 4)
    if (requestedPackage === 'CORPORATE_14_DAY') {
      const { resolveCorporateEligibility } = await import('@/lib/dealers/eligibility');
      const eligibility = await resolveCorporateEligibility(activeProfileId);
      if (!eligibility.eligible || !eligibility.dealer) {
        return NextResponse.json(
          {
            error: eligibility.message || 'Kurumsal ilan hakkı satın alma şartlarını sağlamıyorsunuz.',
            reason: eligibility.reason,
          },
          { status: 403 }
        );
      }
      chargeProfileId = eligibility.dealer.owner_profile_id || activeProfileId;
      corporateProfileId = eligibility.dealer.id;
      const creditResult = await getPaymentRepository().getUserCredits(chargeProfileId);
      const hasCorporateCredit = (creditResult.credits || []).some(
        (credit: any) => credit.status === 'AVAILABLE'
          && credit.used_at == null
          && credit.credit_type === 'CORPORATE'
          && credit.corporate_profile_id === corporateProfileId
      );
      if (hasCorporateCredit) {
        return NextResponse.json(
          { error: 'Kullanılabilir kurumsal ilan hakkınız bulunuyor.', code: 'ENTITLEMENT_AVAILABLE' },
          { status: 409 }
        );
      }
    } else if (requestedPackage === 'CORPORATE_SUBSCRIPTION_30_DAY' || requestedPackage === 'CORPORATE_PLUS_30_DAY') {
      purpose = 'CORPORATE_SUBSCRIPTION';
      const dealerRepo = getDealerRepository();
      const dealer = await dealerRepo.getDealerByProfileId(activeProfileId, true);
      if (!dealer || (dealer.owner_profile_id || dealer.profile_id) !== activeProfileId) {
        return NextResponse.json({ error: 'Kurumsal mağaza bulunamadı.' }, { status: 403 });
      }
      if (dealer.status !== 'APPROVED' || dealer.moderation_status === 'DELETED') {
        return NextResponse.json({ error: 'Bu mağaza için üyelik satın alınamaz.' }, { status: 403 });
      }
      if (!canRenewCorporateSubscription(dealer.subscription_status, dealer.subscription_expires_at)) {
        return NextResponse.json({ error: 'Üyelik yalnızca bitiş tarihine 7 gün veya daha az kaldığında yenilenebilir.' }, { status: 409 });
      }
      const activeUnexpired = dealer.subscription_status === 'ACTIVE'
        && Boolean(dealer.subscription_expires_at)
        && new Date(dealer.subscription_expires_at!).getTime() > Date.now();
      const activePackageCode = dealer.active_package_code || 'CORPORATE_SUBSCRIPTION_30_DAY';
      if (activeUnexpired && activePackageCode !== requestedPackage) {
        return NextResponse.json({ error: 'Aktif üyelik yalnızca aynı paketle yenilenebilir.' }, { status: 409 });
      }
      corporateProfileId = dealer.id;
    }

    // Backend determines price from packageCode strictly via payment repository
    const repo = getPaymentRepository();
    const expectedPayerProfile = chargeProfileId === actor.profileId
      ? actor.profile
      : await getUserRepository().getCanonicalProfileById(chargeProfileId);
    if (!expectedPayerProfile?.external_character_id || !expectedPayerProfile.full_name.trim()) {
      return NextResponse.json({ error: 'Ödeme karakteri kimliği doğrulanamadı.' }, { status: 409 });
    }
    const order = await repo.createPaymentOrder(chargeProfileId, requestedPackage, {
      idempotencyKey,
      corporateProfileId,
      purpose,
      expectedExternalCharacterId: expectedPayerProfile.external_character_id,
      expectedCharacterName: expectedPayerProfile.full_name,
    });

    // Also notify Fleeca provider
    const fleeca = getFleecaPaymentProvider();
    const providerOrder = await fleeca.createOrder({
      orderId: order.orderId,
      profileId: chargeProfileId,
      characterName: expectedPayerProfile.full_name,
      packageCode: requestedPackage,
      amount: order.amount,
      currency: 'USD',
      description: getPaymentDescription(requestedPackage),
    });
    if (!providerOrder.paymentId || !providerOrder.paymentLink) throw new Error('Fleeca hosted payment bilgileri eksik.');
    await repo.attachProviderPayment(order.orderId, providerOrder.paymentId);

    const response = NextResponse.json({
      orderId: order.orderId,
      amount: order.amount,
      paymentLink: providerOrder.paymentLink,
      packageName: order.packageName || (requestedPackage === 'CORPORATE_14_DAY' ? '14 Günlük Kurumsal İlan' : '7 Günlük Standart İlan'),
      entitlementType: order.entitlementType,
    });
    setPaymentCorrelationCookie(response, order.orderId);
    return response;
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

    const result = await verifyAndFulfillPayment(payment);
    return NextResponse.json({ success: result.state === 'SUCCESS', state: result.state, entitlementType: payment.entitlement_type || 'LISTING_CREDIT' }, { status: result.state === 'SUCCESS' ? 200 : 202 });
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
