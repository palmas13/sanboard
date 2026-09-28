import { GtaWorldAuthProvider } from './provider';
import {
  GtaWorldAuthResult,
  GtaWorldCharacter,
  GtaWorldUserSession,
  ExternalGameAccount,
  GtaWorldApiUserResponse,
} from './types';
import {
  TEST_LOGIN_FIXTURE_ACCOUNT_ID,
  TEST_LOGIN_JANE_CHARACTER_ID,
  TEST_LOGIN_JOHN_CHARACTER_ID,
  TEST_LOGIN_SECONDARY_ACCOUNT_ID,
  TEST_LOGIN_CHARACTER_PREFIX,
} from '@/lib/auth/test-login';

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

export const SECONDARY_MOCK_CHARACTERS: GtaWorldCharacter[] = [
  {
    id: TEST_LOGIN_JOHN_CHARACTER_ID,
    fullName: 'John Doe',
    hasProfile: true,
    avatarUrl: '',
    sanmailEmail: 'john.doe@sanmail.com',
    phone: '555-0201',
  },
  {
    id: TEST_LOGIN_JANE_CHARACTER_ID,
    fullName: 'Jane Doe',
    hasProfile: true,
    avatarUrl: '',
    sanmailEmail: 'jane.doe@sanmail.com',
    phone: '555-0202',
  },
];

export const TEST_LOGIN_ACCOUNTS = {
  fixtures: {
    key: 'fixtures',
    label: 'Test Account A',
    externalAccountId: TEST_LOGIN_FIXTURE_ACCOUNT_ID,
    username: 'sanboard_test_fixtures',
    characters: MOCK_CHARACTERS,
  },
  secondary: {
    key: 'secondary',
    label: 'Test Account B',
    externalAccountId: TEST_LOGIN_SECONDARY_ACCOUNT_ID,
    username: 'sanboard_test_secondary',
    characters: SECONDARY_MOCK_CHARACTERS,
  },
} as const;

export type TestLoginAccountKey = keyof typeof TEST_LOGIN_ACCOUNTS;

export function resolveTestLoginAccountKey(value: string | null | undefined): TestLoginAccountKey | null {
  if (!value) return 'fixtures';
  return Object.prototype.hasOwnProperty.call(TEST_LOGIN_ACCOUNTS, value) ? value as TestLoginAccountKey : null;
}

export class MockGtaWorldAuthProvider implements GtaWorldAuthProvider {
  constructor(private readonly accountKey: TestLoginAccountKey = 'fixtures') {}

  private get account() {
    return TEST_LOGIN_ACCOUNTS[this.accountKey];
  }

  async login(): Promise<GtaWorldAuthResult> {
    return {
      success: true,
      session: {
        userId: this.account.externalAccountId,
        username: this.account.username,
        role: 'USER',
        characters: [...this.account.characters],
      },
    };
  }

  async getCharacters(_userId: string): Promise<GtaWorldCharacter[]> {
    return [...this.account.characters];
  }

  async verifySession(token: string): Promise<GtaWorldUserSession | null> {
    if (!token) return null;
    return {
      userId: this.account.externalAccountId,
      username: this.account.username,
      role: 'USER',
      characters: [...this.account.characters],
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
      externalAccountId: this.account.externalAccountId,
      characters: this.account.characters.map((character) => ({
        externalCharacterId: character.id,
        displayName: character.fullName,
        avatarUrl: character.avatarUrl || null,
      })),
    };
  }
}
