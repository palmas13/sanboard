import { GtaWorldAuthProvider } from './provider';
import {
  GtaWorldAuthResult,
  GtaWorldCharacter,
  GtaWorldUserSession,
  GtaWorldApiUserResponse,
  OAuthStateSupportStatus,
} from './types';

export const MOCK_CHARACTERS: GtaWorldCharacter[] = [
  {
    id: '44444444-4444-4444-4444-444444444441',
    fullName: 'Mavis Pierce',
    hasProfile: true,
    avatarUrl: '',
    sanmailEmail: 'mavis.pierce@sanmail.com',
    phone: '555-0192',
  },
  {
    id: '44444444-4444-4444-4444-444444444442',
    fullName: 'Zade Vexnera',
    hasProfile: true,
    avatarUrl: '',
    sanmailEmail: 'zade.vexnera@sanmail.com',
    phone: '555-8831',
  },
  {
    id: '44444444-4444-4444-4444-444444444443',
    fullName: 'Ravi Blumon',
    hasProfile: false,
    avatarUrl: '',
    sanmailEmail: 'ravi.blumon@sanmail.com',
    phone: '555-4309',
  },
];

export class MockGtaWorldAuthProvider implements GtaWorldAuthProvider {
  readonly oauthStateSupport: OAuthStateSupportStatus = 'supported';

  async login(): Promise<GtaWorldAuthResult> {
    return {
      success: true,
      session: {
        userId: 'gta-mock-user-1',
        username: 'mavis_player',
        role: 'ADMIN', // Set as admin for full developer access in mock mode
        characters: MOCK_CHARACTERS,
      },
    };
  }

  async getCharacters(_userId: string): Promise<GtaWorldCharacter[]> {
    return MOCK_CHARACTERS;
  }

  async verifySession(token: string): Promise<GtaWorldUserSession | null> {
    if (!token) return null;
    return {
      userId: 'gta-mock-user-1',
      username: 'mavis_player',
      role: 'ADMIN',
      characters: MOCK_CHARACTERS,
    };
  }

  getAuthorizeUrl(state?: string): string {
    const redirectUri = process.env.GTAWORLD_REDIRECT_URI || '/api/auth/gtaworld/callback';
    return `${redirectUri}?code=mock_authorization_code${state ? `&state=${encodeURIComponent(state)}` : ''}`;
  }

  async exchangeCodeForToken(_code: string): Promise<string> {
    return 'mock_gtaworld_access_token_12345';
  }

  async fetchUser(_accessToken: string): Promise<GtaWorldApiUserResponse> {
    return {
      user: {
        id: 1,
        username: 'mavis_player',
        confirmed: 1,
        role: {
          id: 585,
          user_id: 1,
          role_id: 'Manager',
          server: 0,
        },
        character: [
          {
            id: 425345,
            memberid: 1,
            firstname: 'Mavis',
            lastname: 'Pierce',
          },
          {
            id: 5442345,
            memberid: 1,
            firstname: 'Zade',
            lastname: 'Vexnera',
          },
        ],
      },
    };
  }
}
