import {
  GtaWorldAuthResult,
  GtaWorldCharacter,
  GtaWorldUserSession,
  GtaWorldApiUserResponse,
  OAuthStateSupportStatus,
} from './types';

export interface GtaWorldAuthProvider {
  readonly oauthStateSupport: OAuthStateSupportStatus;

  login(): Promise<GtaWorldAuthResult>;
  getCharacters(userId: string): Promise<GtaWorldCharacter[]>;
  verifySession(token: string): Promise<GtaWorldUserSession | null>;

  getAuthorizeUrl(state?: string): string;
  exchangeCodeForToken(code: string): Promise<string>;
  fetchUser(accessToken: string): Promise<GtaWorldApiUserResponse>;
}
