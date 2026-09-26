import { GtaWorldAuthProvider } from './provider';
import { RealGtaWorldAuthProvider } from './real-provider';

export * from './types';
export * from './provider';
export * from './mock-provider';
export * from './real-provider';

export function getGtaWorldAuthProvider(): GtaWorldAuthProvider {
  return new RealGtaWorldAuthProvider();
}
