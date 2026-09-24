import { FleecaPaymentProvider } from './provider';
import { MockFleecaPaymentProvider } from './mock-provider';
import { RealFleecaPaymentProvider } from './real-provider';

export * from './types';
export * from './provider';
export * from './mock-provider';
export * from './real-provider';

export function getFleecaPaymentProvider(): FleecaPaymentProvider {
  const useMock = process.env.USE_MOCK_FLEECA !== 'false';
  if (useMock) {
    return new MockFleecaPaymentProvider();
  }
  return new RealFleecaPaymentProvider();
}
