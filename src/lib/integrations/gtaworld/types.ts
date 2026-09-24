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

export type OAuthStateSupportStatus = 'unverified' | 'supported' | 'unsupported';


// ============================================================================
// Official GTA World UCP OAuth & API Contract Types
// ============================================================================

export interface GtaWorldApiCharacter {
  id: number;
  memberid?: number;
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
  id: number;
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
