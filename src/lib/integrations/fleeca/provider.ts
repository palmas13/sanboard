import { CreateCheckoutParams, FleecaOrder, FleecaPaymentResult } from './types';

export interface FleecaPaymentProvider {
  createOrder(params: CreateCheckoutParams): Promise<FleecaOrder>;
  getOrder(orderId: string): Promise<FleecaOrder | null>;
  processPayment(orderId: string, simulateSuccess?: boolean): Promise<FleecaPaymentResult>;
}
