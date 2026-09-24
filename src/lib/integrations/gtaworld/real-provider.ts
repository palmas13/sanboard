import { GtaWorldAuthProvider } from './provider';
import { GtaWorldAuthResult, GtaWorldCharacter, GtaWorldUserSession } from './types';

/**
 * Real GTA World UCP OAuth Provider placeholder.
 * 
 * TODO: Connect GTA World OAuth when official credentials and API documentation are available.
 * Do not guess endpoints, client IDs, secrets, or callback URLs.
 */
export class RealGtaWorldAuthProvider implements GtaWorldAuthProvider {
  async login(): Promise<GtaWorldAuthResult> {
    throw new Error(
      'Real GTA World OAuth is not configured yet. Set USE_MOCK_GTAWORLD_AUTH=true for local development.'
    );
  }

  async getCharacters(_userId: string): Promise<GtaWorldCharacter[]> {
    throw new Error('Real GTA World API is not configured yet.');
  }

  async verifySession(_token: string): Promise<GtaWorldUserSession | null> {
    throw new Error('Real GTA World API is not configured yet.');
  }
}
