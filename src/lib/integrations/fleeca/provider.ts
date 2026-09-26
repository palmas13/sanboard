import { CreateCheckoutParams, FleecaOrder, VerifiedExternalPayment } from './types';

export interface FleecaPaymentProvider {
  createOrder(params: CreateCheckoutParams): Promise<FleecaOrder>;
  getOrder(orderId: string): Promise<FleecaOrder | null>;
  verifyPayment(orderId: string, simulateSuccess?: boolean): Promise<VerifiedExternalPayment>;
}
