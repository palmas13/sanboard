import { FleecaPaymentProvider } from './provider';
import { CreateCheckoutParams, FleecaOrder, FleecaPaymentResult } from './types';

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
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    mockOrdersMap.set(params.orderId, order);
    return order;
  }

  async getOrder(orderId: string): Promise<FleecaOrder | null> {
    return mockOrdersMap.get(orderId) || null;
  }

  async processPayment(
    orderId: string,
    simulateSuccess = true
  ): Promise<FleecaPaymentResult> {
    const order = mockOrdersMap.get(orderId);
    if (!order) {
      return {
        success: false,
        orderId,
        error: 'Sipariş bulunamadı.',
      };
    }

    if (!simulateSuccess) {
      order.status = 'FAILED';
      return {
        success: false,
        orderId,
        error: 'Fleeca hesabında yetersiz bakiye veya işlem reddedildi.',
      };
    }

    if (order.status === 'SUCCESS') {
      return {
        success: true,
        orderId,
        transactionId: `FLC-TX-${orderId}`,
      };
    }

    order.status = 'SUCCESS';
    return {
      success: true,
      orderId,
      transactionId: `FLC-TX-${orderId}`,
    };
  }
}
