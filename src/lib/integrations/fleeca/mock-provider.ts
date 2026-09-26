import { FleecaPaymentProvider } from './provider';
import { CreateCheckoutParams, FleecaOrder, VerifiedExternalPayment } from './types';

// Global cache for mock orders during runtime
const mockOrdersMap = new Map<string, FleecaOrder>();

export class MockFleecaPaymentProvider implements FleecaPaymentProvider {
  async createOrder(params: CreateCheckoutParams): Promise<FleecaOrder> {
    const existing = mockOrdersMap.get(params.orderId);
    if (existing) {
      if (existing.profileId !== params.profileId || existing.packageCode !== params.packageCode || existing.amount !== params.amount) {
        throw new Error('Aynı sipariş kimliği farklı ödeme bilgileriyle kullanılamaz.');
      }
      return existing;
    }
    const order: FleecaOrder = {
      orderId: params.orderId,
      profileId: params.profileId,
      characterName: params.characterName,
      packageCode: params.packageCode,
      packageName: '7 Günlük Standart İlan',
      amount: params.amount,
      currency: params.currency,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    mockOrdersMap.set(params.orderId, order);
    return order;
  }

  async getOrder(orderId: string): Promise<FleecaOrder | null> {
    return mockOrdersMap.get(orderId) || null;
  }

  async verifyPayment(
    orderId: string,
    simulateSuccess = true
  ): Promise<VerifiedExternalPayment> {
    const order = mockOrdersMap.get(orderId);
    if (!order) {
      throw new Error('Sipariş bulunamadı.');
    }

    if (!simulateSuccess) {
      order.status = 'FAILED';
      return {
        externalTransactionId: `FLC-TX-${orderId}`,
        status: 'FAILED',
        orderReference: orderId,
        payerReference: order.profileId,
        amount: order.amount,
        currency: order.currency,
        purposeReference: order.packageCode,
        occurredAt: new Date().toISOString(),
      };
    }

    order.status = 'SUCCESS';
    return {
      externalTransactionId: `FLC-TX-${orderId}`,
      status: 'VERIFIED',
      orderReference: orderId,
      payerReference: order.profileId,
      amount: order.amount,
      currency: order.currency,
      purposeReference: order.packageCode,
      occurredAt: new Date().toISOString(),
    };
  }
}
