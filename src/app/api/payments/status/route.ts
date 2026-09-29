import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnedActiveProfile } from '@/lib/auth/active-profile';
import { getPaymentRepository } from '@/lib/db/repositories';
import { getPaymentCorrelation } from '@/lib/payments/correlation';
import { verifyAndFulfillPayment } from '@/lib/payments/verification';

export async function GET(req: NextRequest) {
  const actor = await resolveOwnedActiveProfile(req);
  if (!actor.ok) return NextResponse.json({ error: actor.error }, { status: actor.status });
  const repo = getPaymentRepository();
  const paymentId = new URL(req.url).searchParams.get('payment_id');
  const orderId = getPaymentCorrelation(req);
  const payment = paymentId
    ? await repo.getPaymentByExternalPaymentId(paymentId)
    : orderId ? await repo.getPaymentOrder(orderId) : null;
  if (!payment || payment.profile_id !== actor.profileId) return NextResponse.json({ state: 'NOT_FOUND' }, { status: 404 });
  try {
    const result = await verifyAndFulfillPayment(payment);
    return NextResponse.json({ state: result.state, purpose: payment.purpose || (payment.entitlement_type === 'CORPORATE_SUBSCRIPTION' ? 'CORPORATE_SUBSCRIPTION' : 'LISTING_PUBLICATION'), targetListingId: payment.purpose === 'LISTING_BOOST' ? payment.target_listing_id : undefined });
  } catch {
    return NextResponse.json({ state: 'UNVERIFIED', purpose: payment.purpose || 'LISTING_PUBLICATION' });
  }
}