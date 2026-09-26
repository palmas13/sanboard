import {
  GtaWorldAuthResult,
  GtaWorldCharacter,
  GtaWorldUserSession,
  ExternalGameAccount,
  OAuthStateSupportStatus,
} from './types';

export interface GtaWorldAuthProvider {
  readonly oauthStateSupport: OAuthStateSupportStatus;

  login(): Promise<GtaWorldAuthResult>;
  getCharacters(userId: string): Promise<GtaWorldCharacter[]>;
  verifySession(token: string): Promise<GtaWorldUserSession | null>;

  getAuthorizeUrl(state?: string): string;
  exchangeCodeForToken(code: string): Promise<string>;
  fetchAccount(accessToken: string): Promise<ExternalGameAccount>;
}
