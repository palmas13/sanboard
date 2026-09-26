import { GtaWorldAuthProvider } from './provider';
import { ExternalGameAccount } from './types';

export const GTAWORLD_PROVIDER_NOT_CONFIGURED = 'GTAWORLD_PROVIDER_NOT_CONFIGURED';

export class GtaWorldProviderNotConfiguredError extends Error {
  readonly code = GTAWORLD_PROVIDER_NOT_CONFIGURED;

  constructor() {
    super('GTA World bağlantısı henüz yapılandırılmadı.');
    this.name = 'GtaWorldProviderNotConfiguredError';
  }
}

/**
 * Fail-closed production boundary. The official GTA World OAuth/API contract
 * is unavailable, so this class contains no guessed endpoint, scope, token,
 * callback, refresh, revocation, or raw payload behavior.
 */
export class RealGtaWorldAuthProvider implements GtaWorldAuthProvider {
  getAuthorizeUrl(_state: string): string {
    throw new GtaWorldProviderNotConfiguredError();
  }

  async exchangeCodeForToken(_code: string): Promise<string> {
    throw new GtaWorldProviderNotConfiguredError();
  }

  async fetchAccount(_accessToken: string): Promise<ExternalGameAccount> {
    throw new GtaWorldProviderNotConfiguredError();
  }
}