import { FleecaPaymentProvider } from './provider';
import { MockFleecaPaymentProvider } from './mock-provider';
import { RealFleecaPaymentProvider } from './real-provider';

export * from './types';
export * from './provider';
export * from './mock-provider';
export * from './real-provider';

export function getFleecaPaymentProvider(): FleecaPaymentProvider {
  return new RealFleecaPaymentProvider();
}

/** Explicit test-only boundary. Normal checkout must never call this selector. */
export function getTestFleecaPaymentProvider(): FleecaPaymentProvider {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_TEST_PAYMENTS !== 'true') {
    throw new Error('Test Fleeca provider is disabled.');
  }
  return new MockFleecaPaymentProvider();
}
