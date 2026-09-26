export interface GtaWorldCharacter {
  id: string;
  fullName: string;
  hasProfile: boolean;
  avatarUrl?: string;
  avatarPath?: string;
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

/** Provider-neutral identity snapshot consumed by Sanboard application code. */
export interface ExternalGameCharacter {
  externalCharacterId: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface ExternalGameAccount {
  externalAccountId: string;
  characters: ExternalGameCharacter[];
}


/** Placeholder raw types retained only for legacy tests until the official contract arrives. */
export interface GtaWorldApiCharacter {
  id: string | number;
  memberid?: string | number;
  firstname: string;
  lastname: string;
}

export interface GtaWorldApiRole {
  id?: number;
  user_id?: number;
  role_id?: string;
  server?: number;
}

export interface GtaWorldApiUser {
  id: string | number;
  username: string;
  confirmed?: number;
  role?: GtaWorldApiRole;
  character: GtaWorldApiCharacter[];
}

export interface GtaWorldApiUserResponse {
  user: GtaWorldApiUser;
}

export interface GtaWorldTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

function opaqueId(value: unknown, field: string): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') {
    throw new Error(`GTA World ${field} eksik veya geçersiz.`);
  }
  return String(value).trim();
}

/** @deprecated Unknown raw field assumptions. Production provider must not use this adapter. */
export function adaptGtaWorldApiUser(user: GtaWorldApiUser): ExternalGameAccount {
  return {
    externalAccountId: opaqueId(user.id, 'account ID'),
    characters: (Array.isArray(user.character) ? user.character : []).map((character) => {
      const displayName = `${String(character.firstname || '').trim()} ${String(character.lastname || '').trim()}`.trim();
      if (!displayName) throw new Error('GTA World karakter adı eksik.');
      return {
        externalCharacterId: opaqueId(character.id, 'character ID'),
        displayName,
        avatarUrl: null,
      };
    }),
  };
}
