import crypto from 'crypto';
import { NextRequest } from 'next/server';

export interface SessionPayload {
  userId: string;
  role: 'USER' | 'ADMIN';
  profileId?: string;
  iat: number;
  exp: number;
}

const DEFAULT_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

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
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadB64)
    .digest('base64url');

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

  const expectedSignature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadB64)
    .digest('base64url');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

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

/**
 * Extracts and verifies the authenticated server session from an incoming HTTP request.
 * Completely rejects plain/raw UUID cookies to eliminate cookie spoofing.
 */
export async function getServerSession(
  req?: NextRequest | Request
): Promise<SessionPayload | null> {
  if (!req) return null;

  let rawToken: string | undefined;

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

  if (!rawToken) {
    return null;
  }

  return verifySessionToken(rawToken);
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
