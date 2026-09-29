import { IPaymentRepository } from '../types';
import { db } from '../../store';
import {
  createCheckoutOrder,
  completePaymentOrder,
} from '../../payments';

export class MemoryPaymentRepository implements IPaymentRepository {
  async getUserCredits(profileId: string) {
    const credits = db.credits.filter((c) => c.profile_id === profileId);
    const available = credits.filter((c) => c.status === 'AVAILABLE').length;
    return { available, total: credits.length, credits };
  }

  async createPaymentOrder(profileId: string, packageId: string, options?: { idempotencyKey?: string; corporateProfileId?: string | null; purpose?: import('@/lib/payments/pricing').PaymentPurpose; targetListingId?: string | null }) {
    const res = await createCheckoutOrder(profileId, packageId, options);
    if (res.error) throw new Error(res.error);
    return { orderId: res.orderId, amount: res.amount, packageName: res.packageName };
  }

  async attachProviderPayment(orderId: string, providerPaymentId: string) {
    const payment = db.payments.find((item) => item.order_id === orderId);
    if (!payment) throw new Error('Ödeme kaydı bulunamadı.');
    const duplicate = db.payments.find((item) => item.id !== payment.id && item.external_payment_id === providerPaymentId);
    if (duplicate) throw new Error('Fleeca ödeme kimliği başka bir siparişe bağlı.');
    if (payment.external_payment_id && payment.external_payment_id !== providerPaymentId) throw new Error('Sipariş farklı bir Fleeca ödemesine bağlı.');
    payment.external_payment_id = providerPaymentId;
  }

  async completePayment(orderId: string, externalPaymentId?: string) {
    const res = await completePaymentOrder(orderId, externalPaymentId);
    return { success: res.success, credit: res.credit, error: res.error };
  }

  async failPayment(orderId: string, externalPaymentId: string) {
    const payment = db.payments.find((item) => item.order_id === orderId);
    if (!payment || payment.external_payment_id !== externalPaymentId) return { success: false, error: 'Ödeme kaydı bulunamadı.' };
    if (payment.status === 'FAILED') return { success: true };
    if (payment.status !== 'PENDING' || payment.entitlement_applied_at) return { success: false, error: 'Ödeme terminal başarısız duruma geçirilemedi.' };
    payment.status = 'FAILED';
    payment.processed_at = new Date().toISOString();
    return { success: true };
  }

  async completeBoostPayment(orderId: string) {
    const payment = db.payments.find((item) => item.order_id === orderId);
    if (!payment || payment.purpose !== 'LISTING_BOOST' || !payment.target_listing_id) return { success: false, error: 'Boost ödemesi bulunamadı.' };
    if (payment.entitlement_applied_at) {
      const listing = db.listings.find((item) => item.id === payment.target_listing_id);
      return { success: true, featured_until: listing?.featured_until || undefined };
    }
    const { boostListing } = await import('../../dealers');
    const result = await boostListing(payment.profile_id, payment.target_listing_id);
    if (!result.success) return { success: false, error: result.error };
    const now = new Date().toISOString();
    payment.status = 'SUCCESS'; payment.paid_at = now; payment.entitlement_applied_at = now; payment.processed_at = now;
    return { success: true, featured_until: result.featured_until };
  }

  async getUserPayments(profileId: string) {
    const clearedAt = db.profiles.find((profile) => profile.id === profileId)?.payment_history_cleared_at;
    return db.payments
      .filter((p) => p.profile_id === profileId && (!clearedAt || new Date(p.created_at) > new Date(clearedAt)))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(({ id, order_id, amount, status, created_at }) => ({
        id,
        order_id,
        amount,
        status,
        created_at,
      }));
  }

  async clearUserPaymentHistory(profileId: string) {
    const profile = db.profiles.find((item) => item.id === profileId);
    if (!profile) return { success: false, error: 'Profil bulunamadı.' };
    const clearedAt = new Date().toISOString();
    profile.payment_history_cleared_at = clearedAt;
    profile.updated_at = clearedAt;
    return { success: true, clearedAt };
  }

  async getPaymentOrder(orderId: string) {
    return db.payments.find((payment) => payment.order_id === orderId) || null;
  }

  async getPaymentByExternalPaymentId(externalPaymentId: string) {
    return db.payments.find((payment) => payment.external_payment_id === externalPaymentId) || null;
  }
}
