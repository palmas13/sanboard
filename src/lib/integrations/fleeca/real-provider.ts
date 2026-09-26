import { FleecaPaymentProvider } from './provider';
import { CreateCheckoutParams, FleecaOrder, VerifiedExternalPayment } from './types';

/**
 * Real Fleeca Bank API payment provider placeholder.
 * 
 * TODO: Implement Fleeca real payment provider after official Fleeca API documentation and merchant keys are approved.
 * Do not guess endpoints, merchant tokens, secrets, or webhook URLs.
 */
export class RealFleecaPaymentProvider implements FleecaPaymentProvider {
  async createOrder(_params: CreateCheckoutParams): Promise<FleecaOrder> {
    throw new Error(
      'Real Fleeca Payment is not configured yet. Set USE_MOCK_FLEECA=true for local development.'
    );
  }

  async getOrder(_orderId: string): Promise<FleecaOrder | null> {
    throw new Error('Real Fleeca Payment API is not configured yet.');
  }

  async verifyPayment(_orderId: string, _simulateSuccess?: boolean): Promise<VerifiedExternalPayment> {
    throw new Error('Real Fleeca Payment API is not configured yet.');
  }
}
