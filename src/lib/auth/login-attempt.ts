import crypto from 'crypto';
import { normalizeInternalRedirect } from '@/lib/auth/redirect';

const ATTEMPT_EXPIRY_SECONDS = 10 * 60;
export const GTAWORLD_OAUTH_ATTEMPT_COOKIE = 'gtaw_oauth_attempt';

interface LoginAttemptPayload {
  state: string;
  redirect: string;
  nonce: string;
  purpose: 'GTAWORLD_LOGIN_ATTEMPT';
  iat: number;
  exp: number;
}

function getSigningSecret(): string {
  const secret = process.env.SANBOARD_SESSION_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production' || process.env.DATA_STORE === 'supabase') {
      throw new Error('SANBOARD_SESSION_SECRET is required for OAuth attempt signing.');
    }
    return 'sanboard-test-session-secret-for-local-mock-development-only-32bytes';
  }
  if (secret.length < 32) throw new Error('SANBOARD_SESSION_SECRET must be at least 32 bytes.');
  return secret;
}

function sign(encoded: string): string {
  return crypto.createHmac('sha256', getSigningSecret()).update(`gtaw-login-attempt.v1.${encoded}`).digest('base64url');
}

export function createLoginAttemptToken(state: string, redirect: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: LoginAttemptPayload = {
    state,
    redirect: normalizeInternalRedirect(redirect),
    nonce: crypto.randomBytes(24).toString('base64url'),
    purpose: 'GTAWORLD_LOGIN_ATTEMPT',
    iat: now,
    exp: now + ATTEMPT_EXPIRY_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function verifyLoginAttemptToken(token: string): LoginAttemptPayload | null {
  const [encoded, signature, extra] = String(token || '').split('.');
  if (!encoded || !signature || extra) return null;
  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as LoginAttemptPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.state || !payload.nonce || payload.purpose !== 'GTAWORLD_LOGIN_ATTEMPT' || !payload.exp || payload.exp < now) return null;
    payload.redirect = normalizeInternalRedirect(payload.redirect);
    return payload;
  } catch {
    return null;
  }
}

export function setLoginAttemptCookie(response: import('next/server').NextResponse, token: string): void {
  response.cookies.set(GTAWORLD_OAUTH_ATTEMPT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ATTEMPT_EXPIRY_SECONDS,
  });
}

export function clearLoginAttemptCookie(response: import('next/server').NextResponse): void {
  response.cookies.set(GTAWORLD_OAUTH_ATTEMPT_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}