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

  async createPaymentOrder(profileId: string, packageId: string, options?: { idempotencyKey?: string; corporateProfileId?: string | null }) {
    const res = await createCheckoutOrder(profileId, packageId, options);
    if (res.error) throw new Error(res.error);
    return { orderId: res.orderId, amount: res.amount, packageName: res.packageName };
  }

  async completePayment(orderId: string, externalPaymentId?: string) {
    const res = await completePaymentOrder(orderId, externalPaymentId);
    return { success: res.success, credit: res.credit, error: res.error };
  }

  async getUserPayments(profileId: string) {
    return db.payments
      .filter((p) => p.profile_id === profileId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(({ id, order_id, amount, status, created_at }) => ({
        id,
        order_id,
        amount,
        status,
        created_at,
      }));
  }

  async getPaymentOrder(orderId: string) {
    return db.payments.find((payment) => payment.order_id === orderId) || null;
  }
}
