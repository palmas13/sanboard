import { GtaWorldAuthProvider } from './provider';
import {
  GtaWorldAuthResult,
  GtaWorldCharacter,
  GtaWorldUserSession,
  GtaWorldApiUserResponse,
  OAuthStateSupportStatus,
} from './types';

/**
 * Production Real GTA World UCP OAuth Provider.
 * Implements the official OAuth 2.0 contract:
 * - Authorize: GET /oauth/authorize
 * - Token: POST /oauth/token (application/x-www-form-urlencoded)
 * - User: GET /api/user (Bearer token)
 */
export class RealGtaWorldAuthProvider implements GtaWorldAuthProvider {
  /**
   * OAuth State Parameter support status.
   * Defaults strictly to 'unverified' until real credentials are provided
   * and a live authorization round-trip confirms whether GTA World echoes state.
   */
  readonly oauthStateSupport: OAuthStateSupportStatus;

  constructor() {
    const configured = process.env.GTAWORLD_OAUTH_STATE_SUPPORT as OAuthStateSupportStatus;
    if (configured === 'supported' || configured === 'unsupported') {
      this.oauthStateSupport = configured;
    } else {
      this.oauthStateSupport = 'unverified';
    }
  }

  private getBaseUrl(): string {
    const url = process.env.GTAWORLD_API_BASE_URL || 'https://ucp-tr.gta.world';
    return url.trim().replace(/\/+$/, '');
  }

  private getClientId(): string {
    const clientId = process.env.GTAWORLD_CLIENT_ID;
    if (!clientId) {
      throw new Error('GTAWORLD_CLIENT_ID is not configured in environment variables.');
    }
    return clientId.trim();
  }

  private getClientSecret(): string {
    const clientSecret = process.env.GTAWORLD_CLIENT_SECRET;
    if (!clientSecret) {
      throw new Error('GTAWORLD_CLIENT_SECRET is not configured in environment variables.');
    }
    return clientSecret.trim();
  }

  private getRedirectUri(): string {
    const redirectUri = process.env.GTAWORLD_REDIRECT_URI;
    if (!redirectUri) {
      throw new Error('GTAWORLD_REDIRECT_URI is not configured in environment variables.');
    }
    return redirectUri.trim();
  }

  /**
   * Generates the authorization URL to redirect the user to GTA World UCP.
   * Parameter scope is passed as empty string per official GTA World documentation.
   * Client secret is NEVER exposed here.
   */
  getAuthorizeUrl(state?: string): string {
    const baseUrl = this.getBaseUrl();
    const clientId = this.getClientId();
    const redirectUri = this.getRedirectUri();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: '',
    });

    if (state) {
      params.set('state', state);
    }

    return `${baseUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Server-side exchange of authorization code for access token.
   * Runs strictly on the server and uses application/x-www-form-urlencoded.
   */
  async exchangeCodeForToken(code: string): Promise<string> {
    if (!code || typeof code !== 'string') {
      throw new Error('Geçersiz veya eksik yetkilendirme kodu (code).');
    }

    const baseUrl = this.getBaseUrl();
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = this.getRedirectUri();

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code.trim(),
    });

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });
    } catch (err: any) {
      throw new Error(`GTA World token sunucusuna bağlanılamadı: ${err.message || 'Zaman aşımı'}`);
    }

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      try {
        const errorJson = await res.json();
        if (errorJson.error || errorJson.error_description) {
          errorMsg = `${errorJson.error || ''}: ${errorJson.error_description || ''}`.trim();
        }
      } catch {
        // Fallback to HTTP status
      }
      throw new Error(`GTA World token değişimi başarısız oldu (${errorMsg}).`);
    }

    const json = await res.json();
    if (!json.access_token || typeof json.access_token !== 'string') {
      throw new Error('GTA World yanıtı geçerli bir access_token içermiyor.');
    }

    return json.access_token;
  }

  /**
   * Fetches the authenticated user and character list from GTA World /api/user.
   */
  async fetchUser(accessToken: string): Promise<GtaWorldApiUserResponse> {
    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('Erişim belirteci (access_token) eksik.');
    }

    const baseUrl = this.getBaseUrl();

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/user`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });
    } catch (err: any) {
      throw new Error(`GTA World kullanıcı servisine bağlanılamadı: ${err.message || 'Zaman aşımı'}`);
    }

    if (!res.ok) {
      throw new Error(`GTA World kullanıcı bilgisi alınamadı (HTTP ${res.status}).`);
    }

    const data = await res.json();

    // Defensive validation of response shape
    if (!data?.user || typeof data.user !== 'object') {
      throw new Error('GTA World kullanıcı verisi hatalı biçimde döndü.');
    }

    const user = data.user;
    if (user.id === undefined || user.id === null) {
      throw new Error('GTA World kullanıcı ID eksik.');
    }

    if (!Array.isArray(user.character)) {
      user.character = [];
    }

    return data as GtaWorldApiUserResponse;
  }

  async login(): Promise<GtaWorldAuthResult> {
    throw new Error('Doğrudan login() çağrısı yerine OAuth yönlendirme akışını kullanın (/api/auth/gtaworld/login).');
  }

  async getCharacters(_userId: string): Promise<GtaWorldCharacter[]> {
    throw new Error('Karakter listesi için senkronize edilmiş yerel Sanboard veritabanını kullanın.');
  }

  async verifySession(_token: string): Promise<GtaWorldUserSession | null> {
    throw new Error('Oturum doğrulaması için Sanboard HMAC oturumunu kullanın.');
  }
}
