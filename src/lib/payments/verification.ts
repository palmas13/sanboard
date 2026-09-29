import { getDealerRepository, getPaymentRepository } from '@/lib/db/repositories';
import { RealFleecaPaymentProvider } from '@/lib/integrations/fleeca/real-provider';

export type SafePaymentState = 'PENDING' | 'SUCCESS' | 'UNVERIFIED';

export async function verifyAndFulfillPayment(payment: any): Promise<{ state: SafePaymentState; featuredUntil?: string }> {
  if (payment.status === 'SUCCESS' && payment.entitlement_applied_at) return { state: 'SUCCESS' };
  if (!payment.external_payment_id) return { state: 'UNVERIFIED' };

  const details = await new RealFleecaPaymentProvider().getPaymentDetails(payment.external_payment_id);
  if (details.data.payment_id !== payment.external_payment_id) return { state: 'UNVERIFIED' };
  if (details.data.amount !== payment.amount) return { state: 'UNVERIFIED' };
  if (details.data.status === 'awaiting_payment') return { state: 'PENDING' };
  if (details.data.status !== 'payment_successful' || !details.data.paid_at) return { state: 'UNVERIFIED' };

  const repo = getPaymentRepository();
  if (payment.purpose === 'LISTING_BOOST') {
    const completion = await repo.completeBoostPayment(payment.order_id);
    if (!completion.success) return { state: 'UNVERIFIED' };
    return { state: 'SUCCESS', featuredUntil: completion.featured_until };
  }
  const completion = await repo.completePayment(payment.order_id, payment.external_payment_id);
  return { state: completion.success ? 'SUCCESS' : 'UNVERIFIED' };
}

export async function assertBoostAuthorization(profileId: string, userId: string, listingId: string): Promise<void> {
  const { getListingRepository } = await import('@/lib/db/repositories');
  const result = await getListingRepository().getListingById(listingId, profileId, userId);
  if (!result.listing || !result.isOwner) throw new Error('Bu ilanı öne çıkarma yetkiniz yok.');
  if (result.listing.status !== 'ACTIVE') throw new Error('Yalnızca aktif ilanlar öne çıkarılabilir.');
  if (result.listing.is_featured && result.listing.featured_until && new Date(result.listing.featured_until) > new Date()) {
    throw new Error('Bu ilan zaten aktif olarak öne çıkarılmış durumdadır.');
  }
  if (result.listing.seller_type !== 'CORPORATE') throw new Error('Production boost yalnız yetkili kurumsal ilanlarda kullanılabilir.');
  const dealer = await getDealerRepository().getDealerById(result.listing.corporate_profile_id!);
  if (!dealer || (dealer.owner_profile_id || dealer.profile_id) !== profileId) throw new Error('Kurumsal ilan yetkilendirmesi geçersiz.');
}