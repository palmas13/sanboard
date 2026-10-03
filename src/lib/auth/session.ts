import crypto from 'crypto';
import { cache } from 'react';
import { NextRequest } from 'next/server';

export interface SessionPayload {
  userId: string;
  role: 'USER' | 'ADMIN';
  profileId?: string;
  iat: number;
  exp: number;
}

export interface CharacterSelectionPayload {
  userId: string;
  nonce: string;
  purpose: 'CHARACTER_SELECTION';
  characters?: Array<{ externalCharacterId: string; firstName: string; lastName: string }>;
  iat: number;
  exp: number;
}

export type SessionTimingStage = 'session_parse' | 'session_verify';
export type SessionTimingObserver = (stage: SessionTimingStage, duration: number) => void;

const DEFAULT_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
const CHARACTER_SELECTION_EXPIRY_SECONDS = 10 * 60;
export const CHARACTER_SELECTION_COOKIE = 'sanboard_character_selection';

function getSessionSecret(): string {
  const secret = process.env.SANBOARD_SESSION_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production' || process.env.DATA_STORE === 'supabase') {
      throw new Error(
        'CRITICAL CONFIG ERROR: SANBOARD_SESSION_SECRET is missing. A fixed, secure secret (at least 32 bytes) must be set in environment variables.'
      );
    }
    return 'sanboard-test-session-secret-for-local-mock-development-only-32bytes';
  }

  if (secret.length < 32) {
    throw new Error(
      'CRITICAL CONFIG ERROR: SANBOARD_SESSION_SECRET is too short. It must be at least 32 bytes long.'
    );
  }

  return secret;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function signPayload(payloadB64: string, purpose: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(`${purpose}.${payloadB64}`)
    .digest('base64url');
}

function signSessionPayload(payloadB64: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadB64)
    .digest('base64url');
}

