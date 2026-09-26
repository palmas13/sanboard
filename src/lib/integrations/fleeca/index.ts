import { FleecaPaymentProvider } from './provider';
import { MockFleecaPaymentProvider } from './mock-provider';
import { RealFleecaPaymentProvider } from './real-provider';

export * from './types';
export * from './provider';
export * from './mock-provider';
export * from './real-provider';

export function getFleecaPaymentProvider(): FleecaPaymentProvider {
  const explicitMock = process.env.USE_MOCK_FLEECA === 'true';
  const localDevelopmentMock = process.env.USE_MOCK_FLEECA === undefined
    && process.env.DATA_STORE !== 'supabase'
    && process.env.NODE_ENV !== 'production';
  const useMock = explicitMock || localDevelopmentMock;
  if (useMock) {
    return new MockFleecaPaymentProvider();
  }
  return new RealFleecaPaymentProvider();
}
