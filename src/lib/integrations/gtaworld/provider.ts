import {
  ExternalGameAccount,
} from './types';

export interface GtaWorldAuthProvider {
  getAuthorizeUrl(state: string): string;
  exchangeCodeForToken(code: string): Promise<string>;
  fetchAccount(accessToken: string): Promise<ExternalGameAccount>;
}
