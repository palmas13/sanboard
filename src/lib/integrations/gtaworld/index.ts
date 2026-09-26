import { GtaWorldAuthProvider } from './provider';
import { MockGtaWorldAuthProvider } from './mock-provider';
import { RealGtaWorldAuthProvider } from './real-provider';

export * from './types';
export * from './provider';
export * from './mock-provider';
export * from './real-provider';

export function isMockGtaWorldAuthEnabled(): boolean {
  return process.env.USE_MOCK_GTAWORLD_AUTH === 'true';
}

export function getGtaWorldAuthProvider(): GtaWorldAuthProvider {
  if (isMockGtaWorldAuthEnabled()) {
    return new MockGtaWorldAuthProvider();
  }
  return new RealGtaWorldAuthProvider();
}