function signaturesMatch(signature: string, expectedSignature: string): boolean {
  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  return sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token.
 */
export function createSessionToken(data: {
  userId: string;
  role: 'USER' | 'ADMIN';
  profileId?: string;
  expirySeconds?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId: data.userId,
    role: data.role,
    profileId: data.profileId,
    iat: now,
    exp: now + (data.expirySeconds || DEFAULT_EXPIRY_SECONDS),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = signSessionPayload(payloadB64);

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies a signed session token. Returns null if missing, expired, or tampered.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return null;

  const expectedSignature = signSessionPayload(payloadB64);
  if (!signaturesMatch(signature, expectedSignature)) return null;

  try {
    const payloadStr = base64UrlDecode(payloadB64);
    const payload: SessionPayload = JSON.parse(payloadStr);

    if (!payload.userId || !payload.exp) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

export function createCharacterSelectionToken(userId: string, characters?: CharacterSelectionPayload['characters']): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: CharacterSelectionPayload = {
    userId,
    nonce: crypto.randomBytes(24).toString('base64url'),
    purpose: 'CHARACTER_SELECTION',
    characters,
    iat: now,
    exp: now + CHARACTER_SELECTION_EXPIRY_SECONDS,
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  return `${payloadB64}.${signPayload(payloadB64, 'character-selection.v1')}`;
}

export function verifyCharacterSelectionToken(token: string): CharacterSelectionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const [payloadB64, signature, extra] = token.split('.');
  if (!payloadB64 || !signature || extra) return null;
  if (!signaturesMatch(signature, signPayload(payloadB64, 'character-selection.v1'))) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as CharacterSelectionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.userId || !payload.nonce || payload.purpose !== 'CHARACTER_SELECTION' || !payload.exp || payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getCharacterSelectionContext(req: NextRequest | Request): CharacterSelectionPayload | null {
  let rawToken: string | undefined;
  if ('cookies' in req && typeof req.cookies?.get === 'function') {
    rawToken = req.cookies.get(CHARACTER_SELECTION_COOKIE)?.value;
  }
  if (!rawToken) {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${CHARACTER_SELECTION_COOKIE}=([^;]+)`));
    if (match) rawToken = decodeURIComponent(match[1]);
  }
  return rawToken ? verifyCharacterSelectionToken(rawToken) : null;
}

/**
 * Extracts and verifies the authenticated server session from an incoming HTTP request.
 * Completely rejects plain/raw UUID cookies to eliminate cookie spoofing.
 */
async function resolveServerSession(
  req?: NextRequest | Request,
  onTiming?: SessionTimingObserver
): Promise<SessionPayload | null> {
  const parseStartedAt = performance.now();
  let rawToken: string | undefined;

  try {
    if (req) {
      if ('cookies' in req && typeof req.cookies?.get === 'function') {
        rawToken = req.cookies.get('sanboard_session')?.value;
      }

      // Fallback to reading from standard Cookie header
      if (!rawToken) {
        const cookieHeader = req.headers.get('cookie') || '';
        const match = cookieHeader.match(/(?:^|;\s*)sanboard_session=([^;]+)/);
        if (match) {
          rawToken = decodeURIComponent(match[1]);
        }
      }
    } else {
      // Next.js App Router Server Component / Layout context
      try {
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        rawToken = cookieStore.get('sanboard_session')?.value;
      } catch {
        return null;
      }
    }
  } finally {
    onTiming?.('session_parse', performance.now() - parseStartedAt);
  }

  if (!rawToken) {
    return null;
  }

  const verifyStartedAt = performance.now();
  try {
    return verifySessionToken(rawToken);
  } finally {
    onTiming?.('session_verify', performance.now() - verifyStartedAt);
  }
}

/**
 * Request-scoped memoized session resolver. React cache deduplicates repeated
 * calls during the same Server Component render/request without persisting
 * user-specific data across requests.
 */
export const getServerSession = cache((req?: NextRequest | Request) => resolveServerSession(req));

/** Resolves a session with request-local wall-clock observations, without changing verification behavior. */
export function getServerSessionWithTiming(
  req: NextRequest | Request,
  onTiming: SessionTimingObserver
): Promise<SessionPayload | null> {
  return resolveServerSession(req, onTiming);
}

/**
 * Returns formatted Set-Cookie header string for the signed session cookie.
 */
export function createSessionCookie(token: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  return `sanboard_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DEFAULT_EXPIRY_SECONDS}${isProd ? '; Secure' : ''}`;
}

/**
 * Returns formatted Set-Cookie header string to clear the session cookie.
 */
export function clearSessionCookie(): string {
  const isProd = process.env.NODE_ENV === 'production';
  return `sanboard_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? '; Secure' : ''}`;
}

/**
 * Sets the signed session cookie directly on a NextResponse object.
 * This guarantees the cookie is not overwritten by subsequent response.cookies.set() calls.
 */
export function setSessionCookieOnResponse(response: import('next/server').NextResponse, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  response.cookies.set('sanboard_session', token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: DEFAULT_EXPIRY_SECONDS,
    secure: isProd,
  });
}

/**
 * Clears the signed session cookie directly on a NextResponse object.
 */
export function clearSessionCookieOnResponse(response: import('next/server').NextResponse): void {
  const isProd = process.env.NODE_ENV === 'production';
  response.cookies.set('sanboard_session', '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
    secure: isProd,
  });
}

export function setCharacterSelectionCookieOnResponse(
  response: import('next/server').NextResponse,
  token: string
): void {
  response.cookies.set(CHARACTER_SELECTION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: CHARACTER_SELECTION_EXPIRY_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });
}

export function clearCharacterSelectionCookieOnResponse(
  response: import('next/server').NextResponse
): void {
  response.cookies.set(CHARACTER_SELECTION_COOKIE, '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });
}

export function setLegacyRoutingCookiesOnResponse(
  response: import('next/server').NextResponse,
  data: { userId: string; profileId: string; role: 'USER' | 'ADMIN' }
): void {
  response.cookies.set('sanboard_profile_id', data.profileId, { path: '/', maxAge: 86400, sameSite: 'lax' });
  response.cookies.set('sanboard_user_id', data.userId, { path: '/', maxAge: 86400, sameSite: 'lax' });
  response.cookies.set('sanboard_role', data.role, { path: '/', maxAge: 86400, sameSite: 'lax' });
}

