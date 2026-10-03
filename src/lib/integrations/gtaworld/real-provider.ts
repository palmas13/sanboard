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

const AUTHORIZE_URL = 'https://ucp-tr.gta.world/oauth/authorize';
const TOKEN_URL = 'https://ucp-tr.gta.world/oauth/token';
const USER_URL = 'https://ucp-tr.gta.world/api/user';
const REQUEST_TIMEOUT_MS = 10_000;

export class GtaWorldTokenError extends Error {}
export class GtaWorldUserError extends Error {}

function config() {
  const clientId = process.env.GTAWORLD_CLIENT_ID;
  const clientSecret = process.env.GTAWORLD_CLIENT_SECRET;
  const redirectUri = process.env.GTAWORLD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new GtaWorldProviderNotConfiguredError();
  return { clientId, clientSecret, redirectUri };
}

async function providerFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export class RealGtaWorldAuthProvider implements GtaWorldAuthProvider {
  getAuthorizeUrl(state: string): string {
    const { clientId, redirectUri } = config();
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', '');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const { clientId, clientSecret, redirectUri } = config();
    const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code });
    let response: Response;
    try {
      response = await providerFetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    } catch { throw new GtaWorldTokenError('GTA World token request failed.'); }
    if (!response.ok) throw new GtaWorldTokenError(`GTA World token endpoint returned ${response.status}.`);
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new GtaWorldTokenError('Malformed GTA World token response.'); }
    const token = (payload as { access_token?: unknown })?.access_token;
    if (typeof token !== 'string' || !token.trim()) throw new GtaWorldTokenError('GTA World access token is missing.');
    return token;
  }

  async fetchAccount(accessToken: string): Promise<ExternalGameAccount> {
    config();
    let response: Response;
    try { response = await providerFetch(USER_URL, { headers: { Authorization: `Bearer ${accessToken}` } }); }
    catch { throw new GtaWorldUserError('GTA World user request failed.'); }
    if (!response.ok) throw new GtaWorldUserError(`GTA World user endpoint returned ${response.status}.`);
    let payload: any;
    try { payload = await response.json(); } catch { throw new GtaWorldUserError('Malformed GTA World user response.'); }
    const user = payload?.user;
    if ((!Number.isSafeInteger(user?.id) && typeof user?.id !== 'string') || String(user.id).trim() === '') throw new GtaWorldUserError('GTA World user ID is missing.');
    const characters = (Array.isArray(user.character) ? user.character : []).flatMap((item: any) => {
      if ((!Number.isSafeInteger(item?.id) && typeof item?.id !== 'string') || String(item.id).trim() === '') return [];
      const firstName = typeof item.firstname === 'string' ? item.firstname.trim() : '';
      const lastName = typeof item.lastname === 'string' ? item.lastname.trim() : '';
      if (!firstName || !lastName) return [];
      return [{ externalCharacterId: String(item.id).trim(), firstName, lastName, displayName: `${firstName} ${lastName}` }];
    });
    return { externalAccountId: String(user.id).trim(), characters };
  }
}