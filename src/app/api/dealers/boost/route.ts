import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { getDealerRepository, getPaymentRepository } from '@/lib/db/repositories';
import { revalidatePath } from 'next/cache';
import { canBypassTestPayment } from '@/lib/auth/test-login';
import { recordAuditEvent } from '@/lib/audit';
import { assertBoostAuthorization } from '@/lib/payments/verification';
import { getFleecaPaymentProvider } from '@/lib/integrations/fleeca';
import { setPaymentCorrelationCookie } from '@/lib/payments/correlation';

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

    const testPaymentBypass = await canBypassTestPayment({ userId: actor.userId, profile: actor.profile });
    if (!testPaymentBypass) {
      await assertBoostAuthorization(actor.profileId, actor.userId, listingId);
      const paymentRepo = getPaymentRepository();
      const order = await paymentRepo.createPaymentOrder(actor.profileId, 'LISTING_BOOST_24_HOUR', {
        idempotencyKey: req.headers.get('idempotency-key') || `boost:${listingId}:${crypto.randomUUID()}`,
        purpose: 'LISTING_BOOST', targetListingId: listingId,
      });
      const providerOrder = await getFleecaPaymentProvider().createOrder({
        orderId: order.orderId, profileId: actor.profileId, characterName: actor.profile.full_name,
        packageCode: 'LISTING_BOOST_24_HOUR', amount: order.amount, currency: 'USD',
        description: `Sanboard Listing Boost - SBB-${order.orderId.slice(-8)}`,
      });
      if (!providerOrder.paymentId || !providerOrder.paymentLink) throw new Error('Fleeca hosted payment bilgileri eksik.');
      await paymentRepo.attachProviderPayment(order.orderId, providerOrder.paymentId);
      const response = NextResponse.json({ success: true, orderId: order.orderId, paymentLink: providerOrder.paymentLink, paymentRequired: true });
      setPaymentCorrelationCookie(response, order.orderId);
      return response;
    }

    const result = await dealerRepo.boostListing(actor.profileId, listingId, undefined, { paymentMode: 'TEST_BYPASS' });
    if (!result.success) {
      const status = result.code === 'LISTING_NOT_OWNED' ? 403 : 400;
      return NextResponse.json({ error: result.error || 'İlan öne çıkarılamadı.', code: result.code }, { status });
    }

    if (testPaymentBypass) {
      await recordAuditEvent({
        eventType: 'TEST_FEATURED_PAYMENT_BYPASS',
        userId: actor.userId,
        profileId: actor.profileId,
        metadata: { listingId, charged: false, featuredUntil: result.featured_until },
      });
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
    const message = error?.message || 'Öne çıkarma işlemi gerçekleştirilemedi.';
    if (/yetkiniz yok|yetkilendirmesi geçersiz|ait değil|Production boost/.test(message)) {
      return NextResponse.json({ error: message, code: 'LISTING_NOT_OWNED' }, { status: 403 });
    }
    if (/aktif|zaten/.test(message)) {
      return NextResponse.json({ error: message, code: 'LISTING_NOT_ELIGIBLE' }, { status: 400 });
    }
    console.error('Boost route failed', { message });
    return NextResponse.json({ error: 'Öne çıkarma işlemi gerçekleştirilemedi.', code: 'BOOST_INTERNAL_ERROR' }, { status: 500 });
  }
}
