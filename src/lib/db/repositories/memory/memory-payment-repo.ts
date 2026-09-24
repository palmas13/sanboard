import { IPaymentRepository } from '../types';
import { db } from '../../store';
import {
  createCheckoutOrder,
  completePaymentOrder,
  getAvailableCredits,
} from '../../payments';

export class MemoryPaymentRepository implements IPaymentRepository {
  async getUserCredits(profileId: string) {
    const credits = db.credits.filter((c) => c.profile_id === profileId);
    const available = credits.filter((c) => c.status === 'AVAILABLE').length;
    return { available, total: credits.length, credits };
  }

  async consumeCredit(profileId: string, listingId: string): Promise<boolean> {
    const available = await getAvailableCredits(profileId);
    if (!available || available.length === 0) return false;

    const credit = available[0];
    credit.status = 'USED';
    credit.used_listing_id = listingId;
    credit.used_at = new Date().toISOString();
    return true;
  }

  async createPaymentOrder(profileId: string, packageId: string) {
    const res = await createCheckoutOrder(profileId, packageId);
    return { orderId: res.orderId, amount: res.amount };
  }

  async completePayment(orderId: string, externalPaymentId?: string) {
    const res = await completePaymentOrder(orderId, externalPaymentId);
    return { success: res.success, credit: res.credit, error: res.error };
  }

  async getUserPayments(profileId: string) {
    return db.payments
      .filter((p) => p.profile_id === profileId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}
