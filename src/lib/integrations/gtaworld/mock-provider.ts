import { GtaWorldAuthProvider } from './provider';
import {
  GtaWorldAuthResult,
  GtaWorldCharacter,
  GtaWorldUserSession,
  ExternalGameAccount,
  GtaWorldApiUserResponse,
} from './types';
import { TEST_LOGIN_ACCOUNT_PREFIX, TEST_LOGIN_CHARACTER_PREFIX } from '@/lib/auth/test-login';

export const MOCK_CHARACTERS: GtaWorldCharacter[] = [
  {
    id: `${TEST_LOGIN_CHARACTER_PREFIX}mavis-pierce`,
    fullName: 'Mavis Pierce',
    hasProfile: true,
    avatarUrl: '',
    sanmailEmail: 'mavis.pierce@sanmail.com',
    phone: '555-0192',
  },
  {
    id: `${TEST_LOGIN_CHARACTER_PREFIX}zade-vexnera`,
    fullName: 'Zade Vexnera',
    hasProfile: true,
    avatarUrl: '',
    sanmailEmail: 'zade.vexnera@sanmail.com',
    phone: '555-8831',
  },
  {
    id: `${TEST_LOGIN_CHARACTER_PREFIX}ravi-blumon`,
    fullName: 'Ravi Blumon',
    hasProfile: true,
    avatarUrl: '',
    sanmailEmail: 'ravi.blumon@sanmail.com',
    phone: '555-7722',
  },
];

export class MockGtaWorldAuthProvider implements GtaWorldAuthProvider {
  async login(): Promise<GtaWorldAuthResult> {
    return {
      success: true,
      session: {
        userId: `${TEST_LOGIN_ACCOUNT_PREFIX}fixtures`,
        username: 'sanboard_test_fixtures',
        role: 'USER',
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
      userId: `${TEST_LOGIN_ACCOUNT_PREFIX}fixtures`,
      username: 'sanboard_test_fixtures',
      role: 'USER',
      characters: MOCK_CHARACTERS,
    };
  }

  getAuthorizeUrl(state: string): string {
    const redirectUri = process.env.GTAWORLD_REDIRECT_URI || '/api/auth/gtaworld/callback';
    return `${redirectUri}?code=mock_authorization_code${state ? `&state=${encodeURIComponent(state)}` : ''}`;
  }

  async exchangeCodeForToken(_code: string): Promise<string> {
    return 'mock_gtaworld_access_token_12345';
  }

  /** @deprecated Raw fixture helper retained only for regression tests. */
  async fetchUser(_accessToken: string): Promise<GtaWorldApiUserResponse> {
    return {
      user: {
        id: 1,
        username: 'mavis_player',
        character: [
          { id: 425345, firstname: 'Mavis', lastname: 'Pierce' },
          { id: 5442345, firstname: 'Zade', lastname: 'Vexnera' },
          { id: 7891234, firstname: 'Ravi', lastname: 'Blumon' },
        ],
      },
    };
  }

  async fetchAccount(_accessToken: string): Promise<ExternalGameAccount> {
    return {
      externalAccountId: `${TEST_LOGIN_ACCOUNT_PREFIX}fixtures`,
      characters: MOCK_CHARACTERS.map((character) => ({
        externalCharacterId: character.id,
        displayName: character.fullName,
        avatarUrl: character.avatarUrl || null,
      })),
    };
  }
}
