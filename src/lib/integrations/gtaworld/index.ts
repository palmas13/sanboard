import { GtaWorldAuthProvider } from './provider';
import { MockGtaWorldAuthProvider } from './mock-provider';
import { RealGtaWorldAuthProvider } from './real-provider';

export * from './types';
export * from './provider';
export * from './mock-provider';
export * from './real-provider';

export function getGtaWorldAuthProvider(): GtaWorldAuthProvider {
  const useMock = process.env.USE_MOCK_GTAWORLD_AUTH !== 'false';
  if (useMock) {
    return new MockGtaWorldAuthProvider();
  }
  return new RealGtaWorldAuthProvider();
}
