export interface GtaWorldCharacter {
  id: string;
  fullName: string;
  hasProfile: boolean;
  avatarUrl?: string;
  sanmailEmail?: string;
  phone?: string;
}

export interface GtaWorldUserSession {
  userId: string;
  username: string;
  role: 'USER' | 'ADMIN';
  characters: GtaWorldCharacter[];
}

export interface GtaWorldAuthResult {
  success: boolean;
  session?: GtaWorldUserSession;
  error?: string;
}
