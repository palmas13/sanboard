import { GtaWorldAuthResult, GtaWorldCharacter, GtaWorldUserSession } from './types';

export interface GtaWorldAuthProvider {
  login(): Promise<GtaWorldAuthResult>;
  getCharacters(userId: string): Promise<GtaWorldCharacter[]>;
  verifySession(token: string): Promise<GtaWorldUserSession | null>;
}
