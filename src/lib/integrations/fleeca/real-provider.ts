import { FleecaPaymentProvider } from './provider';
import { CreateCheckoutParams, FleecaOrder, VerifiedExternalPayment } from './types';

export const FLEECA_PROVIDER_NOT_CONFIGURED = 'FLEECA_PROVIDER_NOT_CONFIGURED';

export class FleecaProviderNotConfiguredError extends Error {
  readonly code = FLEECA_PROVIDER_NOT_CONFIGURED;

  constructor() {
    super('Fleeca ödeme sağlayıcısı henüz yapılandırılmadı.');
    this.name = 'FleecaProviderNotConfiguredError';
  }
}

/**
 * Real Fleeca Bank API payment provider placeholder.
 * 
 * TODO: Implement Fleeca real payment provider after official Fleeca API documentation and merchant keys are approved.
 * Do not guess endpoints, merchant tokens, secrets, or webhook URLs.
 */
export class RealFleecaPaymentProvider implements FleecaPaymentProvider {
  async createOrder(_params: CreateCheckoutParams): Promise<FleecaOrder> {
    throw new FleecaProviderNotConfiguredError();
  }

  async getOrder(_orderId: string): Promise<FleecaOrder | null> {
    throw new FleecaProviderNotConfiguredError();
  }

  async verifyPayment(_orderId: string): Promise<VerifiedExternalPayment> {
    throw new FleecaProviderNotConfiguredError();
  }
}
