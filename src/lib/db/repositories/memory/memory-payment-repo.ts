import { IPaymentRepository } from '../types';
import { db } from '../../store';
import {
  createCheckoutOrder,
  completePaymentOrder,
} from '../../payments';
import { normalizeFleecaPayerName, normalizeFleecaRouting } from '@/lib/payments/payer-identity';
import type { PayerIdentityFailureCode, PayerIdentityStatus } from '@/types';

export class MemoryPaymentRepository implements IPaymentRepository {
  async getUserCredits(profileId: string) {
    const credits = db.credits.filter((c) => c.profile_id === profileId);
    const available = credits.filter((c) => c.status === 'AVAILABLE' && c.used_at == null).length;
    return { available, total: credits.length, credits };
  }

  async createPaymentOrder(profileId: string, packageId: string, options?: { idempotencyKey?: string; corporateProfileId?: string | null; purpose?: import('@/lib/payments/pricing').PaymentPurpose; targetListingId?: string | null; expectedExternalCharacterId?: string; expectedCharacterName?: string }) {
    const res = await createCheckoutOrder(profileId, packageId, options);
    if (res.error) throw new Error(res.error);
    const payment = db.payments.find((item) => item.order_id === res.orderId);
    return { orderId: res.orderId, amount: res.amount, packageName: res.packageName, entitlementType: payment?.entitlement_type };
  }

  async verifyPayerIdentityAndBind(orderId: string, payerName: string | null, payerRouting: string | null): Promise<{ success: boolean; status: PayerIdentityStatus; failureCode?: PayerIdentityFailureCode }> {
    const payment = db.payments.find((item) => item.order_id === orderId);
    if (!payment) return { success: false, status: 'FAILED', failureCode: 'PAYER_VERIFICATION_FAILED' };
    if (!payment.expected_external_character_id && !payment.expected_character_name) {
      return { success: true, status: 'VERIFIED' };
    }

    const reject = (status: PayerIdentityStatus, failureCode: PayerIdentityFailureCode) => {
      payment.payer_identity_status = status;
      payment.payer_identity_failure_code = failureCode;
      payment.payer_identity_verified_at = null;
      return { success: false, status, failureCode };
    };

    if (!payment.expected_external_character_id || !payment.expected_character_name) {
      return reject('UNAVAILABLE', 'PAYER_IDENTITY_UNAVAILABLE');
    }
    if (!payerName || !payerName.trim()) return reject('UNAVAILABLE', 'PAYER_NAME_MISSING');
    if (payerRouting === null || payerRouting === undefined || !String(payerRouting).trim()) {
      return reject('UNAVAILABLE', 'PAYER_ROUTING_MISSING');
    }
    const routing = normalizeFleecaRouting(payerRouting);
    if (!routing) return reject('FAILED', 'PAYER_ROUTING_INVALID');
    if (normalizeFleecaPayerName(payerName) !== normalizeFleecaPayerName(payment.expected_character_name)) {
      return reject('MISMATCH', 'PAYER_NAME_MISMATCH');
    }
    const conflict = db.characterFleecaAccounts.find(
      (account) => account.payer_routing === routing && account.verification_status === 'VERIFIED' && account.profile_id !== payment.profile_id
    );
    if (conflict) return reject('MISMATCH', 'PAYER_ROUTING_CONFLICT');

    const now = new Date().toISOString();
    let mapping = db.characterFleecaAccounts.find(
      (account) => account.payer_routing === routing && account.verification_status === 'VERIFIED'
    );
    if (!mapping) {
      mapping = {
        id: `fleeca-${crypto.randomUUID()}`,
        profile_id: payment.profile_id,
        payer_routing: routing,
        verification_status: 'VERIFIED',
        verified_payment_id: payment.id,
        verified_at: now,
        created_at: now,
        updated_at: now,
      };
      db.characterFleecaAccounts.push(mapping);
    }
    payment.payer_identity_status = 'VERIFIED';
    payment.payer_identity_failure_code = null;
    payment.payer_identity_verified_at = now;
    return { success: true, status: 'VERIFIED' };
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
    if (!payment || payment.purpose !== 'LISTING_BOOST') return { success: false, error: 'Boost kredisi ödemesi bulunamadı.' };
    if (payment.entitlement_applied_at) {
      const dealer = db.dealers.find((item) => item.id === payment.corporate_profile_id && (item.owner_profile_id || item.profile_id) === payment.profile_id);
      return { success: true, purchasedBoostCredits: dealer?.purchased_boost_credits || 0 };
    }
    const dealer = db.dealers.find((item) => item.id === payment.corporate_profile_id && (item.owner_profile_id || item.profile_id) === payment.profile_id);
    if (!dealer || dealer.status !== 'APPROVED' || dealer.moderation_status !== 'ACTIVE') return { success: false, error: 'Boost kredisi kurumsal mağazaya tanımlanamadı.' };
    const now = new Date().toISOString();
    dealer.purchased_boost_credits = (dealer.purchased_boost_credits || 0) + 1;
    dealer.boost_credits = (dealer.monthly_boost_credits || 0) + dealer.purchased_boost_credits;
    dealer.updated_at = now;
    payment.status = 'SUCCESS'; payment.paid_at = now; payment.entitlement_applied_at = now; payment.processed_at = now;
    return { success: true, purchasedBoostCredits: dealer.purchased_boost_credits };
  }

  async getUserPayments(profileId: string) {
    const clearedAt = db.profiles.find((profile) => profile.id === profileId)?.payment_history_cleared_at;
    return db.payments
      .filter((p) => p.profile_id === profileId && (!clearedAt || new Date(p.created_at) > new Date(clearedAt)))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(({ id, order_id, package_id, amount, status, entitlement_type, purpose, created_at }) => {
        const paymentPackage = db.packages.find((item) => item.id === package_id);
        return {
          id,
          order_id,
          amount,
          status,
          entitlement_type,
          purpose,
          package_code: paymentPackage?.code || null,
          package_name: paymentPackage?.name || null,
          created_at,
        };
      });
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
