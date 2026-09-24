import { GtaWorldAuthProvider } from './provider';
import { GtaWorldAuthResult, GtaWorldCharacter, GtaWorldUserSession } from './types';

export const MOCK_CHARACTERS: GtaWorldCharacter[] = [
  {
    id: '44444444-4444-4444-4444-444444444441',
    fullName: 'Mavis Pierce',
    hasProfile: true,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    sanmailEmail: 'mavis.pierce@sanmail.com',
    phone: '555-0192',
  },
  {
    id: '44444444-4444-4444-4444-444444444442',
    fullName: 'Zade Vexnera',
    hasProfile: true,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    sanmailEmail: 'zade.vexnera@sanmail.com',
    phone: '555-8831',
  },
  {
    id: '44444444-4444-4444-4444-444444444443',
    fullName: 'Ravi Blumon',
    hasProfile: false,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    sanmailEmail: 'ravi.blumon@sanmail.com',
    phone: '555-4309',
  },
];

export class MockGtaWorldAuthProvider implements GtaWorldAuthProvider {
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
}
